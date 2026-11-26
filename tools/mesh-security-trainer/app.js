// app.js - Service Mesh Security Learning Tool
//
// Thin wiring only. The work lives in src/:
//   src/analyzers/  detection logic per mesh + the finding schema
//   src/knowledge/  teaching content: references (verified links), lessons
//   src/learn/      exercises and grading for practice mode
//   src/routes/     HTTP handlers
//   src/lib/        summarize, line-number lookup

const express = require('express');
const multer = require('multer');
const path = require('path');

const { createAnalyzeRoutes } = require('./src/routes/analyze');
const exerciseRoutes = require('./src/routes/exercises');

// Re-exported for tests and any external consumer that used to import from here.
const analyzers = require('./src/analyzers');
const { summarize } = require('./src/lib/summarize');
const { findLineNumbersForPath } = require('./src/lib/locate');

const app = express();
const port = 3000;

// Mesh configs are small text files. Bound the upload so a large or unexpected
// file can't be written to disk before we ever look at it.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_UPLOAD_EXTENSIONS = ['.yaml', '.yml', '.json', '.hcl'];

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext}". Expected one of: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`));
    }
    cb(null, true);
  }
});

app.use(express.static('public'));
app.use('/monaco-editor', express.static(path.join(__dirname, 'node_modules/monaco-editor')));
app.use('/samples', express.static(path.join(__dirname, 'samples')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Practice mode (hunt-then-reveal) and analyze mode (scan your own config).
app.use('/api', exerciseRoutes);
app.use('/', createAnalyzeRoutes(upload));

// Upload rejections (file too large, unsupported extension) are client errors,
// not server errors -- report them as 400 rather than letting Express 500.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: `File too large. Maximum upload size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`
    });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// Only start the server if this file is run directly, not when required by tests.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Service Mesh Security Learning Tool running at http://localhost:${port}`);
  });
}

module.exports = {
  app,
  summarize,
  findLineNumbersForPath,
  ...analyzers // IstioSecurityAnalyzer, ConsulSecurityAnalyzer, LinkerdSecurityAnalyzer, ANALYZERS, SEVERITY_LEVELS, ...
};
