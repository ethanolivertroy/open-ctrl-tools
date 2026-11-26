/**
 * Practice-mode routes.
 *
 * The invariant here: the browser never receives the answer key before the
 * learner commits. It gets the config text and the category vocabulary, and
 * nothing else. Grading happens server-side. Ship the answers to the client and
 * the exercise is one devtools panel away from being pointless.
 */
const express = require('express');

const { listExercises, getExercise, publicSummary, answerKeyFor, configFor, categoriesFor } = require('../learn/exercises');
const { grade } = require('../learn/grading');
const { referencesFor } = require('../knowledge/references');
const { lessonFor } = require('../knowledge/lessons');

const router = express.Router();

/** Every finding in a reveal is enriched with its links and any authored lesson. */
function teach(finding, mesh) {
  return {
    ...finding,
    references: referencesFor(finding, mesh),
    lesson: lessonFor(finding.id)
  };
}

// The catalog. No answers.
router.get('/exercises', (req, res) => {
  res.json({ success: true, exercises: listExercises() });
});

// One exercise: the config to hunt through, and what you may accuse a line of.
// No answers.
router.get('/exercises/:id', (req, res) => {
  const exercise = getExercise(req.params.id);
  if (!exercise) {
    return res.status(404).json({ success: false, message: 'No such exercise' });
  }

  res.json({
    success: true,
    exercise: publicSummary(exercise),
    config: configFor(exercise),
    categories: categoriesFor(exercise)
  });
});

// Commit your flags and get scored. This is the only route that reveals findings.
router.post('/exercises/:id/grade', (req, res) => {
  const exercise = getExercise(req.params.id);
  if (!exercise) {
    return res.status(404).json({ success: false, message: 'No such exercise' });
  }

  const { flags } = req.body || {};
  if (flags !== undefined && !Array.isArray(flags)) {
    return res.status(400).json({ success: false, message: '`flags` must be an array of {line, category}' });
  }

  const answerKey = answerKeyFor(exercise);
  const result = grade(answerKey, flags || []);

  // Findings whose config key is absent from the file have no line to click, so
  // they cannot be hunted or scored. They are still worth teaching -- "the
  // dangerous thing is what *isn't* here" is the lesson -- so they come back
  // separately, clearly marked as unscored.
  const notClickable = answerKey.filter((f) => !Number.isInteger(f.line));

  res.json({
    success: true,
    exercise: publicSummary(exercise),
    score: result.score,
    precision: result.precision,
    caught: result.caught.map((f) => teach(f, exercise.mesh)),
    partial: result.partial.map((f) => teach(f, exercise.mesh)),
    missed: result.missed.map((f) => teach(f, exercise.mesh)),
    falsePositives: result.falsePositives,
    absent: notClickable.map((f) => teach(f, exercise.mesh))
  });
});

module.exports = router;
