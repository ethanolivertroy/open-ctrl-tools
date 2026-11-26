/**
 * Regression test for the silently-dropped Consul findings.
 *
 * A schema change to addFinding() left 15 ConsulSecurityAnalyzer call sites on
 * the old positional signature. The validator rejected them and `return`ed,
 * so those findings were discarded with only a console warning. The analyzer
 * reported a deliberately vulnerable Consul config as having no ACL, gossip,
 * TLS-verification or FedRAMP problems -- 12 findings, including 4 Criticals,
 * vanished from the report.
 *
 * These tests pin the specific checks that were lost.
 */
const fs = require('fs');
const path = require('path');
const { ConsulSecurityAnalyzer } = require('../app');

const vulnerableConfig = () =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'samples', 'sample-consul-config.json'), 'utf8'));

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

describe('Consul findings that were previously discarded', () => {
  let findings;

  beforeAll(() => {
    findings = new ConsulSecurityAnalyzer().analyze(vulnerableConfig());
  });

  const inCategory = (category) => findings.filter((f) => f.category === category);

  // Each of these categories was emitted entirely from the broken call sites,
  // so every one of them reported zero findings before the fix.
  test.each([
    ['Access Control', 'acl.enabled'],
    ['TLS Security', 'tls.defaults.verify_incoming'],
    ['Gossip Security', 'encrypt'],
    ['FedRAMP Compliance', null]
  ])('reports %s findings', (category) => {
    expect(inCategory(category).length).toBeGreaterThan(0);
  });

  test('flags the disabled ACL system as Critical', () => {
    const acl = findings.find((f) => f.issue === 'ACL system is not enabled');

    expect(acl).toBeDefined();
    expect(acl.severity).toBe('Critical');
    expect(acl.location).toBe('acl.enabled');
    expect(acl.nistControls).toContain('AC-3');
  });

  test('flags a weak gossip encryption key', () => {
    // The sample sets gossip.encryption.key to "short-key" -- configured, but
    // far below the 32-hex-character minimum.
    const weakKey = inCategory('Gossip Security').find((f) => /too short/i.test(f.issue));

    expect(weakKey).toBeDefined();
    expect(weakKey.severity).toBe('High');
  });

  test('flags a completely missing gossip encryption key as Critical', () => {
    const config = vulnerableConfig();
    delete config.gossip.encryption;

    const findings = new ConsulSecurityAnalyzer().analyze(config);
    const missingKey = findings.find((f) => f.category === 'Gossip Security' && f.severity === 'Critical');

    expect(missingKey).toBeDefined();
    expect(missingKey.issue).toMatch(/not configured/i);
    expect(missingKey.location).toBe('gossip.encryption.key');
  });

  test('the recovered findings carry their NIST citations', () => {
    // The fix had to reconstruct NIST metadata for these call sites; assert it
    // is actually present rather than left null.
    for (const category of ['Access Control', 'TLS Security', 'Gossip Security', 'FedRAMP Compliance']) {
      for (const finding of inCategory(category)) {
        expect(finding.nistDocument).toBeTruthy();
        expect(finding.requirement).toBeTruthy();
        expect(finding.impact).toBeTruthy();
      }
    }
  });

  test('no analyzer check is silently discarded', () => {
    // The old failure mode was invisible: findings disappeared while analysis
    // "succeeded". addFinding now throws, so a regression here fails loudly --
    // but assert the count too, so a quietly-skipped check is still caught.
    expect(findings.length).toBeGreaterThanOrEqual(25);
  });
});
