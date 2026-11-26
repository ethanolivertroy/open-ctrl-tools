const { grade } = require('../src/learn/grading');

// Minimal findings: grading only reads id, line, category, severity.
const f = (id, line, category, severity = 'High') => ({ id, line, category, severity });

describe('grade', () => {
  const findings = [
    f('a', 2, 'Access Control', 'Critical'),
    f('b', 5, 'mTLS', 'High'),
    f('c', 9, 'Observability', 'Low')
  ];

  test('right line and right category = caught', () => {
    const r = grade(findings, [{ line: 2, category: 'Access Control' }]);
    expect(r.caught.map((x) => x.id)).toEqual(['a']);
    expect(r.partial).toHaveLength(0);
    expect(r.missed.map((x) => x.id).sort()).toEqual(['b', 'c']);
  });

  test('right line, wrong category = partial', () => {
    const r = grade(findings, [{ line: 2, category: 'mTLS' }]);
    expect(r.partial.map((x) => x.id)).toEqual(['a']);
    expect(r.caught).toHaveLength(0);
    expect(r.falsePositives).toHaveLength(0); // a flagged real line is never a false positive
  });

  test('flagging a line with no finding = false positive', () => {
    const r = grade(findings, [{ line: 100, category: 'mTLS' }]);
    expect(r.falsePositives).toEqual([{ line: 100, category: 'mTLS' }]);
    expect(r.missed).toHaveLength(3);
  });

  test('flagging nothing misses everything', () => {
    const r = grade(findings, []);
    expect(r.missed).toHaveLength(3);
    expect(r.score.percent).toBe(0);
    expect(r.precision).toBeNull(); // no flags -> precision is undefined, not zero
  });

  test('score is severity-weighted', () => {
    // Catching the Critical (weight 4) out of 4+3+1=8 possible = 50%.
    const critOnly = grade(findings, [{ line: 2, category: 'Access Control' }]);
    expect(critOnly.score).toEqual({ earned: 4, possible: 8, percent: 50 });

    // Catching only the Low (weight 1) = 12.5% -> rounds to 13.
    const lowOnly = grade(findings, [{ line: 9, category: 'Observability' }]);
    expect(lowOnly.score.percent).toBe(13);
  });

  test('partial earns half credit', () => {
    // Partial on the Critical: 4 * 0.5 = 2 of 8 = 25%.
    const r = grade(findings, [{ line: 2, category: 'wrong' }]);
    expect(r.score.earned).toBe(2);
    expect(r.score.percent).toBe(25);
  });

  test('the same line flagged twice counts once', () => {
    const r = grade(findings, [
      { line: 2, category: 'Access Control' },
      { line: 2, category: 'Access Control' }
    ]);
    expect(r.caught).toHaveLength(1);
    expect(r.falsePositives).toHaveLength(0);
    // Precision: 1 flag, 1 productive -> 100%, not 50% from double-counting.
    expect(r.precision).toBe(100);
  });

  test('two findings on one line: naming one credits that one, the other is missed', () => {
    const twoOnLine = [f('x', 3, 'Access Control', 'Critical'), f('y', 3, 'FedRAMP Compliance', 'High')];
    const r = grade(twoOnLine, [{ line: 3, category: 'Access Control' }]);
    expect(r.caught.map((x) => x.id)).toEqual(['x']);
    expect(r.missed.map((x) => x.id)).toEqual(['y']);
  });

  test('two findings on one line, wrong category: partial credits the most severe', () => {
    const twoOnLine = [f('x', 3, 'Access Control', 'Critical'), f('y', 3, 'FedRAMP Compliance', 'Medium')];
    const r = grade(twoOnLine, [{ line: 3, category: 'nonsense' }]);
    expect(r.partial.map((x) => x.id)).toEqual(['x']); // Critical, not the Medium
    expect(r.missed.map((x) => x.id)).toEqual(['y']);
  });

  test('findings with no line are not gradable and never counted', () => {
    const mixed = [f('a', 2, 'Access Control'), f('absent', null, 'mTLS')];
    const r = grade(mixed, [{ line: 2, category: 'Access Control' }]);
    expect(r.score.possible).toBe(3); // only the one gradable High finding
    expect(r.caught.map((x) => x.id)).toEqual(['a']);
    expect(r.missed).toHaveLength(0); // the absent one isn't "missed", it was unhuntable
  });

  test('precision separates recall from trigger-happiness', () => {
    // Two correct flags + two wrong = 50% precision, even though recall is decent.
    const r = grade(findings, [
      { line: 2, category: 'Access Control' },
      { line: 5, category: 'mTLS' },
      { line: 40, category: 'mTLS' },
      { line: 41, category: 'mTLS' }
    ]);
    expect(r.caught).toHaveLength(2);
    expect(r.falsePositives).toHaveLength(2);
    expect(r.precision).toBe(50);
  });

  test('non-integer lines in submissions are ignored, not crashed on', () => {
    const r = grade(findings, [{ line: 'abc', category: 'mTLS' }, { line: 2, category: 'Access Control' }]);
    expect(r.caught.map((x) => x.id)).toEqual(['a']);
    expect(r.falsePositives).toHaveLength(0);
  });
});
