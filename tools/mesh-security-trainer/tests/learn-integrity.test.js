/**
 * Integrity tests for the learning content. These guard the promises the tool
 * makes: answer keys that can't rot, citations that resolve, and practice
 * payloads that don't leak the answers.
 */
const { EXERCISES, answerKeyFor, configFor, categoriesFor, listExercises } = require('../src/learn/exercises');
const { NIST_DOCUMENTS, referencesFor } = require('../src/knowledge/references');
const { LESSONS } = require('../src/knowledge/lessons');
const { ANALYZERS } = require('../src/analyzers');

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

describe('exercise answer keys', () => {
  // The whole point of deriving keys from the analyzer: they can't drift. This
  // asserts they actually produce something to hunt.
  test.each(EXERCISES.map((e) => [e.id, e]))('%s produces a non-empty, gradable answer key', (_, exercise) => {
    const key = answerKeyFor(exercise);
    expect(key.length).toBeGreaterThan(0);

    const gradable = key.filter((finding) => Number.isInteger(finding.line));
    expect(gradable.length).toBeGreaterThan(0); // at least one clickable finding to hunt
  });

  test.each(EXERCISES.map((e) => [e.id, e]))('%s findings all carry a stable id', (_, exercise) => {
    for (const finding of answerKeyFor(exercise)) {
      expect(typeof finding.id).toBe('string');
      expect(finding.id).toMatch(new RegExp(`^${exercise.mesh}\\.`));
    }
  });

  test('every exercise mesh has an analyzer', () => {
    for (const exercise of EXERCISES) {
      expect(ANALYZERS[exercise.mesh]).toBeDefined();
    }
  });
});

describe('no dead citations', () => {
  // Every NIST document any check cites must have a verified link. A missing
  // entry means a learner clicks a citation and gets nothing.
  test('every nistDocument produced by any analyzer has a reference URL', () => {
    const cited = new Set();
    for (const Analyzer of Object.values(ANALYZERS)) {
      // Drive every analyzer over its vulnerable sample to surface real citations.
      const analyzer = new Analyzer();
      const findings = [];
      // Use the exercises' configs as the corpus of real inputs.
      for (const exercise of EXERCISES.filter((e) => ANALYZERS[e.mesh] === Analyzer)) {
        findings.push(...answerKeyFor(exercise));
      }
      for (const finding of findings) {
        if (finding.nistDocument && finding.nistDocument !== 'Configuration Error') {
          cited.add(finding.nistDocument);
        }
      }
    }

    const missing = [...cited].filter((doc) => !NIST_DOCUMENTS[doc]);
    expect(missing).toEqual([]);
  });

  test('referencesFor returns a real URL for a cited document', () => {
    const finding = { nistDocument: 'NIST SP 800-204B', section: 'Section 4.1', nistControls: ['AC-3'] };
    const refs = referencesFor(finding, 'istio');
    expect(refs.document.url).toMatch(/^https:\/\/csrc\.nist\.gov\//);
    expect(refs.vendor.url).toMatch(/^https:\/\/istio\.io\//);
    expect(refs.controlCatalog).not.toBeNull();
  });
});

describe('authored lessons match real findings', () => {
  // A lesson keyed by an id no analyzer emits is dead content -- it will never
  // be shown, and usually means a typo'd id.
  test('every authored lesson id is a real finding id', () => {
    const realIds = new Set();
    for (const exercise of EXERCISES) {
      for (const finding of answerKeyFor(exercise)) realIds.add(finding.id);
    }
    const orphans = Object.keys(LESSONS).filter((id) => !realIds.has(id));
    expect(orphans).toEqual([]);
  });

  test('every authored lesson has attack, fix.before/after, and hint', () => {
    for (const [id, lesson] of Object.entries(LESSONS)) {
      expect(typeof lesson.attack).toBe('string');
      expect(lesson.attack.length).toBeGreaterThan(0);
      expect(lesson.fix).toBeTruthy();
      expect(typeof lesson.fix.before).toBe('string');
      expect(typeof lesson.fix.after).toBe('string');
      expect(lesson.fix.before).not.toEqual(lesson.fix.after); // before/after must differ
      expect(typeof lesson.hint).toBe('string');
    }
  });
});

describe('practice-mode payloads never leak answers', () => {
  test('the exercise list carries no finding data', () => {
    const serialized = JSON.stringify(listExercises());
    expect(serialized).not.toMatch(/severity/i);
    expect(serialized).not.toMatch(/remediation/i);
    expect(serialized).not.toMatch(/nistControls/i);
  });

  test('a served exercise (config + categories) reveals no line-to-finding mapping', () => {
    for (const exercise of EXERCISES) {
      const categories = categoriesFor(exercise);
      const config = configFor(exercise);

      // The category vocabulary must not encode which line each answer is on.
      const payload = JSON.stringify({ config, categories });
      expect(payload).not.toMatch(/"line"\s*:/);
      expect(payload).not.toMatch(/"remediation"/);

      // Distractors must be present so the correct category isn't guessable by
      // elimination -- there should be more categories than distinct answers.
      const answerCategories = new Set(answerKeyFor(exercise).map((finding) => finding.category));
      expect(categories.length).toBeGreaterThan(answerCategories.size);
    }
  });
});
