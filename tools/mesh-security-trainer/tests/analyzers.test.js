const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  IstioSecurityAnalyzer,
  ConsulSecurityAnalyzer,
  LinkerdSecurityAnalyzer,
  BaseSecurityAnalyzer,
  summarize,
  SEVERITY_LEVELS,
  REQUIRED_FINDING_FIELDS,
  NIST_DOCUMENT_PATTERN
} = require('../app');

const repoFile = (...p) => path.join(__dirname, '..', ...p);
const loadYaml = (...p) => yaml.load(fs.readFileSync(repoFile(...p), 'utf8'));
const loadJson = (...p) => JSON.parse(fs.readFileSync(repoFile(...p), 'utf8'));

// The analyzers log progress/diagnostics to the console during analysis; keep
// test output readable without hiding real failures.
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

const ANALYZERS = [
  {
    name: 'Istio',
    Analyzer: IstioSecurityAnalyzer,
    config: () => loadYaml('samples', 'sample-meshconfig.yaml'),
    vulnerable: () => loadYaml('public', 'samples', 'istio-vulnerable.yaml')
  },
  {
    name: 'Consul',
    Analyzer: ConsulSecurityAnalyzer,
    config: () => loadJson('samples', 'sample-consul-config.json'),
    vulnerable: () => loadJson('public', 'samples', 'consul-vulnerable.json')
  },
  {
    name: 'Linkerd',
    Analyzer: LinkerdSecurityAnalyzer,
    config: () => loadYaml('samples', 'sample-linkerd-config.yaml'),
    vulnerable: () => loadYaml('public', 'samples', 'linkerd-vulnerable.yaml')
  }
];

describe('finding schema', () => {
  // This is the contract the UI renders against. It is the invariant that
  // broke when addFinding's signature changed and nothing caught it.
  test.each(ANALYZERS)('$name emits only well-formed findings', ({ Analyzer, config }) => {
    const findings = new Analyzer().analyze(config());

    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      for (const field of REQUIRED_FINDING_FIELDS) {
        expect(finding[field]).toBeTruthy();
      }
      expect(SEVERITY_LEVELS).toContain(finding.severity);
      expect(Array.isArray(finding.nistControls)).toBe(true);
      if (finding.nistDocument && finding.nistDocument !== 'Configuration Error') {
        expect(finding.nistDocument).toMatch(NIST_DOCUMENT_PATTERN);
      }
    }
  });

  test.each(ANALYZERS)('$name reports findings on its deliberately vulnerable sample', ({ Analyzer, vulnerable }) => {
    const findings = new Analyzer().analyze(vulnerable());
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.severity === 'Critical' || f.severity === 'High')).toBe(true);
  });

  test.each(ANALYZERS)('$name resets findings between analyses', ({ Analyzer, config }) => {
    const analyzer = new Analyzer();
    const first = analyzer.analyze(config()).length;
    const second = analyzer.analyze(config()).length;

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(first); // re-analysing must not accumulate

    analyzer.reset();
    expect(analyzer.findings).toHaveLength(0);
  });

  test.each(ANALYZERS)('$name flags an empty configuration rather than passing it', ({ Analyzer }) => {
    const findings = new Analyzer().analyze(null);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[0].category).toBe('File Format');
  });
});

describe('addFinding', () => {
  let analyzer;
  beforeEach(() => {
    analyzer = new BaseSecurityAnalyzer();
  });

  test('records a finding with every field it was given', () => {
    analyzer.addFinding({
      id: 'test.mtls-disabled',
      severity: 'High',
      category: 'mTLS',
      issue: 'mTLS is disabled',
      impact: 'Traffic can be intercepted',
      requirement: 'Section 4.1 requires mTLS',
      remediation: 'Set meshMTLS.enabled: true',
      nistDocument: 'NIST SP 800-204B',
      section: 'Section 4.1',
      location: 'meshMTLS.enabled',
      nistControls: ['SC-8']
    });

    expect(analyzer.findings).toHaveLength(1);
    expect(analyzer.findings[0]).toMatchObject({
      id: 'test.mtls-disabled',
      severity: 'High',
      category: 'mTLS',
      issue: 'mTLS is disabled',
      remediation: 'Set meshMTLS.enabled: true',
      nistDocument: 'NIST SP 800-204B',
      location: 'meshMTLS.enabled',
      nistControls: ['SC-8']
    });
  });

  test('defaults the optional NIST metadata', () => {
    analyzer.addFinding({
      id: 'test.low-sampling',
      severity: 'Low',
      category: 'Telemetry',
      issue: 'Tracing sampling rate is low',
      remediation: 'Raise the sampling rate'
    });

    expect(analyzer.findings[0]).toMatchObject({
      nistDocument: null,
      section: null,
      location: null,
      nistControls: []
    });
  });

  // These throw rather than silently dropping. A dropped finding is how the
  // analyzer previously reported vulnerable Consul configs as clean.
  test.each(REQUIRED_FINDING_FIELDS)('throws when %s is missing', (field) => {
    const finding = {
      id: 'test.mtls-disabled',
      severity: 'High',
      category: 'mTLS',
      issue: 'mTLS is disabled',
      remediation: 'Enable mTLS'
    };
    delete finding[field];

    expect(() => analyzer.addFinding(finding)).toThrow(new RegExp(field));
    expect(analyzer.findings).toHaveLength(0);
  });

  test('throws on an unknown severity instead of accepting it', () => {
    expect(() =>
      analyzer.addFinding({
        id: 'test.mtls-disabled',
        severity: 'Catastrophic',
        category: 'mTLS',
        issue: 'mTLS is disabled',
        remediation: 'Enable mTLS'
      })
    ).toThrow(/invalid severity/i);
    expect(analyzer.findings).toHaveLength(0);
  });

  test('throws on a malformed NIST document reference', () => {
    expect(() =>
      analyzer.addFinding({
        id: 'test.mtls-disabled',
        severity: 'High',
        category: 'mTLS',
        issue: 'mTLS is disabled',
        remediation: 'Enable mTLS',
        nistDocument: 'High' // the exact bug: a severity passed where a document belongs
      })
    ).toThrow(/invalid NIST document/i);
    expect(analyzer.findings).toHaveLength(0);
  });

  test('resolves NIST control IDs to full control objects for the UI', () => {
    analyzer.addFinding({
      id: 'test.acl-disabled',
      severity: 'Critical',
      category: 'Access Control',
      issue: 'ACL system is not enabled',
      remediation: 'Enable ACLs',
      nistControls: ['AC-3', 'ZZ-99'] // one known, one not in the catalog
    });

    const [finding] = analyzer.getEnrichedFindings();
    expect(finding.nistControls[0]).toMatchObject({ id: 'AC-3', title: 'Access Enforcement' });
    // Unknown IDs degrade gracefully rather than vanishing from the report.
    expect(finding.nistControls[1]).toMatchObject({ id: 'ZZ-99', title: 'ZZ-99' });
  });
});

describe('every check an analyzer defines is actually wired into analyze()', () => {
  // LinkerdSecurityAnalyzer.checkTLS() was fully implemented but never called,
  // so Linkerd TLS problems -- including a Critical "TLS is not enabled" --
  // could never be reported. An unwired check is just as invisible as a
  // silently dropped finding, so assert the wiring directly.
  test.each(ANALYZERS)('$name calls every check* method it defines', ({ Analyzer }) => {
    const analyzer = new Analyzer();
    const checkMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(analyzer))
      .filter((name) => name.startsWith('check'));

    expect(checkMethods.length).toBeGreaterThan(0);

    const called = new Set();
    for (const name of checkMethods) {
      jest.spyOn(analyzer, name).mockImplementation(() => called.add(name));
    }

    // A config that reaches the check phase rather than bailing out early.
    analyzer.analyze(ANALYZERS.find((a) => a.Analyzer === Analyzer).config());

    expect([...checkMethods].sort()).toEqual([...called].sort());
  });
});

describe('NIST document references', () => {
  test.each([
    'NIST SP 800-204B',
    'NIST SP 800-52 Rev 2',
    'NIST SP 800-57',
    'NIST SP 800-207',
    'NIST SP 800-81 Rev 3', // multi-part / revision number -- rejecting this threw a 500
    'NIST SP 800-81-2 Rev 1' // the withdrawn form must still parse; the pattern is syntactic
  ])('%s is accepted', (doc) => {
    expect(doc).toMatch(NIST_DOCUMENT_PATTERN);
  });

  test.each(['High', 'Critical', 'SP 800-204B', 'NIST 800-204B', ''])('%s is rejected', (doc) => {
    expect(doc).not.toMatch(NIST_DOCUMENT_PATTERN);
  });

  test('a config that triggers a revised NIST citation analyzes without throwing', () => {
    // Istio's DNS checks cite NIST SP 800-81 Rev 3. A stricter pattern made
    // this legitimate, flat MeshConfig 500 instead of reporting the finding.
    const config = {
      kind: 'MeshConfig',
      apiVersion: 'networking.istio.io/v1alpha1',
      defaultConfig: { proxyMetadata: { DNS_CAPTURE: 'false' } }
    };

    const findings = new IstioSecurityAnalyzer().analyze(config);
    const dns = findings.find((f) => f.nistDocument === 'NIST SP 800-81 Rev 3');

    expect(dns).toBeDefined();
    expect(dns.issue).toMatch(/DNS/i);
  });
});

describe('summarize', () => {
  test('counts each severity and always sums to the total', () => {
    const findings = [
      { severity: 'Critical' }, { severity: 'Critical' },
      { severity: 'High' }, { severity: 'Medium' }, { severity: 'Low' }
    ];

    expect(summarize(findings)).toEqual({ critical: 2, high: 1, medium: 1, low: 1, total: 5 });
  });

  test('buckets sum to the total for real analyzer output', () => {
    // The previous NIST-document-based summary silently omitted findings whose
    // document fell outside its hardcoded buckets.
    for (const { Analyzer, config } of ANALYZERS) {
      const findings = new Analyzer().analyze(config());
      const { critical, high, medium, low, total } = summarize(findings);

      expect(critical + high + medium + low).toBe(total);
      expect(total).toBe(findings.length);
    }
  });

  test('handles a clean configuration', () => {
    expect(summarize([])).toEqual({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  });
});
