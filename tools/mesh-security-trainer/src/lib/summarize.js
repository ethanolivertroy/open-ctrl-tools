/**
 * Count findings by severity. Shared by both analysis endpoints so their
 * summaries can't drift apart.
 *
 * Every finding carries exactly one severity, so the buckets always sum to
 * `total` -- an invariant the previous NIST-document-based bucketing broke.
 */
function summarize(findings) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, total: findings.length };
  for (const finding of findings) {
    const bucket = finding.severity.toLowerCase();
    summary[bucket]++;
  }
  return summary;
}

module.exports = { summarize };
