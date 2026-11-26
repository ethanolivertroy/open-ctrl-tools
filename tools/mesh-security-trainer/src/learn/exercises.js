/**
 * The exercise catalog.
 *
 * Answer keys are NOT stored. They are derived by running the real analyzer
 * over the exercise config, so a key can never drift from what the tool
 * actually detects -- if a check changes, the answer key changes with it.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { ANALYZERS } = require('../analyzers');
const { findLineNumbersForPath } = require('../lib/locate');

const CONFIG_DIR = path.join(__dirname, 'configs');
const SAMPLE_DIR = path.join(__dirname, '..', '..', 'public', 'samples');

const EXERCISES = [
  {
    id: 'istio-mtls-basics',
    title: 'Istio: is anyone checking who they are talking to?',
    mesh: 'istio',
    difficulty: 'Beginner',
    brief:
      'A small Istio mesh. Most of it is fine. Find the setting that lets services talk ' +
      'to each other without proving their identity.',
    file: path.join(CONFIG_DIR, 'istio-mtls-basics.yaml')
  },
  {
    id: 'consul-acl-basics',
    title: 'Consul: who can read the key/value store?',
    mesh: 'consul',
    difficulty: 'Beginner',
    brief:
      'A Consul agent config with solid TLS and gossip encryption. But something here ' +
      'means the front door has no lock at all.',
    file: path.join(CONFIG_DIR, 'consul-acl-basics.json')
  },
  {
    id: 'linkerd-tls-basics',
    title: 'Linkerd: TLS is on — but is it doing anything?',
    mesh: 'linkerd',
    difficulty: 'Beginner',
    brief:
      'TLS is enabled here. That is not the same as TLS being enforced, and it is not ' +
      'the same as TLS being strong. Two problems.',
    file: path.join(CONFIG_DIR, 'linkerd-tls-basics.yaml')
  },
  {
    id: 'istio-full-audit',
    title: 'Istio: full audit',
    mesh: 'istio',
    difficulty: 'Advanced',
    brief:
      'A realistically bad Istio mesh. mTLS, authorization, certificates, egress, ' +
      'observability — assume nothing is safe. How many can you find?',
    file: path.join(SAMPLE_DIR, 'istio-vulnerable.yaml')
  },
  {
    id: 'consul-full-audit',
    title: 'Consul: full audit',
    mesh: 'consul',
    difficulty: 'Advanced',
    brief:
      'A Consul cluster with problems across access control, TLS, gossip encryption and ' +
      'FedRAMP compliance. This is the one that catches people out.',
    file: path.join(SAMPLE_DIR, 'consul-vulnerable.json')
  },
  {
    id: 'linkerd-full-audit',
    title: 'Linkerd: full audit',
    mesh: 'linkerd',
    difficulty: 'Advanced',
    brief:
      'A Linkerd mesh with identity, policy, proxy and TLS weaknesses. Watch the ' +
      'default policies especially.',
    file: path.join(SAMPLE_DIR, 'linkerd-vulnerable.yaml')
  }
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

function parseConfig(content, file) {
  return path.extname(file) === '.json' ? JSON.parse(content) : yaml.load(content);
}

/**
 * Run the analyzer over an exercise and resolve each finding to a line number.
 * This is the answer key. It is computed, never stored.
 */
function answerKeyFor(exercise) {
  const content = fs.readFileSync(exercise.file, 'utf8');
  const config = parseConfig(content, exercise.file);

  const analyzer = new ANALYZERS[exercise.mesh]();
  analyzer.analyze(config);

  return analyzer.getEnrichedFindings().map((finding) => ({
    ...finding,
    line: finding.location ? findLineNumbersForPath(content, finding.location) : null
  }));
}

/** The exercise config text the learner reads. Contains no answers. */
function configFor(exercise) {
  return fs.readFileSync(exercise.file, 'utf8');
}

/**
 * The categories a learner picks from when flagging a line.
 *
 * Drawn from the exercise's own answer key plus a pool of plausible distractors,
 * so the correct category is never guessable by elimination. Sorted, so its
 * position leaks nothing.
 */
const DISTRACTOR_CATEGORIES = [
  'mTLS', 'Access Control', 'Authorization', 'Authentication', 'TLS Security',
  'Certificate Security', 'Certificate Authority', 'Gossip Security', 'Observability',
  'Proxy Security', 'Proxy Configuration', 'Resource Management', 'Traffic Security',
  'Service Identity', 'Image Security', 'Encryption', 'Configuration Management'
];

function categoriesFor(exercise) {
  const real = new Set(answerKeyFor(exercise).map((f) => f.category));
  const pool = new Set([...real, ...DISTRACTOR_CATEGORIES]);
  return [...pool].sort();
}

/** Public metadata only — safe to send to the browser. */
function publicSummary(exercise) {
  return {
    id: exercise.id,
    title: exercise.title,
    mesh: exercise.mesh,
    difficulty: exercise.difficulty,
    brief: exercise.brief
  };
}

function listExercises() {
  return EXERCISES.map(publicSummary);
}

function getExercise(id) {
  return byId.get(id) || null;
}

module.exports = {
  EXERCISES,
  listExercises,
  getExercise,
  publicSummary,
  answerKeyFor,
  configFor,
  categoriesFor
};
