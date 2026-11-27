export type ComparisonSection = 'good' | 'bad' | 'better';

export interface ParsedGoodBadCode {
  sharedPrelude: string | null;
  good: string | null;
  bad: string | null;
  better: string | null;
  hasLeadingContent: boolean;
}

export type GoodBadExampleMode = 'plain' | 'single-sided' | 'comparison';
export type GoodBadExampleStatus = 'good' | 'bad' | 'better';

export interface GoodBadExamplePresentation {
  mode: GoodBadExampleMode;
  status: GoodBadExampleStatus | null;
  parsed: ParsedGoodBadCode;
}

const GOOD_MARKERS = ['GOOD', 'RECOMMENDED', 'SECURE'] as const;
const BAD_MARKERS = ['BAD', 'INSECURE', 'AVOID', 'WEAK', 'VULNERABLE'] as const;
const COMPARISON_TITLE_PREFIX =
  /^(?:(?:GOOD|BAD|BETTER|RECOMMENDED|SECURE|INSECURE|AVOID|WEAK|VULNERABLE)\s+vs\s+(?:GOOD|BAD|BETTER|RECOMMENDED|SECURE|INSECURE|AVOID|WEAK|VULNERABLE)|(?:GOOD|BAD|BETTER|RECOMMENDED|SECURE|INSECURE|AVOID|WEAK|VULNERABLE))\s*:\s*/i;
const COMPARISON_TITLE_SUFFIX = /\s*\([^)]*\)\s*$/;

const COMPARISON_TITLE_OVERRIDES: Record<string, string> = {
  'ALLOW_ANY Outbound Traffic': 'Outbound Traffic Policy',
  'API Key Without Scoping': 'API Key Scope',
  'Admin Account Without Role Restrictions': 'Admin Role Scope',
  'Brute Force Protection Disabled': 'Brute Force Protection',
  'Bypass Codes Without Expiration': 'Bypass Code Lifetime',
  'Cross-Account Trust Without External ID': 'Cross-Account External ID Requirements',
  'Default Install Trust Anchor': 'Trust Anchor Lifecycle',
  'Default all-unauthenticated Without Policy': 'Inbound Authentication Policy',
  'Disabled Security Rules': 'Security Rule Enforcement',
  'Disabled Severity Threshold in CI/CD': 'CI Severity Thresholds',
  'Enable Script Checks': 'Health Check Execution Mode',
  'Excessive Sensor Exclusions': 'Sensor Exclusion Scope',
  'GITHUB_ENV Injection': 'Workflow Environment Variable Handling',
  'Global Admin Without PIM': 'Privileged Role Activation',
  'Hardcoded Secrets in Configuration': 'Secret Source Configuration',
  'Host Namespace Sharing': 'Host Namespace Isolation',
  'Ignoring Vulnerabilities Without Expiration': 'Vulnerability Ignore Lifetimes',
  'Insecure Daemon Configuration': 'Daemon Security Settings',
  'Insecure Pod Configuration': 'Pod Security Context',
  'Insecure S3 Bucket Configuration': 'S3 Bucket Security Controls',
  'Insecure S3 Bucket Policy': 'S3 Bucket Policy Scope',
  'Insecure Token Configuration': 'Token Lifetime and Rotation',
  'Legacy Authentication Not Blocked': 'Legacy Authentication Blocking',
  'Log Retention Too Short': 'Security Log Retention',
  'Minimal GITHUB_TOKEN Permissions': 'GITHUB_TOKEN Permission Scope',
  'No AuthorizationPolicy': 'Authorization Policy Enforcement',
  'No MFA Requirement for Sensitive Actions': 'MFA for Sensitive Actions',
  'No TLS for Log Forwarding': 'Log Forwarding TLS',
  'Over-Permissive Network Security Group': 'Network Security Group Scope',
  'Overly Broad Gateway Hosts': 'Gateway Host Scope',
  'Overly Broad Index Permissions': 'Index Permission Scope',
  'Overly Long Device Trust': 'Device Trust Duration',
  'Phishing-Vulnerable MFA Only': 'MFA Method Strength',
  'Permissive mTLS Mode': 'mTLS Enforcement Mode',
  'Privileged Container': 'Container Privilege Level',
  'Public Cloud Storage Bucket': 'Cloud Storage Exposure',
  'Pwn Request via pull_request_target': 'Pull Request Trigger Selection',
  'Prevention Policy in Detect-Only Mode': 'Prevention Policy Mode',
  'Real-Time Response Disabled': 'Real-Time Response',
  'Rule Leaking Secrets to Logs': 'Sensitive Data Logging in Rules',
  'Script Injection Vulnerability': 'Untrusted Input in Workflow Scripts',
  'Security Monitor Without Notification': 'Security Monitor Alerting',
  'Security Policy - Application Identification': 'Application Identification Enforcement',
  'Self-Hosted Runners on Public Repos': 'Runner Exposure Model',
  'Sensitive Data in Logs Unmasked': 'Sensitive Data Log Masking',
  'Sensor Tamper Protection Disabled': 'Sensor Tamper Protection',
  'Service Account Keys': 'Service Account Credential Type',
  'Skipped Ports Bypass Security': 'Skip Port Configuration',
  'Skipping Quality Gate in CI/CD': 'CI Quality Gate Enforcement',
  'SMS as MFA Method': 'MFA Method Selection',
  'Structured Data as Secrets': 'Secret Format and Redaction',
  'Super Admin Without MFA': 'Admin MFA Enforcement',
  'Syncing Privileged On-Prem Accounts': 'Privileged Account Sync Scope',
  'Consul Without Security': 'Consul Security Controls',
  'Enforce Severity Threshold with Audit Trail': 'Vulnerability Severity Gates',
  'IAM User with Long-Term Credentials': 'AWS Credential Strategy',
  'Insufficient Log Retention': 'Security Log Retention',
  'JWT Without Audience Validation': 'JWT Audience Validation',
  'No Path Normalization': 'Path Normalization',
  'Using Basic Roles in Production': 'IAM Role Granularity',
  'Weak Authentication Methods': 'Authentication Method Strength',
  'Weak Password Policy': 'Password Policy Strength',
  'Weak Quality Gate': 'Quality Gate Strictness',
  'Wildcard Permissions Without Conditions': 'Conditional Permission Scope',
  'hostPath Volume Mount': 'Volume Mount Isolation',
  'secrets: inherit Overexposure': 'Reusable Workflow Secret Scope',
  'toJson(secrets) Antipattern': 'Workflow Secret Passing',
};

function getComparisonSection(trimmedLine: string): ComparisonSection | null {
  const markerMatch = trimmedLine.match(
    /^(?:\/\/|#|<!--)\s*([A-Z]+)\s*:/i,
  );

  if (!markerMatch) {
    return null;
  }

  const marker = markerMatch[1].toUpperCase();
  if (GOOD_MARKERS.includes(marker as (typeof GOOD_MARKERS)[number])) {
    return 'good';
  }
  if (BAD_MARKERS.includes(marker as (typeof BAD_MARKERS)[number])) {
    return 'bad';
  }
  if (marker === 'BETTER') {
    return 'better';
  }
  return null;
}

export function parseGoodBadCode(code: string): ParsedGoodBadCode {
  const lines = code.split('\n');
  const result: ParsedGoodBadCode = {
    sharedPrelude: null,
    good: null,
    bad: null,
    better: null,
    hasLeadingContent: false,
  };

  let currentSection: ComparisonSection | null = null;
  let currentLines: string[] = [];
  const leadingLines: string[] = [];
  let sawAnySection = false;

  const saveCurrentSection = () => {
    if (!currentSection || currentLines.length === 0) {
      currentLines = [];
      return;
    }

    const content = currentLines.join('\n').trim();
    if (content) {
      result[currentSection] = content;
    }
    currentLines = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    const section = getComparisonSection(trimmedLine);

    if (section) {
      sawAnySection = true;
      if (!currentSection && leadingLines.some((entry) => entry.trim() !== '')) {
        result.hasLeadingContent = true;
      }
      saveCurrentSection();
      currentSection = section;
      currentLines.push(line);
      continue;
    }

    if (currentSection) {
      currentLines.push(line);
    } else {
      leadingLines.push(line);
    }
  }

  saveCurrentSection();

  if (sawAnySection) {
    const sharedPrelude = leadingLines.join('\n').trim();
    if (sharedPrelude) {
      result.sharedPrelude = sharedPrelude;
    }
  }

  return result;
}

export function isComparableGoodBadCode(parsed: ParsedGoodBadCode): boolean {
  return Boolean(parsed.good) && Boolean(parsed.bad);
}

export function hasGoodBadComparison(code: string): boolean {
  return isComparableGoodBadCode(parseGoodBadCode(code));
}

export function getGoodBadExamplePresentation(code: string): GoodBadExamplePresentation {
  const parsed = parseGoodBadCode(code);

  if (isComparableGoodBadCode(parsed)) {
    return {
      mode: 'comparison',
      status: null,
      parsed,
    };
  }

  if (parsed.bad && !parsed.good) {
    return {
      mode: 'single-sided',
      status: 'bad',
      parsed,
    };
  }

  if (parsed.good) {
    return {
      mode: 'single-sided',
      status: 'good',
      parsed,
    };
  }

  if (parsed.better) {
    return {
      mode: 'single-sided',
      status: 'better',
      parsed,
    };
  }

  return {
    mode: 'plain',
    status: null,
    parsed,
  };
}

export function deriveComparisonTitle(title: string): string | null {
  const normalizedTitle = title
    .replace(COMPARISON_TITLE_PREFIX, '')
    .replace(COMPARISON_TITLE_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedTitle) {
    return null;
  }

  return COMPARISON_TITLE_OVERRIDES[normalizedTitle] ?? normalizedTitle;
}

export function resolveComparisonTitle(
  title: string,
  options?: { comparisonTitle?: string; isSemanticExample?: boolean },
): string {
  if (!options?.isSemanticExample) {
    return title;
  }

  const explicitTitle = options.comparisonTitle?.trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  return deriveComparisonTitle(title) ?? title;
}
