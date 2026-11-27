// Trust Center component suggestions for FedRAMP 20x Key Security Indicators (KSIs)
// Maps each KSI to trust center components a CSP should publish to express compliance posture

import type { TrustCenterCategory, TrustCenterCategoryMeta, TrustCenterComponent, KSITrustCenterMapping } from './types';

// ============================================================================
// Category Metadata
// ============================================================================

export const TRUST_CENTER_CATEGORIES: TrustCenterCategoryMeta[] = [
  { id: 'documents-reports', name: 'Documents & Reports', color: 'blue' },
  { id: 'policies', name: 'Policies', color: 'indigo' },
  { id: 'certifications-badges', name: 'Certifications & Badges', color: 'emerald' },
  { id: 'architecture-diagrams', name: 'Architecture & Diagrams', color: 'purple' },
  { id: 'dashboards', name: 'Dashboards', color: 'cyan' },
  { id: 'product-security-features', name: 'Product Security Features', color: 'green' },
  { id: 'evidence-artifacts', name: 'Evidence Artifacts', color: 'amber' },
  { id: 'questionnaire-responses', name: 'Questionnaire Responses', color: 'rose' },
  { id: 'vendor-supply-chain', name: 'Vendor & Supply Chain', color: 'orange' },
  { id: 'processes-procedures', name: 'Processes & Procedures', color: 'slate' },
];

// ============================================================================
// KSI → Trust Center Component Mappings
// ============================================================================

const KSI_TRUST_CENTER_DATA: KSITrustCenterMapping[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // CMT — Change Management Family (4 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-CMT-LMC',
    implementationInsight: 'Mature implementations express change management through GitOps-tracked workflows — branch protection enforcing approval requirements, automated security checks gating merges, and change history dashboards showing commit activity, PR merge rates, and governance health metrics as first-class security indicators. The change management policy becomes an artifact of the enforcement rules, not a standalone document.',
    components: [
      { name: 'Change History Dashboard', category: 'dashboards', description: 'Dashboard expressing change management posture — change volume, approval rates, rollback metrics, and governance health as live indicators', examples: ['ServiceNow', 'Jira Service Management', 'GitHub Insights'], evidenceExamples: ['Commit frequency and PR merge rate', 'Change approval turnaround time', 'Emergency change percentage'], validationHint: 'Automated: SCM APIs verify approval workflows are enforced on all production changes' },
      { name: 'Change Policy Enforcement', category: 'product-security-features', description: 'Automated enforcement of change management rules — validates changes follow approved processes before deployment', examples: ['GitHub branch protection', 'GitLab merge request approvals', 'OPA/Rego policies', 'ArgoCD sync policies'], validationHint: 'Automated: Policy engine logs show enforcement decisions and violations' },
      { name: 'Change Advisory Board Process', category: 'processes-procedures', description: 'How changes are reviewed for security impact — including CAB process and automated triage for standard vs. emergency changes' },
      { name: 'Change Management Policy', category: 'policies', description: 'Human-readable documentation of the organization\'s change management approach — the "why" behind automated enforcement', validationHint: 'Manual: Auditor samples recent changes to verify policy adherence' },
    ],
  },
  {
    ksiId: 'KSI-CMT-RMV',
    implementationInsight: 'Mature implementations express release management through pipeline observability — build success rates, security gate pass rates, and mean time from commit to production as dashboard metrics. CI/CD pipelines enforce security gates automatically, with deployment artifacts signed and provenance tracked via SLSA or equivalent frameworks.',
    components: [
      { name: 'Deployment Pipeline Architecture', category: 'architecture-diagrams', description: 'CI/CD pipeline expressing security gates, automated testing, and approval workflows at each stage', examples: ['GitHub Actions', 'GitLab CI', 'Jenkins'], evidenceExamples: ['Security gate pass/fail rates', 'Build-to-deploy cycle time', 'Automated test coverage percentage'], validationHint: 'Automated: CI/CD platform APIs verify security gates are active and enforced' },
      { name: 'Release Pipeline Enforcement', category: 'product-security-features', description: 'Automated enforcement of release gates — security scans, test suites, and approval requirements enforced before production deployment', examples: ['GitHub Actions required checks', 'GitLab pipeline rules', 'Sentinel policies', 'Conftest'], validationHint: 'Automated: Pipeline logs show gate enforcement and blocked deployments' },
      { name: 'Release Notes Archive', category: 'documents-reports', description: 'Release notes with security-relevant changes highlighted — generated from commit history and PR descriptions' },
      { name: 'Release Management Process', category: 'policies', description: 'Human-readable release management procedures including approval gates, testing, and rollback procedures' },
    ],
  },
  {
    ksiId: 'KSI-CMT-RVP',
    implementationInsight: 'Mature implementations express rollback capability through deployment metrics — success rates, rollback frequency, and mean time to recovery as dashboard indicators. Automated rollback triggers fire on health check failures, and every rollback is logged with decision criteria, creating an immutable audit trail of operational recovery.',
    components: [
      { name: 'Deployment Success Metrics', category: 'dashboards', description: 'Dashboard expressing deployment health — success rates, rollback frequency, and mean time to recovery as live indicators of operational maturity', evidenceExamples: ['Deployment success/failure ratio', 'Mean time to rollback', 'Rollback frequency trend'] },
      { name: 'Rollback and Recovery Procedures', category: 'processes-procedures', description: 'How failed changes are detected and reverted — including automated rollback triggers and decision criteria', validationHint: 'Manual: Review recent rollback incidents to verify procedures were followed' },
      { name: 'Change Failure Impact Analysis', category: 'documents-reports', description: 'Historical analysis of change failures and lessons learned' },
    ],
  },
  {
    ksiId: 'KSI-CMT-VTD',
    implementationInsight: 'Mature implementations express testing rigor through pipeline metrics — unit, integration, security, and acceptance test pass rates published as dashboard indicators. Test gates are enforced in CI/CD pipelines, with coverage thresholds blocking deployment when testing falls below acceptable levels.',
    components: [
      { name: 'Test Coverage Reports', category: 'evidence-artifacts', description: 'Automated testing coverage reports expressing validation rigor — generated from CI/CD pipelines with pass rates and coverage metrics', evidenceExamples: ['Unit/integration/security test pass rates', 'Code coverage percentages', 'Security scan results per release'], validationHint: 'Automated: CI/CD APIs verify test suites ran and passed before deployment' },
      { name: 'Pre-Production Environment Architecture', category: 'architecture-diagrams', description: 'Architecture expressing staging/pre-prod environments used for change validation — shows environment parity with production' },
      { name: 'Testing and Validation Framework', category: 'processes-procedures', description: 'How changes are validated before production deployment — testing pyramid, security scan requirements, and acceptance criteria' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CNA — Continuity Family (8 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-CNA-DFP',
    implementationInsight: 'Mature implementations express data flows through interactive architecture diagrams — a 4-stage digital data lifecycle (Ingress, Processing, Storage, Egress) with encryption status at each stage, specific data elements tracked per flow, and processing location metadata. Data flow documentation is derived from IaC and service mesh configurations rather than manually drawn diagrams.',
    components: [
      { name: 'Data Flow and Processing Architecture', category: 'architecture-diagrams', description: 'Architecture expressing how customer data flows through the system — including processing locations, encryption status per stage, and data element tracking', evidenceExamples: ['4-stage data lifecycle diagram (Ingress/Processing/Storage/Egress)', 'Encryption status per data flow stage', 'Data elements inventory per flow'], validationHint: 'Manual: 3PAO traces actual data flows against documented paths' },
      { name: 'Data Residency Information', category: 'product-security-features', description: 'Where customer data is stored and processed — data residency options and geographic constraints as a product feature' },
      { name: 'Data Processing Agreement', category: 'documents-reports', description: 'DPA covering data handling, processing purposes, and retention' },
    ],
  },
  {
    ksiId: 'KSI-CNA-EIS',
    implementationInsight: 'Mature implementations express infrastructure resilience through certifications backed by monitoring data — data center tier ratings validated by environmental monitoring dashboards, physical access audit trails, and redundancy architecture that shows actual failover capabilities rather than just design intent.',
    components: [
      { name: 'Data Center Certifications', category: 'certifications-badges', description: 'SOC 2 Type II, ISO 27001 certifications for data center facilities — third-party validated infrastructure controls', examples: ['SOC 2 Type II', 'ISO 27001', 'SSAE 18'], validationHint: 'Automated: Certificate registry lookup verifies SOC 2 and ISO 27001 validity' },
      { name: 'Infrastructure Redundancy Architecture', category: 'architecture-diagrams', description: 'Architecture expressing infrastructure redundancy, failover paths, and geographic distribution' },
      { name: 'Environmental and Infrastructure Protections', category: 'documents-reports', description: 'Physical and environmental controls protecting infrastructure — data center tier classification and monitoring metrics', evidenceExamples: ['Data center tier classification', 'Environmental monitoring metrics (temp/humidity/power)', 'Physical access control logs summary'] },
    ],
  },
  {
    ksiId: 'KSI-CNA-IBP',
    implementationInsight: 'Mature implementations express backup reliability through operational dashboards — success rates, RPO/RTO compliance, and recovery test results as live metrics. Backup platforms report status via API, with failures triggering automated alerts. The backup policy becomes an artifact of the automated backup configuration, not the source of truth.',
    components: [
      { name: 'Backup Success Dashboard', category: 'dashboards', description: 'Dashboard expressing backup health — success rates, RPO/RTO compliance, and recovery test results as live indicators', examples: ['Veeam', 'Rubrik', 'Cloud-native backup'], evidenceExamples: ['Daily backup success/failure rates', 'RPO/RTO compliance metrics', 'Last successful recovery test date and results'], validationHint: 'Automated: Backup platform APIs verify successful completion and retention compliance' },
      { name: 'Recovery Testing Reports', category: 'evidence-artifacts', description: 'Recovery test results demonstrating RPO/RTO objectives are met — evidence that backups actually work' },
      { name: 'Backup and Recovery Policy', category: 'policies', description: 'Human-readable backup policy covering frequency, retention, encryption, and geographic separation — documents the intent behind automated backup configurations' },
    ],
  },
  {
    ksiId: 'KSI-CNA-MAT',
    implementationInsight: 'Mature implementations express availability through live uptime dashboards — synthetic monitoring feeding SLA compliance metrics continuously, with historical data showing trend lines over months and years. Availability becomes a continuously verified property with transparent incident impact tracking, not just a contractual number in an SLA document.',
    components: [
      { name: 'Uptime and Availability Dashboard', category: 'dashboards', description: 'Dashboard expressing availability posture — uptime metrics, SLA compliance trends, and incident impact as live indicators', examples: ['Statuspage.io', 'Datadog', 'Pingdom'], evidenceExamples: ['Monthly/quarterly uptime percentages', 'SLA compliance trend', 'Incident count affecting availability'], validationHint: 'Automated: Synthetic monitoring verifies endpoint availability and response times' },
      { name: 'Service Level Agreements', category: 'documents-reports', description: 'Published SLAs for availability, performance, and support response times' },
      { name: 'Maintenance Window Policy', category: 'policies', description: 'Human-readable maintenance window schedule and notification procedures' },
    ],
  },
  {
    ksiId: 'KSI-CNA-OFA',
    implementationInsight: 'Mature implementations express disaster recovery capability through test results — actual recovery times versus targets from periodic failover exercises, documented as measurable evidence. DR plans are validated through automation (chaos engineering, game days) rather than just tabletop exercises, and failover metrics are tracked as dashboard indicators.',
    components: [
      { name: 'High Availability Architecture', category: 'architecture-diagrams', description: 'Architecture expressing failover mechanisms, redundancy layers, and recovery paths — shows actual configuration, not just design intent', evidenceExamples: ['Active-active/active-passive configuration details', 'Failover time measurements from last test', 'Geographic distribution of redundancy'] },
      { name: 'Failover Success Metrics', category: 'dashboards', description: 'Dashboard expressing DR readiness — failover test results, recovery times, and resilience metrics from automated testing' },
      { name: 'DR Test Results', category: 'evidence-artifacts', description: 'Disaster recovery test results including actual vs. target recovery times — evidence that DR plans translate into operational capability', validationHint: 'Manual: Review DR test reports for actual vs. target recovery times' },
      { name: 'Disaster Recovery Plan Summary', category: 'documents-reports', description: 'DR plan summary including RTO/RPO targets and recovery procedures' },
    ],
  },
  {
    ksiId: 'KSI-CNA-RNT',
    implementationInsight: 'Mature implementations express network resilience through redundancy metrics and chaos engineering results — not just network architecture diagrams. Automated failure injection testing validates redundant paths, and network monitoring dashboards show real-time availability across all network segments.',
    components: [
      { name: 'Network Architecture Diagram', category: 'architecture-diagrams', description: 'Network topology expressing segmentation, redundancy, and traffic flow patterns', evidenceExamples: ['Redundant path topology', 'BGP/routing failover configuration', 'Network segment isolation boundaries'] },
      { name: 'Network Availability Metrics', category: 'dashboards', description: 'Dashboard expressing network health — uptime, latency, throughput, and redundancy status across all segments' },
      { name: 'Network Resilience Testing', category: 'evidence-artifacts', description: 'Chaos engineering or failure injection test results — evidence that resilience is tested, not just designed', examples: ['Chaos Monkey', 'Gremlin', 'Litmus'], validationHint: 'Manual: Review chaos engineering test results and network failover measurements' },
    ],
  },
  {
    ksiId: 'KSI-CNA-RVP',
    implementationInsight: 'Mature implementations express patch management through compliance dashboards — SLA adherence by severity level, overdue patch counts, and deployment success rates as live metrics. Automated patching pipelines handle routine updates, with policy engines enforcing patch windows and pre-deployment testing requirements.',
    components: [
      { name: 'Patch Compliance Dashboard', category: 'dashboards', description: 'Dashboard expressing patch posture — compliance percentages by severity, overdue patches, and remediation velocity as live indicators', examples: ['Qualys', 'Rapid7', 'Tanium'], evidenceExamples: ['Patch SLA compliance by severity (Critical/High/Medium/Low)', 'Overdue patch count and aging', 'Patch deployment success rate'], validationHint: 'Automated: Vulnerability management APIs verify patch deployment status and SLA compliance' },
      { name: 'Patch Testing Procedures', category: 'processes-procedures', description: 'How patches are tested and validated before production deployment — including automated testing in staging environments' },
      { name: 'Patch Management Policy', category: 'policies', description: 'Human-readable patch management policy with SLAs for critical, high, and routine patches — documents intent behind automated patching' },
    ],
  },
  {
    ksiId: 'KSI-CNA-ULN',
    implementationInsight: 'Mature implementations express software lifecycle management through SBOM-driven inventories — automated component scanning identifying EOL software, with lifecycle dashboards showing version currency across the stack. Software inventory is derived from build manifests and runtime discovery rather than manually maintained spreadsheets.',
    components: [
      { name: 'SBOM (Software Bill of Materials)', category: 'evidence-artifacts', description: 'Machine-readable SBOM expressing software components, versions, and known vulnerabilities — generated from build pipelines', examples: ['SPDX', 'CycloneDX'], validationHint: 'Automated: SBOM tools verify component versions against known EOL databases' },
      { name: 'Software Inventory and Lifecycle Status', category: 'documents-reports', description: 'Inventory of major software components with support status and planned upgrades — derived from SBOM analysis', evidenceExamples: ['Component version vs. latest available', 'End-of-support dates per component', 'Planned upgrade timeline'] },
      { name: 'End-of-Life Software Policy', category: 'policies', description: 'Human-readable policy for managing unsupported and end-of-life software components' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CED — Cybersecurity Education (1 KSI)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-CED-RAT',
    implementationInsight: 'Mature implementations express training effectiveness as measured outcomes rather than completion checkboxes — LMS APIs feeding completion and assessment-score dashboards per audience (all employees, high-risk roles, engineering, response/recovery staff), phishing simulation results trending over time, and role-specific curricula reviewed against incident root causes. Training review becomes a continuous feedback loop instead of an annual attestation.',
    components: [
      { name: 'Training Completion Dashboard', category: 'dashboards', description: 'Dashboard expressing training posture across all audiences — completion rates, assessment scores, and overdue assignments segmented by role (general, high-risk, development, incident response)', examples: ['KnowBe4 reporting', 'LMS analytics (Docebo, Absorb)', 'Custom GRC training view'], validationHint: 'Automated: LMS APIs verify completion rates and assessment scores per audience segment' },
      { name: 'Training Records Archive', category: 'evidence-artifacts', description: 'Auditable records of who completed which training and when — including role-specific modules and remediation retraining', evidenceExamples: ['Completion certificates by audience', 'Assessment score distributions', 'Phishing simulation click-rate trends'] },
      { name: 'Role-Based Curriculum Documentation', category: 'documents-reports', description: 'Curriculum map showing which training each role receives — general awareness, high-risk role modules, secure development for engineers, and incident response/disaster recovery exercises' },
      { name: 'Training Effectiveness Review Process', category: 'processes-procedures', description: 'How training effectiveness is persistently reviewed — metrics reviewed, cadence, and how findings (incidents, phishing results) feed curriculum updates' },
      { name: 'Security Awareness and Training Policy', category: 'policies', description: 'Human-readable policy defining training requirements per audience and review cadence — the intent behind automated tracking and effectiveness measurement' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // IAM — Identity and Access Management Family (6 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-IAM-AAM',
    implementationInsight: 'Mature implementations express access governance through automated IAM pipelines — RBAC/ABAC models enforced by identity platforms, access reviews triggered automatically on schedule, orphaned accounts detected and flagged by identity governance tools, and access review completion tracked as a dashboard metric. The access management policy becomes documentation of the automated enforcement model.',
    components: [
      { name: 'RBAC/ABAC Model Documentation', category: 'product-security-features', description: 'How the access control model is implemented and enforced — role-based or attribute-based controls as a product feature', validationHint: 'Automated: IAM APIs verify role assignments match documented model' },
      { name: 'Access Policy Enforcement', category: 'product-security-features', description: 'Automated enforcement of access policies — provisioning, deprovisioning, and access review workflows driven by identity governance platforms', examples: ['Okta lifecycle management', 'SailPoint IdentityNow', 'Azure AD access reviews', 'OPA/Rego IAM policies'], validationHint: 'Automated: Identity platform APIs verify provisioning/deprovisioning workflows are active' },
      { name: 'Identity Provider Integration', category: 'product-security-features', description: 'Supported identity providers and SSO integration options — federated identity as a product feature', examples: ['Okta', 'Azure AD', 'Ping Identity'] },
      { name: 'Access Review Cadence', category: 'processes-procedures', description: 'How access reviews are conducted — cadence, scope, and escalation for quarterly privileged access reviews' },
      { name: 'Access Management Policy', category: 'policies', description: 'Human-readable access management policy covering provisioning, review, and deprovisioning — documents intent behind automated IAM enforcement', evidenceExamples: ['Provisioning/deprovisioning workflow documentation', 'Access review completion rates', 'Orphaned account metrics'] },
    ],
  },
  {
    ksiId: 'KSI-IAM-APM',
    implementationInsight: 'Mature implementations express privileged access management through session-level visibility — PAM platforms recording every privileged session, credential vaults enforcing checkout/checkin workflows, and admin access dashboards showing usage patterns and anomaly detection. Every privileged action is monitored and reviewable through automated audit trails.',
    components: [
      { name: 'Privileged Access Architecture', category: 'architecture-diagrams', description: 'Architecture expressing PAM solution design — jump servers, session recording, credential vaulting, and break-glass procedures', examples: ['CyberArk', 'BeyondTrust', 'Delinea'], evidenceExamples: ['PAM solution architecture with session recording', 'Credential vault access patterns', 'Break-glass procedure documentation'] },
      { name: 'Admin Access Audit Dashboard', category: 'dashboards', description: 'Dashboard expressing privileged access posture — usage patterns, session recordings, credential rotation, and anomaly detection', validationHint: 'Automated: PAM platform APIs verify session recording is active and credentials are rotated' },
      { name: 'Privileged Access Management Policy', category: 'policies', description: 'Human-readable PAM policy covering privileged account controls, monitoring, and session management' },
    ],
  },
  {
    ksiId: 'KSI-IAM-ELP',
    implementationInsight: 'Mature implementations express least privilege through automated enforcement — default-deny IAM policies, permission boundaries enforced by cloud IAM, and privilege escalation monitoring feeding SIEM dashboards. Least privilege becomes a measurable, continuously monitored property with enforcement metrics rather than a documented policy aspiration.',
    components: [
      { name: 'Least Privilege Implementation', category: 'product-security-features', description: 'How least privilege is enforced across the platform — default-deny policies, permission boundaries, and automated enforcement mechanisms', evidenceExamples: ['Default-deny policy documentation', 'Permission boundary configuration', 'Privilege escalation attempt logs'] },
      { name: 'Privilege Escalation Monitoring', category: 'dashboards', description: 'Dashboard expressing privilege boundary health — escalation attempts, unauthorized access patterns, and permission drift detection', validationHint: 'Automated: SIEM rules detect and alert on unauthorized privilege escalation attempts' },
      { name: 'Least Privilege Policy Enforcement', category: 'product-security-features', description: 'Automated enforcement of permission boundaries — policy engines preventing over-provisioned roles from being assigned', examples: ['AWS IAM permission boundaries', 'Azure AD PIM', 'OPA/Rego IAM policies', 'Kyverno'], validationHint: 'Automated: IAM policy analysis tools verify no roles exceed documented maximum privilege levels' },
      { name: 'Permission Boundary Documentation', category: 'documents-reports', description: 'Permission boundaries and maximum privilege levels by role' },
    ],
  },
  {
    ksiId: 'KSI-IAM-JIT',
    implementationInsight: 'Mature implementations express JIT access through measurable metrics — average approval time, access duration, and auto-revocation rates tracked as dashboard indicators. PAM platforms enforce bounded duration and auto-expiration, with every JIT session logged and revocation verified automatically.',
    components: [
      { name: 'Just-in-Time Access Documentation', category: 'product-security-features', description: 'How JIT access provisioning works — automatic expiration, approval workflows, and bounded duration as product features', examples: ['CyberArk', 'Azure PIM', 'Britive'], evidenceExamples: ['Average JIT access approval time', 'Access duration distribution', 'Auto-revocation compliance rate'] },
      { name: 'Temporary Access Metrics', category: 'dashboards', description: 'Dashboard expressing JIT access posture — request volumes, approval times, and expiration compliance as live indicators', validationHint: 'Automated: PAM APIs verify JIT access requests have bounded duration and auto-expire' },
      { name: 'JIT Access Workflow', category: 'processes-procedures', description: 'How JIT access is requested, approved, and automatically revoked — the workflow behind the metrics' },
    ],
  },
  {
    ksiId: 'KSI-IAM-SNU',
    implementationInsight: 'Mature implementations express non-human identity governance through automated monitoring — service account usage patterns tracked by identity governance platforms, credential age dashboards flagging rotation overdue, and anomalous behavior detection treating machine identities with the same rigor as human accounts. Non-human identity sprawl becomes a measurable, managed metric.',
    components: [
      { name: 'Non-Human Identity Monitoring', category: 'dashboards', description: 'Dashboard expressing non-human identity posture — service account usage patterns, credential age, anomalous behavior, and ownership coverage', examples: ['Astrix Security', 'Silverfort'], validationHint: 'Automated: Identity governance tools verify service account credential rotation and usage patterns' },
      { name: 'Service Account Inventory', category: 'documents-reports', description: 'Service account governance inventory — ownership, classification, credential rotation schedules, and usage patterns', evidenceExamples: ['Service account count by classification', 'Credential age distribution', 'Ownership assignment coverage'] },
      { name: 'Service Account Management Policy', category: 'policies', description: 'Human-readable policy for managing non-human identities — documents governance intent behind automated monitoring' },
    ],
  },
  {
    ksiId: 'KSI-IAM-SUS',
    implementationInsight: 'Mature implementations express separation of duties through automated enforcement — IAM platforms detecting SoD conflicts during role assignment, policy engines preventing incompatible role combinations, and conflict detection metrics tracked as dashboard indicators. Role conflicts are prevented by design through technical controls, not just policy.',
    components: [
      { name: 'Role Conflict Detection', category: 'product-security-features', description: 'Automated SoD conflict detection and enforcement — IAM platform prevents incompatible role assignments in real time', validationHint: 'Automated: IAM platform detects SoD violations in real-time during role assignment' },
      { name: 'Separation of Duties Matrix', category: 'documents-reports', description: 'SoD matrix expressing incompatible roles and how conflicts are prevented — reference for automated enforcement rules', evidenceExamples: ['Role incompatibility matrix', 'Conflict detection alert count', 'Exception approval workflow documentation'] },
      { name: 'SoD Compliance Reports', category: 'evidence-artifacts', description: 'SoD compliance reports showing violation status and remediation — generated from IAM platform enforcement data' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // INR — Incident Response Family (3 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-INR-AAR',
    implementationInsight: 'Mature implementations express incident response capability through measurable metrics — KSI failure tracking with MTTR per indicator, IR exercise results with actual response times, and improvement implementation tracked as backlog items. Incident response becomes a continuously measured capability backed by SOAR platform data, not a static plan document.',
    components: [
      { name: 'Incident Response Plan Summary', category: 'documents-reports', description: 'IR plan summary expressing roles, escalation paths, and communication procedures — backed by SOAR platform workflows', evidenceExamples: ['IR team structure and on-call rotation', 'Escalation path by severity level', 'Communication template samples'] },
      { name: 'Incident History and Lessons Learned', category: 'evidence-artifacts', description: 'Anonymized incident summaries expressing response effectiveness and improvements — evidence of a learning organization', validationHint: 'Manual: Auditor reviews incident post-mortems for completeness and improvement tracking' },
      { name: 'IR Tabletop Exercise Reports', category: 'evidence-artifacts', description: 'IR exercise results with actual vs. expected response times and improvement findings' },
    ],
  },
  {
    ksiId: 'KSI-INR-RIR',
    implementationInsight: 'Mature implementations express detection and response capability through MTTD/MTTR dashboards — SIEM/SOAR platforms feeding metrics continuously, incident volumes tracked by severity and category, and false positive rates showing tuning effectiveness. Detection and response maturity becomes a visible, measurable property.',
    components: [
      { name: 'Incident Response Metrics', category: 'dashboards', description: 'Dashboard expressing detection and response capability — MTTD, MTTR, incident volumes by severity, and resolution trends', evidenceExamples: ['MTTD trend by severity', 'MTTR trend by severity', 'Incident volume by category', 'False positive rate'], validationHint: 'Automated: SIEM/SOAR APIs verify incident detection and resolution timestamps' },
      { name: 'Incident Classification Framework', category: 'processes-procedures', description: 'How incidents are classified — severity levels, response requirements, and escalation criteria' },
      { name: 'IR Capability Certifications', category: 'certifications-badges', description: 'Team certifications and third-party IR retainer agreements — external validation of response capability', examples: ['SANS GIAC', 'IR retainer with CrowdStrike/Mandiant'] },
    ],
  },
  {
    ksiId: 'KSI-INR-RPI',
    implementationInsight: 'Mature implementations express continuous improvement through tracked post-incident reviews — PIR recommendations tracked as backlog items with implementation dates, improvement velocity measured over time, and playbooks updated automatically based on lessons learned. This demonstrates a learning organization, not just an incident-handling one.',
    components: [
      { name: 'Post-Incident Review Process', category: 'processes-procedures', description: 'How lessons are captured and improvements tracked — PIR process with recommendation tracking and implementation verification', evidenceExamples: ['PIR template with required fields', 'Improvement implementation tracking', 'Time-to-implementation for recommendations'] },
      { name: 'Incident Improvement Tracking', category: 'documents-reports', description: 'Tracking of post-incident improvements and their implementation status — evidence that recommendations lead to action', validationHint: 'Manual: Auditor reviews improvement backlog to verify recommendations are tracked to completion' },
      { name: 'Incident Response Playbooks', category: 'documents-reports', description: 'Playbook summaries for common incident types — structured response procedures updated based on PIR findings' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MLA — Monitoring/Logging/Auditing Family (5 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-MLA-ALA',
    implementationInsight: 'Mature implementations express audit log integrity through technical controls — immutable storage with hash chain verification, CloudTrail digest validation, and log pipeline architecture showing collection-to-analysis flow. Log tamper-proofing becomes a verifiable property checked by automated integrity validation, not just a stated commitment in a policy document.',
    components: [
      { name: 'Audit Log Architecture', category: 'architecture-diagrams', description: 'Architecture expressing log collection, aggregation, storage, and analysis pipeline — shows how integrity is maintained at each stage', examples: ['Splunk', 'Elastic', 'Sumo Logic'], evidenceExamples: ['Log pipeline diagram (collection\u2192aggregation\u2192storage\u2192analysis)', 'Log volume metrics', 'Storage tier with retention periods'] },
      { name: 'Log Integrity Protections', category: 'product-security-features', description: 'How audit logs are protected from tampering — immutable storage, hash chains, and automated integrity verification', validationHint: 'Automated: CloudTrail digest validation or equivalent verifies log integrity' },
      { name: 'Audit Logging Policy', category: 'policies', description: 'Human-readable audit logging policy covering event types, retention periods, and tamper protection — documents intent behind log pipeline architecture' },
    ],
  },
  {
    ksiId: 'KSI-MLA-EVC',
    implementationInsight: 'Mature implementations express evidence collection through automated GRC pipelines — machine-generated evidence covering 80%+ of controls, coverage metrics tracked as dashboard indicators, and evidence freshness verified automatically. Per ADS-CSO-CBF, automation must ensure consistency between formats — evidence repositories should generate both human-readable and machine-readable outputs.',
    components: [
      { name: 'Compliance Evidence Repository', category: 'evidence-artifacts', description: 'Centralized evidence repository expressing compliance posture — automated collection with chain of custody and coverage metrics', examples: ['Drata', 'Vanta', 'Anecdotes', 'Tugboat Logic'], evidenceExamples: ['Evidence collection coverage by control family', 'Automated vs. manual evidence ratio', 'Evidence freshness metrics'], validationHint: 'Automated: GRC platform APIs verify evidence collection completeness and recency' },
      { name: 'Evidence Automation Documentation', category: 'documents-reports', description: 'How automated evidence collection works — workflows, coverage metrics, and integration architecture' },
      { name: 'Evidence Collection Procedures', category: 'processes-procedures', description: 'How evidence is collected and preserved for compliance and incident investigations' },
    ],
  },
  {
    ksiId: 'KSI-MLA-LET',
    implementationInsight: 'Mature implementations express log transparency as a product feature — complete log event taxonomy published as machine-readable schemas, customer-facing APIs for log export and SIEM integration, and log access verified through automated endpoint testing. Audit trail transparency becomes a measurable service backed by API documentation and integration guides.',
    components: [
      { name: 'Customer Audit Log Access', category: 'product-security-features', description: 'Customer-facing audit log access and export as a product feature — API-based log export with SIEM integration support', examples: ['API-based log export', 'SIEM integration'], validationHint: 'Automated: API endpoint tests verify customer log export functionality and completeness' },
      { name: 'Log Event Types Documentation', category: 'documents-reports', description: 'Complete log event taxonomy expressing all logged event types, formats, and field schemas', evidenceExamples: ['Event type taxonomy with severity mapping', 'Sample log entries per event type', 'Log field schema documentation'] },
      { name: 'Log Retention and Export', category: 'policies', description: 'Human-readable log retention periods and customer log export options' },
    ],
  },
  {
    ksiId: 'KSI-MLA-OSM',
    implementationInsight: 'Mature implementations express monitoring coverage through MITRE ATT&CK heat maps — detection rule counts by tactic, alert-to-incident conversion rates, and MTTD/MTTR trends as dashboard indicators. Detection engineering is a continuous process with rules tested against the ATT&CK matrix, showing systematic coverage rather than ad-hoc alerting.',
    components: [
      { name: 'Threat Detection Dashboard', category: 'dashboards', description: 'Dashboard expressing detection posture — threat detection metrics, alert volumes, MTTD/MTTR trends, and ATT&CK technique coverage', validationHint: 'Automated: SIEM APIs verify detection rules are active and alert pipelines are functioning' },
      { name: 'Security Monitoring Architecture', category: 'architecture-diagrams', description: 'Architecture expressing SIEM/SOAR design — detection rules, alert routing, and escalation pipelines', examples: ['Splunk SOAR', 'Microsoft Sentinel', 'Google Chronicle'], evidenceExamples: ['MITRE ATT&CK technique coverage map', 'Detection rule count by tactic', 'Alert-to-incident conversion rate'] },
      { name: 'Detection Engineering Process', category: 'processes-procedures', description: 'How detection rules are created, tested, and tuned — aligned to MITRE ATT&CK with continuous coverage improvement' },
      { name: 'SOC Capabilities Overview', category: 'documents-reports', description: 'SOC capabilities, staffing model, and monitoring coverage' },
    ],
  },
  {
    ksiId: 'KSI-MLA-RVL',
    implementationInsight: 'Mature implementations express log review through automated triage — SOAR platforms correlating and escalating events automatically, with log review completion metrics and mean time to review tracked as dashboard indicators. Security events are analyzed systematically through automation, not just collected in a SIEM waiting for manual review.',
    components: [
      { name: 'Automated Alert Triage', category: 'product-security-features', description: 'How automated alert triage and correlation works — SOAR platform capabilities that analyze events systematically', validationHint: 'Automated: SOAR platform APIs verify alert triage rules are executing and escalating properly' },
      { name: 'Log Review Compliance Metrics', category: 'dashboards', description: 'Dashboard expressing log review posture — completion rates, automated triage coverage, and mean time to review' },
      { name: 'Log Review Procedures', category: 'processes-procedures', description: 'How regular log reviews are conducted — frequency, scope, and escalation criteria for events requiring human review', evidenceExamples: ['Review completion rate by log source', 'Automated triage coverage', 'Mean time to review for critical alerts'] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PIY — Privacy Family (5 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-PIY-GIV',
    implementationInsight: 'Mature implementations express privacy governance through externally validated certifications backed by published PIA summaries — privacy certifications (ISO 27701, SOC 2 Privacy) demonstrate third-party validation, while PIA summaries show how privacy risks are actively identified and mitigated for each system and feature.',
    components: [
      { name: 'Privacy Certifications', category: 'certifications-badges', description: 'Privacy certifications and attestations — third-party validation of privacy governance implementation', examples: ['SOC 2 Privacy criteria', 'ISO 27701', 'APEC CBPR'], validationHint: 'Automated: Certificate registry verifies ISO 27701 and SOC 2 Privacy criteria validity' },
      { name: 'Privacy Impact Assessment Summary', category: 'documents-reports', description: 'PIA summaries expressing how privacy risks are identified and mitigated per system and feature', evidenceExamples: ['PIA completion status by system/feature', 'Privacy risk ratings and mitigations', 'DPO review sign-off records'] },
      { name: 'Privacy Policy', category: 'policies', description: 'Human-readable privacy policy covering data collection, use, sharing, and individual rights' },
    ],
  },
  {
    ksiId: 'KSI-PIY-RES',
    implementationInsight: 'Mature implementations express data rights as an operationalized service — self-service DSAR portals processing requests automatically, fulfillment metrics tracked as dashboard indicators, and response time SLAs measured against actual performance. Data rights become a measurable service with API-driven fulfillment.',
    components: [
      { name: 'Data Subject Rights Portal', category: 'product-security-features', description: 'Self-service portal expressing data rights as a product feature — individuals exercise access, deletion, and portability rights directly', evidenceExamples: ['Supported rights types (access/deletion/portability/rectification)', 'Self-service request workflow', 'Authentication requirements for requests'] },
      { name: 'Data Rights Fulfillment Metrics', category: 'dashboards', description: 'Dashboard expressing DSAR fulfillment posture — volume, response times, and completion rates as live indicators', validationHint: 'Automated: DSAR platform APIs verify request processing times and completion rates' },
      { name: 'Data Rights Request SLA', category: 'policies', description: 'Human-readable SLAs for responding to data subject access requests' },
    ],
  },
  {
    ksiId: 'KSI-PIY-RIS',
    implementationInsight: 'Mature implementations express privacy risk management through automated data discovery — data inventory tools scanning actual data stores, flow maps generated from service mesh and API gateway data, and privacy risk registers tracking identified risks with treatment status. Data discovery tools verify inventory completeness against actual data stores automatically.',
    components: [
      { name: 'Data Inventory and Mapping', category: 'architecture-diagrams', description: 'Data inventory expressing what personal data is collected, where it flows, and how it is protected — derived from automated discovery', examples: ['OneTrust', 'BigID', 'Transcend'], evidenceExamples: ['Personal data element inventory', 'Data flow maps with processing purposes', 'Third-party data sharing inventory'], validationHint: 'Automated: Data discovery tools verify inventory completeness against actual data stores' },
      { name: 'Privacy Risk Management Framework', category: 'documents-reports', description: 'Framework expressing how privacy risks are identified, assessed, and mitigated' },
      { name: 'Privacy by Design Documentation', category: 'processes-procedures', description: 'How privacy is embedded into the development lifecycle' },
    ],
  },
  {
    ksiId: 'KSI-PIY-RSD',
    implementationInsight: 'Mature implementations express data minimization through automated enforcement — DLP policies preventing excessive data collection, retention rules auto-expiring data beyond defined periods, and minimization metrics showing data collection is intentional and bounded rather than aspirational.',
    components: [
      { name: 'De-identification and Anonymization', category: 'product-security-features', description: 'De-identification capabilities as a product feature — techniques used for analytics and non-production environments', validationHint: 'Manual: Auditor reviews de-identification techniques for adequacy against re-identification risk' },
      { name: 'Purpose Limitation Documentation', category: 'documents-reports', description: 'Data processing purposes with legal basis for each — expressing intentional, bounded data collection' },
      { name: 'Data Minimization Policy', category: 'policies', description: 'Human-readable data minimization principles — documents intent behind automated retention and collection controls', evidenceExamples: ['Data collection justification per field/element', 'Retention period by data category', 'Minimization audit results'] },
    ],
  },
  {
    ksiId: 'KSI-PIY-RVD',
    implementationInsight: 'Mature implementations express breach notification readiness through tested procedures — notification timeline SLAs validated against actual incident history, automated notification workflows triggered by breach classification, and regulatory reporting requirements tracked as a matrix per jurisdiction.',
    components: [
      { name: 'Privacy Breach Notification Procedures', category: 'processes-procedures', description: 'How breach notifications are triggered and executed — including automated workflows and jurisdiction-specific timelines', evidenceExamples: ['Notification timeline templates by jurisdiction', 'Breach severity classification criteria', 'Regulatory reporting requirements matrix'] },
      { name: 'Privacy Incident Response Plan', category: 'documents-reports', description: 'Plan for responding to privacy incidents — distinct from general security incidents with specific notification workflows' },
      { name: 'Breach Notification SLA', category: 'policies', description: 'Human-readable breach notification SLA timelines (e.g., 72 hours per GDPR)', validationHint: 'Manual: Auditor reviews past breach notifications against documented SLA commitments' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RPL — Risk Planning Family (4 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-RPL-ABO',
    implementationInsight: 'Mature implementations express risk management through structured frameworks with measurable outputs — risk registers with treatment plans tracked to completion, risk appetite statements with explicit thresholds by category, and annual assessment results published as evidence. Risk management is demonstrated through governance artifacts and tracked decisions, not just policy documents.',
    components: [
      { name: 'Risk Management Framework', category: 'documents-reports', description: 'Framework expressing how risks are identified, assessed, and treated — methodology, decision criteria, and assessment schedule', evidenceExamples: ['Risk assessment methodology documentation', 'Risk treatment decision criteria', 'Annual risk assessment schedule'] },
      { name: 'Risk Register Summary', category: 'evidence-artifacts', description: 'Top risks with treatment plans — evidence that risk is actively managed and tracked to resolution', validationHint: 'Manual: Auditor reviews risk register for completeness, treatment plans, and owner assignments' },
      { name: 'Risk Appetite Statement', category: 'policies', description: 'Risk appetite statement expressing acceptable risk thresholds by category' },
    ],
  },
  {
    ksiId: 'KSI-RPL-ARP',
    implementationInsight: 'Mature implementations express security program maturity through metrics dashboards — key security indicators tracked over time, program maturity assessments with year-over-year comparisons, and roadmap progress measured against prior commitments. Agencies assess maturity through measurable trends, not marketing narratives.',
    components: [
      { name: 'Security Metrics Dashboard', category: 'dashboards', description: 'Dashboard expressing security program health — key metrics and trend lines showing maturity trajectory' },
      { name: 'Security Program Overview', category: 'documents-reports', description: 'Security program overview expressing governance, team structure, and key initiatives', evidenceExamples: ['Security program maturity assessment', 'Key security metrics summary', 'Team structure and certification inventory'] },
      { name: 'Security Roadmap', category: 'documents-reports', description: 'Security roadmap expressing planned improvements and investment areas — with progress against prior commitments', validationHint: 'Manual: Auditor reviews roadmap progress against prior period commitments' },
    ],
  },
  {
    ksiId: 'KSI-RPL-RRO',
    implementationInsight: 'Mature implementations express governance through defined accountability — named roles with qualification requirements, board-level security briefing cadence, and training completion tracked automatically. Governance structures show agencies that security leadership is defined and accountable at every organizational level.',
    components: [
      { name: 'Governance and Oversight Structure', category: 'documents-reports', description: 'Organizational structure expressing security governance — board/executive oversight, named leadership roles, and reporting lines', evidenceExamples: ['Org chart with security reporting lines', 'Board/executive security briefing cadence', 'Named security leadership roles'] },
      { name: 'Security Awareness Program', category: 'processes-procedures', description: 'How security awareness training is delivered and measured — completion tracked via LMS integration', validationHint: 'Automated: LMS APIs verify training completion rates and content currency' },
      { name: 'Security Team Qualifications', category: 'documents-reports', description: 'Security team structure, certifications, and expertise areas' },
    ],
  },
  {
    ksiId: 'KSI-RPL-TRC',
    implementationInsight: 'Mature implementations express compliance currency through living dashboards — all certifications with expiration dates and audit schedules verified via certificate registry APIs, SOC 2 bridge letters generated between annual reports, and compliance questionnaire responses maintained as continuously updated artifacts. Compliance becomes a continuously verifiable property.',
    components: [
      { name: 'Compliance Certifications Dashboard', category: 'certifications-badges', description: 'Living dashboard expressing all certifications with dates, scope, and validity status — verified via certificate registries', examples: ['SOC 2 Type II', 'ISO 27001', 'FedRAMP', 'HITRUST'], evidenceExamples: ['Certification inventory with issue/expiry dates', 'Audit schedule for next 12 months', 'Certification scope and applicability notes'], validationHint: 'Automated: Certificate registry APIs verify certification validity and scope' },
      { name: 'Audit Report Summaries', category: 'evidence-artifacts', description: 'Third-party audit report summaries — SOC 2 bridge letters, ISO surveillance audit results as evidence of ongoing compliance' },
      { name: 'Compliance Questionnaire Responses', category: 'questionnaire-responses', description: 'Pre-filled responses to common compliance questionnaires — maintained as continuously updated artifacts', examples: ['CSA CAIQ', 'SIG Lite', 'HECVAT'] },
      { name: 'Compliance Calendar', category: 'documents-reports', description: 'Compliance calendar showing audit and certification renewal schedule' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SVC — Service Family (8 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-SVC-ACM',
    implementationInsight: 'Mature implementations express asset management through automated discovery dashboards — CMDB platforms maintaining real-time asset inventories, configuration baseline compliance tracked as a metric, and unauthorized asset detection triggering automated alerts. The asset inventory becomes a continuously updated trust center feature rather than a periodic manual reconciliation.',
    components: [
      { name: 'Asset Inventory Dashboard', category: 'dashboards', description: 'Dashboard expressing asset management posture — inventory completeness, unauthorized assets, and configuration compliance as live indicators', examples: ['ServiceNow CMDB', 'Axonius', 'JupiterOne'], evidenceExamples: ['Asset count by category (Compute/Storage/Network/Security)', 'Authorized vs. unauthorized asset ratio', 'Configuration baseline compliance percentage'], validationHint: 'Automated: CMDB APIs verify asset inventory completeness and configuration compliance' },
      { name: 'Configuration Management Architecture', category: 'architecture-diagrams', description: 'Architecture expressing how configurations are managed, baselined, and monitored for drift' },
      { name: 'Asset and Configuration Management Policy', category: 'policies', description: 'Human-readable policy for asset inventory, configuration management, and CMDB maintenance — documents intent behind automated discovery' },
    ],
  },
  {
    ksiId: 'KSI-SVC-ASM',
    implementationInsight: 'Mature implementations express attack surface management through quantified dashboards — ASM platforms continuously discovering external-facing assets, attack surface graph metrics (nodes, edges, attack paths) tracked as indicators, and shadow IT detection findings remediated through automated workflows. Attack surface becomes quantifiable and measurable.',
    components: [
      { name: 'External Attack Surface Dashboard', category: 'dashboards', description: 'Dashboard expressing attack surface posture — external-facing assets, exposed services, attack surface trends, and shadow IT detection', evidenceExamples: ['External-facing asset inventory', 'Attack surface graph metrics (nodes/edges/paths)', 'Shadow IT detection findings'], validationHint: 'Automated: ASM platform APIs verify continuous external scanning and discovery' },
      { name: 'Attack Surface Management Program', category: 'documents-reports', description: 'ASM program expressing how external attack surface is discovered and managed — backed by continuous scanning', examples: ['Censys', 'Shodan', 'Randori'] },
      { name: 'Penetration Testing Reports', category: 'evidence-artifacts', description: 'Penetration testing results expressing scope, findings, and remediation status' },
    ],
  },
  {
    ksiId: 'KSI-SVC-EIS',
    implementationInsight: 'Mature implementations express network isolation through policy-enforced segmentation — zero trust architecture with identity-aware access, micro-segmentation rules verified by firewall APIs, and network security monitoring dashboards showing east-west traffic patterns. Defense-in-depth is demonstrated through multiple automated isolation layers.',
    components: [
      { name: 'Network Security Architecture', category: 'architecture-diagrams', description: 'Architecture expressing network segmentation, firewall rules, and security zones — shows defense-in-depth through isolation layers', evidenceExamples: ['Security zone definitions with traffic rules', 'Micro-segmentation policy summary', 'East-west traffic monitoring coverage'] },
      { name: 'Network Security Monitoring', category: 'dashboards', description: 'Dashboard expressing network security posture — IDS/IPS alerts, traffic anomalies, and segmentation enforcement status', examples: ['Palo Alto', 'Fortinet', 'Cisco'], validationHint: 'Automated: Firewall APIs verify segmentation rules match documented policy' },
      { name: 'Network Segmentation Enforcement', category: 'product-security-features', description: 'Automated enforcement of network segmentation policies — micro-segmentation rules preventing unauthorized lateral movement', examples: ['Illumio', 'VMware NSX', 'Calico', 'Kyverno network policies'], validationHint: 'Automated: Network policy engines verify segmentation rules are enforced' },
      { name: 'Zero Trust Architecture Documentation', category: 'documents-reports', description: 'Zero trust implementation including micro-segmentation and identity-aware access' },
    ],
  },
  {
    ksiId: 'KSI-SVC-PRR',
    implementationInsight: 'Mature implementations express application security through pipeline-integrated testing — SAST, DAST, and SCA results tracked as dashboard metrics, vulnerability trend lines showing continuous improvement in code quality, and security gates enforced in CI/CD preventing vulnerable code from reaching production.',
    components: [
      { name: 'Application Security Testing Results', category: 'evidence-artifacts', description: 'AppSec scan results expressing vulnerability trends and fix rates — generated from automated SAST, DAST, and SCA pipelines', examples: ['Snyk', 'Checkmarx', 'Veracode'], evidenceExamples: ['SAST/DAST/SCA vulnerability trends', 'Critical finding remediation SLA compliance', 'Security testing coverage by repository'], validationHint: 'Automated: AppSec tool APIs verify scanning coverage and remediation velocity' },
      { name: 'Security Development Lifecycle', category: 'processes-procedures', description: 'How security is integrated into the SDLC — threat modeling, code review, and security testing at each phase' },
      { name: 'AppSec Policy Enforcement', category: 'product-security-features', description: 'Automated enforcement of application security requirements — security gates blocking builds with critical vulnerabilities', examples: ['Snyk break-build policies', 'Checkmarx quality gates', 'SonarQube quality profiles', 'OPA/Rego'], validationHint: 'Automated: CI/CD pipeline logs show security gate enforcement decisions' },
      { name: 'Bug Bounty Program', category: 'product-security-features', description: 'Bug bounty program as a product security feature — scope, rewards, and responsible disclosure process', examples: ['HackerOne', 'Bugcrowd'] },
    ],
  },
  {
    ksiId: 'KSI-SVC-RUD',
    implementationInsight: 'Mature implementations express endpoint security through compliance dashboards — EDR deployment coverage and device compliance rates tracked as live metrics, with non-compliant devices automatically quarantined or restricted. Every device accessing the environment demonstrably meets security baselines.',
    components: [
      { name: 'Endpoint Compliance Dashboard', category: 'dashboards', description: 'Dashboard expressing endpoint security posture — compliance rates, EDR deployment coverage, patch status, and threat detections', evidenceExamples: ['EDR deployment coverage percentage', 'OS patch compliance by device type', 'Non-compliant device count and remediation status'] },
      { name: 'Endpoint Protection Architecture', category: 'architecture-diagrams', description: 'Architecture expressing endpoint protection stack — EDR, MDM, and hardening layers', examples: ['CrowdStrike', 'SentinelOne', 'Microsoft Defender'] },
      { name: 'Device Compliance Enforcement', category: 'product-security-features', description: 'Automated enforcement of device compliance — non-compliant devices restricted or quarantined automatically', validationHint: 'Automated: MDM/EDR APIs verify device compliance status and enforcement actions' },
      { name: 'Device Compliance Policy', category: 'policies', description: 'Human-readable device compliance requirements for corporate and BYOD devices — documents intent behind automated enforcement' },
    ],
  },
  {
    ksiId: 'KSI-SVC-SIN',
    implementationInsight: 'Mature implementations express transport security through certificate management dashboards — certificate inventories with rotation schedules tracked automatically, network encryption maps showing coverage across all paths, and certificate monitoring tools alerting on approaching expirations. Transport security is actively managed, not just configured.',
    components: [
      { name: 'Network Traffic Flow Diagram', category: 'architecture-diagrams', description: 'Architecture expressing all network traffic paths with encryption status per segment', evidenceExamples: ['Encryption status per network segment', 'Internal vs. external traffic encryption coverage', 'Certificate inventory with expiration dates'] },
      { name: 'Certificate Management', category: 'processes-procedures', description: 'How certificates are managed across their lifecycle — issuance, rotation, revocation tracked automatically', examples: ['Let\'s Encrypt', 'DigiCert', 'AWS ACM'], validationHint: 'Automated: Certificate monitoring tools verify expiration dates and rotation compliance' },
      { name: 'Network Encryption Standards', category: 'policies', description: 'Human-readable standards for network traffic encryption including minimum TLS versions and approved cipher suites' },
    ],
  },
  {
    ksiId: 'KSI-SVC-VCM',
    implementationInsight: 'Mature implementations express communication validation through automated verification — DNS records checked for DMARC/SPF/DKIM enforcement, API gateway metrics showing authentication rates and rejection patterns, and email security configuration grades published as measurable indicators covering both human and machine communication channels.',
    components: [
      { name: 'Communication Validation Architecture', category: 'architecture-diagrams', description: 'Architecture expressing how inbound/outbound communications are validated — DKIM, SPF, DMARC for email; auth, rate limiting, and validation for APIs' },
      { name: 'API Security Documentation', category: 'product-security-features', description: 'API authentication, rate limiting, and input validation controls as product features', validationHint: 'Automated: DNS lookup verifies DMARC enforcement policy and API gateway logs verify auth rates' },
      { name: 'Email Security Configuration', category: 'evidence-artifacts', description: 'DMARC, SPF, and DKIM records with enforcement policy status — verifiable via DNS lookup', evidenceExamples: ['DMARC policy status (none/quarantine/reject)', 'SPF record configuration', 'DKIM signing verification results'] },
    ],
  },
  {
    ksiId: 'KSI-SVC-VRI',
    implementationInsight: 'Mature implementations express software integrity through SLSA framework compliance — build provenance tracked and verified at each pipeline stage, code signing enforced via policy engines, and SBOM generated automatically from build manifests. Supply chain integrity becomes a measurable, verifiable property with signed attestations.',
    components: [
      { name: 'Software Integrity Verification', category: 'product-security-features', description: 'Code signing, artifact verification, and supply chain integrity controls — enforced at each pipeline stage', examples: ['Sigstore', 'Cosign', 'GPG signing'], validationHint: 'Automated: CI/CD pipeline verifies code signatures and artifact provenance at each stage' },
      { name: 'Build Pipeline Security', category: 'architecture-diagrams', description: 'Architecture expressing secure build pipeline with integrity checks at each stage — SLSA framework compliance', evidenceExamples: ['SLSA compliance level per artifact', 'Code signing coverage percentage', 'Build provenance attestation samples'] },
      { name: 'Integrity Policy Enforcement', category: 'product-security-features', description: 'Automated enforcement of integrity requirements — unsigned artifacts blocked from deployment, provenance verified before promotion', examples: ['Sigstore policy-controller', 'Kyverno image verification', 'Conftest', 'Notation'], validationHint: 'Automated: Policy engines verify signatures and provenance before artifact deployment' },
      { name: 'SBOM and Dependency Management', category: 'evidence-artifacts', description: 'Machine-readable SBOM with dependency vulnerability tracking — generated from build pipelines', examples: ['SPDX', 'CycloneDX', 'Dependabot'] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SCR — Supply Chain Risk Family (2 KSIs)
  // ──────────────────────────────────────────────────────────────────────────
  {
    ksiId: 'KSI-SCR-MON',
    implementationInsight: 'Mature implementations express supply chain risk through automated vendor monitoring pipelines — VRM platforms continuously scoring third-party posture, SBOM analysis flagging dependency vulnerabilities, and dashboards surfacing PII sharing flags and risk tiers without manual compilation. The trust center becomes a live map of vendor dependencies and their associated risks.',
    components: [
      { name: 'Vendor Compliance Dashboard', category: 'dashboards', description: 'Dashboard expressing vendor risk scores, compliance status, assessment cadence, and PII sharing flags across the supply chain', examples: ['SecurityScorecard portal', 'BitSight dashboard', 'Prevalent risk center', 'Custom GRC vendor view'], validationHint: 'Automated: VRM platform APIs verify vendor risk scores are current and assessments are on schedule' },
      { name: 'Critical Vendor Inventory', category: 'vendor-supply-chain', description: 'How the organization identifies and tracks critical vendors with their security posture, certifications, and data handling classification', evidenceExamples: ['Vendor risk tier classification', 'PII/PHI sharing flags per vendor', 'Vendor security certification status'] },
      { name: 'Vendor Risk Management Program', category: 'vendor-supply-chain', description: 'How the organization assesses and monitors third-party risks — scope varies by vendor criticality and data sensitivity', examples: ['SecurityScorecard', 'BitSight', 'Prevalent', 'OneTrust Vendorpedia'] },
      { name: 'Subprocessor List', category: 'documents-reports', description: 'Published and maintained list of subprocessors with change notification mechanism' },
    ],
  },
  {
    ksiId: 'KSI-SCR-MIT',
    implementationInsight: 'Strong implementations enforce supply chain security through automated tooling — SBOM scanning in CI/CD pipelines, dependency vulnerability analysis via Dependabot or Snyk, and vendor assessment automation that flags non-compliant suppliers before contracts are signed. The trust center expresses proactive third-party risk management through enforcement evidence, not just contractual requirements.',
    components: [
      { name: 'Supply Chain Risk Dashboard', category: 'dashboards', description: 'Dashboard expressing supply chain risk posture — vendor assessment status, SBOM vulnerability trends, and third-party compliance gaps', examples: ['Vendor risk heatmap', 'SBOM vulnerability tracker', 'Third-party compliance scorecard'] },
      { name: 'Supply Chain Enforcement', category: 'product-security-features', description: 'Automated enforcement of supply chain security requirements — validates dependencies and vendor compliance before deployment', examples: ['Dependabot/Renovate auto-updates', 'Snyk dependency scanning', 'SBOM generation in CI/CD', 'Vendor compliance gates in procurement'], validationHint: 'Automated: CI/CD pipeline logs show dependency scanning results and policy enforcement decisions' },
      { name: 'Third-Party Audit Results', category: 'evidence-artifacts', description: 'Evidence from third-party vendor audits and security assessments demonstrating supply chain due diligence', evidenceExamples: ['Risk assessment criteria and scoring methodology', 'Vendor assessment completion rates', 'Critical vendor audit frequency'], validationHint: 'Manual: Auditor reviews vendor assessment reports for completeness and finding remediation' },
      { name: 'Supply Chain Risk Assessment Process', category: 'processes-procedures', description: 'How the organization assesses supply chain risks including due diligence criteria and continuous monitoring approach', evidenceExamples: ['Risk assessment criteria and scoring methodology', 'Vendor assessment completion rates', 'Critical vendor audit frequency'] },
      { name: 'Supply Chain Security Policy', category: 'policies', description: 'Human-readable documentation of the organization\'s supply chain risk assessment approach — the rationale behind automated enforcement' },
    ],
  },
];

// ============================================================================
// Lookup Index (built once, O(1) access)
// ============================================================================

const _componentIndex: Map<string, TrustCenterComponent[]> = new Map();
const _insightIndex: Map<string, string> = new Map();

function ensureIndex() {
  if (_componentIndex.size > 0) return;
  for (const mapping of KSI_TRUST_CENTER_DATA) {
    _componentIndex.set(mapping.ksiId, mapping.components);
    if (mapping.implementationInsight) {
      _insightIndex.set(mapping.ksiId, mapping.implementationInsight);
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get trust center components for a KSI by its control ID
 */
export function getTrustCenterComponents(ksiId: string): TrustCenterComponent[] | undefined {
  ensureIndex();
  return _componentIndex.get(ksiId);
}

/**
 * Check if a KSI has trust center component suggestions
 */
export function hasTrustCenterComponents(ksiId: string): boolean {
  ensureIndex();
  return _componentIndex.has(ksiId);
}

/**
 * Get the implementation insight for a KSI
 */
export function getImplementationInsight(ksiId: string): string | undefined {
  ensureIndex();
  return _insightIndex.get(ksiId);
}

/**
 * Get category metadata by ID
 */
export function getCategoryMeta(categoryId: TrustCenterCategory): TrustCenterCategoryMeta | undefined {
  return TRUST_CENTER_CATEGORIES.find(c => c.id === categoryId);
}
