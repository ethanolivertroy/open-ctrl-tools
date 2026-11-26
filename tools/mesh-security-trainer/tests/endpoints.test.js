/**
 * HTTP-level tests for the two analysis endpoints.
 *
 * These exercise the response body the browser actually consumes -- the layer
 * where the finding-schema drift went unnoticed: /analyze returned a summary of
 * all zeros, and /analyze-content returned buckets that didn't sum to the
 * number of findings.
 *
 * The app is bound to an ephemeral port rather than pulled in via supertest, so
 * no extra dependency is needed.
 */
const fs = require('fs');
const path = require('path');
const { app, SEVERITY_LEVELS } = require('../app');

const repoFile = (...p) => path.join(__dirname, '..', ...p);

let server;
let baseUrl;

beforeAll((done) => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  server = app.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  jest.restoreAllMocks();
  server.close(done);
});

const postContent = (body) =>
  fetch(`${baseUrl}/analyze-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

async function postFile(filePath, filename = path.basename(filePath)) {
  const form = new FormData();
  const buffer = fs.readFileSync(filePath);
  form.append('meshconfig', new Blob([buffer]), filename);
  return fetch(`${baseUrl}/analyze`, { method: 'POST', body: form });
}

describe('POST /analyze-content', () => {
  test('analyzes a vulnerable Istio config and summarizes by severity', async () => {
    const content = fs.readFileSync(repoFile('public', 'samples', 'istio-vulnerable.yaml'), 'utf8');
    const res = await postContent({ content, meshType: 'istio' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.findings.length).toBeGreaterThan(0);

    // The bug: buckets were derived from NIST document numbers, so they neither
    // meant "severity" nor added up to the number of findings.
    const { critical, high, medium, low, total } = body.summary;
    expect(total).toBe(body.findings.length);
    expect(critical + high + medium + low).toBe(total);
  });

  test('every returned finding carries the fields the UI renders', async () => {
    const content = fs.readFileSync(repoFile('public', 'samples', 'consul-vulnerable.json'), 'utf8');
    const res = await postContent({ content, meshType: 'consul' });
    const { findings } = await res.json();

    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(SEVERITY_LEVELS).toContain(finding.severity);
      expect(finding.category).toBeTruthy();
      expect(finding.issue).toBeTruthy();
      expect(finding.remediation).toBeTruthy();
    }
  });

  test('NIST controls arrive as objects the UI can label', async () => {
    const content = fs.readFileSync(repoFile('public', 'samples', 'istio-vulnerable.yaml'), 'utf8');
    const res = await postContent({ content, meshType: 'istio' });
    const { findings } = await res.json();

    const withControls = findings.find((f) => f.nistControls && f.nistControls.length > 0);
    expect(withControls).toBeDefined();
    expect(withControls.nistControls[0]).toHaveProperty('id');
    expect(withControls.nistControls[0]).toHaveProperty('title');
  });

  test('rejects an empty request body', async () => {
    const res = await postContent({ content: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /analyze', () => {
  test('analyzes an uploaded config and summarizes by severity', async () => {
    const res = await postFile(repoFile('samples', 'sample-consul-config.json'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.findings.length).toBeGreaterThan(0);

    // The bug: this summary filtered on a `severity` field that the refactor
    // had removed, so it was always {0,0,0,0} no matter how many findings ran.
    const { critical, high, medium, low, total } = body.summary;
    expect(total).toBe(body.findings.length);
    expect(critical + high + medium + low).toBe(total);
    expect(critical + high).toBeGreaterThan(0);
  });

  test('rejects a request with no file', async () => {
    const res = await fetch(`${baseUrl}/analyze`, { method: 'POST', body: new FormData() });
    expect(res.status).toBe(400);
  });

  test('rejects an unsupported file type', async () => {
    const res = await postFile(repoFile('README.md'), 'README.md');
    expect(res.status).toBe(400);
  });

  test('does not leave uploaded files behind', async () => {
    const uploadsDir = repoFile('uploads');
    const before = fs.readdirSync(uploadsDir);

    // A config that parses but matches no mesh type takes an early-return path;
    // those paths used to skip cleanup and leak the temp file.
    await postFile(repoFile('package.json'), 'not-a-mesh.json');
    await postFile(repoFile('samples', 'sample-consul-config.json'));

    // unlink is async; give the event loop a tick to run the finally block.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const after = fs.readdirSync(uploadsDir);
    expect(after).toEqual(before);
  });
});
