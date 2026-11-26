/**
 * Authored deep-teaching content, keyed by finding id.
 *
 * Each entry adds what the analyzer's own text can't: how an attacker actually
 * exploits the misconfiguration, a before/after fix, and a spoiler-free hint
 * for the hunt phase. Only findings that appear in the practice exercises are
 * authored; everything else returns null and the UI falls back to the finding's
 * built-in impact/requirement/remediation.
 *
 * The `LESSONS` object is generated data (see scripts/build-lessons or the
 * authored source blocks); treat it as content, not logic.
 */
const LESSONS = require('./lessons.data.json');

/** @returns {object|null} { attack, fix:{before,after}, hint } or null if unauthored. */
function lessonFor(findingId) {
  return LESSONS[findingId] || null;
}

module.exports = { LESSONS, lessonFor };
