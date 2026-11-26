/**
 * Grade a learner's hunt against the findings the analyzer actually produced.
 *
 * The learner flags lines and names what they think is wrong with each. Every
 * expected finding then lands in one of four outcomes:
 *
 *   caught         right line AND right category
 *   partial        right line, wrong category -- they smelled it, misdiagnosed it
 *   missed         a real finding they never flagged
 *   falsePositive  a flagged line that has no finding on it
 *
 * Partial is a distinct outcome on purpose. "I saw line 2 was wrong but called
 * it mTLS instead of Access Control" is a different gap from not seeing line 2,
 * and the reveal should tell the learner which one they have.
 */

// Missing a Critical should cost more than missing a Low.
const SEVERITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// A misdiagnosis still shows they spotted the anomaly, so it earns half credit.
const PARTIAL_CREDIT = 0.5;

const weightOf = (finding) => SEVERITY_WEIGHT[finding.severity] || 1;

/**
 * @param {object[]} findings  Analyzer findings, each with a numeric `line`.
 * @param {object[]} flags     Learner submissions: [{line, category}].
 * @returns {object} outcomes, score and accuracy.
 */
function grade(findings, flags = []) {
  // One flag per line: a learner clicking the same line twice is one guess, not
  // two, and must not be able to farm credit or penalties by repeating it.
  const flagByLine = new Map();
  for (const flag of flags) {
    const line = Number(flag.line);
    if (!Number.isInteger(line)) continue;
    if (!flagByLine.has(line)) flagByLine.set(line, flag.category);
  }

  const gradable = findings.filter((f) => Number.isInteger(f.line));
  const caught = [];
  const partial = [];
  const missed = [];

  // Track which flagged lines hit something, so the rest are false positives.
  const productiveLines = new Set();

  // Group findings by line: one line can carry several findings, and a learner
  // who names one of them correctly should be credited against that one.
  const byLine = new Map();
  for (const finding of gradable) {
    if (!byLine.has(finding.line)) byLine.set(finding.line, []);
    byLine.get(finding.line).push(finding);
  }

  for (const [line, lineFindings] of byLine) {
    if (!flagByLine.has(line)) {
      missed.push(...lineFindings);
      continue;
    }

    productiveLines.add(line);
    const guessed = flagByLine.get(line);
    const exact = lineFindings.find((f) => f.category === guessed);

    if (exact) {
      caught.push(exact);
      // Any other findings sharing this line were still not identified.
      missed.push(...lineFindings.filter((f) => f !== exact));
    } else {
      // Right line, wrong name. Credit the most severe finding there -- the
      // learner pointed at the worst problem on that line even if they
      // misnamed it -- and count the rest as missed.
      const [worst, ...rest] = [...lineFindings].sort((a, b) => weightOf(b) - weightOf(a));
      partial.push(worst);
      missed.push(...rest);
    }
  }

  const falsePositives = [...flagByLine.entries()]
    .filter(([line]) => !productiveLines.has(line))
    .map(([line, category]) => ({ line, category }));

  const possible = gradable.reduce((sum, f) => sum + weightOf(f), 0);
  const earned =
    caught.reduce((sum, f) => sum + weightOf(f), 0) +
    partial.reduce((sum, f) => sum + weightOf(f) * PARTIAL_CREDIT, 0);

  // Precision answers "when you flagged something, were you right?" -- kept
  // separate from the score so a cautious learner and a trigger-happy one with
  // the same recall are told different things.
  const totalFlags = flagByLine.size;
  const precision = totalFlags === 0 ? null : productiveLines.size / totalFlags;

  return {
    caught,
    partial,
    missed,
    falsePositives,
    score: {
      earned: Math.round(earned * 10) / 10,
      possible,
      percent: possible === 0 ? 0 : Math.round((earned / possible) * 100)
    },
    precision: precision === null ? null : Math.round(precision * 100)
  };
}

module.exports = { grade, SEVERITY_WEIGHT, PARTIAL_CREDIT };
