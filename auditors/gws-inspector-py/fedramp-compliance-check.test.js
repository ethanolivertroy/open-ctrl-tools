const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { google } = require('googleapis');

const {
  checkAuditLogging,
  checkPasswordPolicy,
  checkTwoStepVerification,
  saveTokenSecurely,
} = require('./fedramp-compliance-check.js');

function reportFor(id) {
  return {
    checks: [{ id, status: 'Not Checked', details: '' }],
    summary: { compliant: 0, nonCompliant: 0, notChecked: 1 },
  };
}

test('password policy remains a manual check', async () => {
  const report = reportFor('password-policy');

  await checkPasswordPolicy(null, report);

  assert.equal(report.checks[0].status, 'Not Checked');
  assert.deepEqual(report.summary, { compliant: 0, nonCompliant: 0, notChecked: 1 });
});

test('two-step verification remains a manual check', async () => {
  const report = reportFor('two-step-verification');

  await checkTwoStepVerification(null, report);

  assert.equal(report.checks[0].status, 'Not Checked');
  assert.deepEqual(report.summary, { compliant: 0, nonCompliant: 0, notChecked: 1 });
});

test('an empty audit log is inconclusive', async () => {
  const report = reportFor('audit-logging');
  const originalAdmin = google.admin;
  google.admin = () => ({
    activities: {
      list: async () => ({ data: {} }),
    },
  });

  try {
    await checkAuditLogging(null, report);
  } finally {
    google.admin = originalAdmin;
  }

  assert.equal(report.checks[0].status, 'Not Checked');
  assert.match(report.checks[0].details, /No admin audit events/);
  assert.deepEqual(report.summary, { compliant: 0, nonCompliant: 0, notChecked: 1 });
});

test('the CLI exits nonzero when an audit cannot start', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gws-cli-test-'));

  try {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'fedramp-compliance-check.js')], {
      cwd: directory,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /Error during compliance check/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('saved token is owner-only and replaces a symlink instead of following it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gws-token-test-'));
  const tokenPath = path.join(directory, 'token.json');
  const targetPath = path.join(directory, 'target.json');

  try {
    fs.writeFileSync(targetPath, 'unchanged');
    fs.symlinkSync(targetPath, tokenPath);

    saveTokenSecurely(tokenPath, { refresh_token: 'redacted' });

    assert.equal(fs.lstatSync(tokenPath).isSymbolicLink(), false);
    assert.equal(fs.statSync(tokenPath).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(fs.readFileSync(tokenPath, 'utf8')), { refresh_token: 'redacted' });
    assert.equal(fs.readFileSync(targetPath, 'utf8'), 'unchanged');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
