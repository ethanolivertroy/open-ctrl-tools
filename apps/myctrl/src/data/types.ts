// Base control interface (framework-agnostic)
export interface BaseControl {
  control_id: string;
  title: string;
  family: string;
  description: string;
  related_controls?: string[];
  url?: string; // Computed at runtime, not in JSON
  assessment_questions?: {
    category: string;    // e.g., "Process Questions", "Technical Implementation"
    questions: string[];
  }[];
}

// NIST-specific fields
export interface NistControl extends BaseControl {
  supplemental_guidance?: string | null;
  baseline_low: boolean;
  baseline_moderate: boolean;
  baseline_high: boolean;
  baseline_privacy: boolean;
  enhancements?: string[];
  kubernetes_examples?: ConfigExample[];  // Legacy: raw code examples only
  kubernetes_guidance?: KubernetesGuidance;  // Preferred: guidance with narrative + examples
}

// PCI-DSS testing procedure
export interface PciTestingProcedure {
  id: string;
  text: string;
}

// PCI-DSS structured guidance
export interface PciGuidance {
  purpose?: string;
  good_practice?: string;
  definitions?: string;
  examples?: string;
  further_information?: string;
}

// PCI-DSS-specific fields
export interface PciControl extends BaseControl {
  section?: string;                        // e.g., "1.2"
  section_title?: string;                  // e.g., "Network security controls..."
  customized_approach_objective?: string | null;  // The objective for customized approach
  applicability_notes?: string | null;            // Notes about when this applies
  testing_procedures?: PciTestingProcedure[] | null;  // Structured procedures
  guidance?: PciGuidance | null;                  // Structured guidance sections
}

// OWASP LLM Top 10 attack scenario
export interface OWASPAttackScenario {
  title: string;
  description: string;
}

// OWASP LLM Top 10 reference link
export interface OWASPReference {
  title: string;
  url: string;
}

// OWASP LLM Top 10 risk entry
export interface OWASPLLMRisk extends BaseControl {
  vulnerability_types?: string[];
  common_impacts?: string[];
  prevention_strategies?: string[];
  attack_scenarios?: OWASPAttackScenario[];
  references?: OWASPReference[];
  mitre_atlas?: string[];
  related_cwes?: string[];
}

// FedRAMP 20x KSI indicator
export interface FedRampKSIControl extends BaseControl {
  fka?: string;                  // Former control ID (e.g., "KSI-RSC-MON")
  impact_low: boolean;
  impact_moderate: boolean;
  references?: OWASPReference[];
  updated?: { date: string; comment: string }[];
  terms?: string[];              // Defined terms referenced in the statement
}

// CIS Controls v8 safeguard
export interface CISControl extends BaseControl {
  asset_type: string | null;      // Devices, Applications, Data, Network, Users
  security_function: string | null; // Identify, Protect, Detect, Respond, Recover
  ig1: boolean;                   // Implementation Group 1
  ig2: boolean;                   // Implementation Group 2
  ig3: boolean;                   // Implementation Group 3
}

// ISO 27001:2022 control with NIST CSF 2.0 mappings
export interface ISO27001Control extends BaseControl {
  // 4 themes: Organizational (5.x), People (6.x), Physical (7.x), Technological (8.x)
  csf_mappings?: string[];  // NIST CSF 2.0 subcategory mappings (from NIST OLIR)
}

// SOC 2 Trust Services Criteria (simple - no special fields beyond base)
export interface SOC2Control extends BaseControl {
  // SOC 2 uses the base fields only
  // 5 categories: Security (CC), Availability (A), Confidentiality (C), Processing Integrity (PI), Privacy (P)
}

// Informative reference to external framework/standard
export interface InformativeReference {
  framework: string;                    // Framework name (e.g., "CCMv4.0", "SP 800-53 Rev. 5")
  controls: string[];                   // Control IDs within that framework
}

// NIST CSF 2.0 Subcategory with implementation examples
export interface NistCSFControl extends BaseControl {
  category?: string;                    // Category code (e.g., "GV.OC")
  category_title?: string;              // Category title (e.g., "Organizational Context")
  implementation_examples?: string[];   // Implementation example texts
  informative_references?: InformativeReference[];  // References to other frameworks
}

// FedRAMP Rev 5 baseline-specific data
export interface FedRAMPBaselineData {
  included: boolean;
  fedramp_parameters?: string | null;      // Formatted for display: "(h)(1): value"
  additional_requirements?: string | null;
  monitoring_periodicity?: string | null;
}

// FedRAMP Rev 5 baselines structure
export interface FedRAMPBaselines {
  low?: FedRAMPBaselineData;
  moderate?: FedRAMPBaselineData;
  high?: FedRAMPBaselineData;
  li_saas?: FedRAMPBaselineData;
}

// FedRAMP Rev 5 Baselines control
export interface FedRAMPControl extends BaseControl {
  discussion?: string | null;
  baselines: FedRAMPBaselines;
  kubernetes_examples?: ConfigExample[];  // Legacy: raw code examples only
  kubernetes_guidance?: KubernetesGuidance;  // Preferred: guidance with narrative + examples
}

// DoD SRG impact level-specific data
export interface DoDImpactLevelData {
  included: boolean;
  fedramp_parameters?: string | null;
  dod_parameters?: string | null;
  additional_requirements?: string | null;
}

// DoD SRG impact levels structure
export interface DoDImpactLevels {
  il4_mod?: DoDImpactLevelData;
  il4_high?: DoDImpactLevelData;
  il5?: DoDImpactLevelData;
  il6?: DoDImpactLevelData;
}

// DoD SRG control
export interface DoDSRGControl extends BaseControl {
  discussion?: string | null;
  impact_levels: DoDImpactLevels;
  kubernetes_examples?: ConfigExample[];  // Legacy: raw code examples only
  kubernetes_guidance?: KubernetesGuidance;  // Preferred: guidance with narrative + examples
}

// STIG control (Security Technical Implementation Guide)
export interface STIGControl extends BaseControl {
  stig_id: string;             // V-242376
  rule_id: string;             // SV-242376r960759_rule
  version_code?: string;       // CNTR-K8-000150
  severity: 'high' | 'medium' | 'low';  // CAT I, CAT II, CAT III
  cci_refs: string[];          // CCI-000068, etc. (maps to NIST 800-53)
  check_content: string;       // How to verify compliance
  fix_text: string;            // Remediation steps
  mitigations?: string;        // Optional mitigations
  potential_impacts?: string;  // Optional potential impacts
}

// NIST AI RMF Playbook control
export interface AIRMFControl extends BaseControl {
  category: string;            // GOVERN-1, MAP-2, etc.
  about?: string;              // Detailed context about the subcategory
  suggested_actions?: string;  // Suggested actions (markdown)
  documentation?: string;      // Documentation guidance (markdown)
  references?: string;         // References (markdown with URLs)
  ai_actors?: string[];        // AI Actors tags
  topics?: string[];           // Topic tags
}

// EU AI Act risk tier type
export type EURiskTier = 'prohibited' | 'high-risk' | 'limited-risk' | 'minimal-risk' | 'gpai';

// EU AI Act control
export interface EUAIActControl extends BaseControl {
  article: string;             // e.g., "9", "10", "14"
  risk_tier: EURiskTier;       // Which risk tier this applies to
  applies_to?: string[];       // ['providers', 'deployers', 'importers']
  deadline?: string;           // Compliance deadline (e.g., "August 2, 2026")
  penalty_tier?: string;       // €40M/7%, €30M/6%, etc.
  use_cases?: string[];        // For high-risk: which use case categories apply
  key_requirements?: string[]; // Key requirements/obligations
}

// ITSG-33 profile-specific data (Canadian Government Security)
export interface ITSG33ProfileData {
  included: boolean;
  priority?: number;           // 1, 2, 3, or 4 (implementation priority)
  parameters?: string | null;  // Suggested placeholder values
}

// ITSG-33 profiles structure
export interface ITSG33Profiles {
  pbmm?: ITSG33ProfileData;    // Protected B / Medium / Medium
  secret?: ITSG33ProfileData;  // Secret / Medium / Medium
}

// ITSG-33 control (Canadian Government Security Control Catalogue)
export interface ITSG33Control extends BaseControl {
  class?: string;              // Technical, Operational, Management
  discussion?: string | null;  // Supplemental guidance
  references?: string | null;  // Related references
  tailoring_guidance?: string | null;
  profiles: ITSG33Profiles;
}

// NIST SSDF (SP 800-218) task
export interface SSDFControl extends BaseControl {
  practice_id: string;           // e.g., "PO.1"
  practice_name: string;         // e.g., "Define Security Requirements for Software Development"
  practice_description: string;  // Full practice description
  implementation_examples: string[];  // Notional implementation examples
  references: Record<string, string[]>;  // Cross-framework references: { "SP80053": ["SA-1", "SA-8"] }
}

// NIST SP 800-171 Rev 2 control (CUI protection)
export interface NIST171Control extends BaseControl {
  requirement_type: 'basic' | 'derived';  // Basic or Derived requirement
  discussion?: string;                     // Supplemental discussion
}

// CMMC v2.0 practice (DoD supply chain security)
export interface CMMCControl extends BaseControl {
  v1_id?: string;              // v1.x practice ID (e.g., "AC.1.001")
  cmmc_level: 1 | 2 | 3;       // Level 1 (FCI), Level 2 (CUI), Level 3 (Enhanced)
  far_clause?: string;         // FAR 52.204-21 clause reference (Level 1)
  nist_800_171?: string;       // NIST 800-171 requirement reference (Level 1 & 2)
  nist_800_172?: string;       // NIST 800-172 requirement reference (Level 3)
}

// Adobe CCF (Common Controls Framework) control
// Source: Adobe CCF Open Source, licensed under Creative Commons
// https://www.adobe.com/trust/compliance/adobe-ccf.html
export interface AdobeCCFControl extends BaseControl {
  control_theme?: string;           // Process, Technology
  control_type?: string;            // Preventive, Detective, Corrective
  policy_standard?: string;         // Associated policy/standard
  implementation_guidance?: string; // How to implement the control
  testing_procedure?: string;       // How to test/audit the control
  audit_artifacts?: string[];       // Evidence references (E-AM-01, etc.)
  mappings?: {                      // Cross-framework mappings provided by Adobe
    [frameworkId: string]: string[];
  };
}

// TX-RAMP (Texas Risk and Authorization Management Program) control
export interface TXRAMPControl extends BaseControl {
  level1: boolean;                  // Level 1 (public/non-confidential/low impact)
  level2: boolean;                  // Level 2 (confidential/regulated/moderate-high impact)
  parameters?: string;              // TX-RAMP specific parameters
  discussion?: string;              // Supplemental discussion
}

// GovRAMP baseline-specific data
export interface GovRAMPBaselineData {
  included: boolean;
}

// GovRAMP baselines structure
export interface GovRAMPBaselines {
  low?: GovRAMPBaselineData;
  moderate?: GovRAMPBaselineData;
}

// GovRAMP (Government Risk and Authorization Management Program) control
export interface GovRAMPControl extends BaseControl {
  baselines: GovRAMPBaselines;
  core_control: boolean;
  discussion?: string | null;
}

// AIUC-1 evidence item
export interface AIUCEvidence {
  evidence_id: string;
  evidence_title: string;
  control_text: string;
  control_application: string;
  typical_evidence: string;
  category: string;
  location: string;
}

// AIUC-1 (AI Agent Security, Safety and Reliability Standard) control
export interface AIUCControl extends BaseControl {
  application: 'Mandatory' | 'Optional';
  frequency: string;
  capabilities: string;
  controls_evidence: AIUCEvidence[];
}

// Union type for all controls
export type Control = NistControl | PciControl | OWASPLLMRisk | FedRampKSIControl | CISControl | ISO27001Control | SOC2Control | NistCSFControl | FedRAMPControl | DoDSRGControl | STIGControl | AIRMFControl | EUAIActControl | ITSG33Control | SSDFControl | NIST171Control | CMMCControl | AdobeCCFControl | TXRAMPControl | GovRAMPControl | AIUCControl;

// Type guards
export function isNistControl(control: Control): control is NistControl {
  return 'baseline_low' in control;
}

export function isPciControl(control: Control): control is PciControl {
  return 'testing_procedures' in control || 'guidance' in control;
}

export function isOWASPLLMRisk(control: Control): control is OWASPLLMRisk {
  return 'prevention_strategies' in control || 'attack_scenarios' in control;
}

export function isFedRampKSIControl(control: Control): control is FedRampKSIControl {
  return 'impact_low' in control;
}

export function isCISControl(control: Control): control is CISControl {
  return 'ig1' in control && 'asset_type' in control;
}

export function isFedRAMPControl(control: Control): control is FedRAMPControl {
  return 'baselines' in control && 'discussion' in control && !('core_control' in control);
}

export function isDoDSRGControl(control: Control): control is DoDSRGControl {
  return 'impact_levels' in control && typeof (control as DoDSRGControl).impact_levels === 'object';
}

export function isISO27001Control(control: Control): control is ISO27001Control {
  return 'csf_mappings' in control;
}

export function isNistCSFControl(control: Control): control is NistCSFControl {
  return 'category' in control && 'implementation_examples' in control;
}

export function isSTIGControl(control: Control): control is STIGControl {
  return 'stig_id' in control && 'check_content' in control && 'fix_text' in control;
}

export function isAIRMFControl(control: Control): control is AIRMFControl {
  return 'about' in control && 'suggested_actions' in control && 'ai_actors' in control;
}

export function isEUAIActControl(control: Control): control is EUAIActControl {
  return 'article' in control && 'risk_tier' in control;
}

export function isITSG33Control(control: Control): control is ITSG33Control {
  return 'profiles' in control && typeof (control as ITSG33Control).profiles === 'object' && !('baselines' in control);
}

export function isSSDFControl(control: Control): control is SSDFControl {
  return 'practice_id' in control && 'implementation_examples' in control;
}

export function isNIST171Control(control: Control): control is NIST171Control {
  return 'requirement_type' in control && !('cmmc_level' in control);
}

export function isCMMCControl(control: Control): control is CMMCControl {
  return 'cmmc_level' in control;
}

export function isAdobeCCFControl(control: Control): control is AdobeCCFControl {
  return 'implementation_guidance' in control || 'testing_procedure' in control || 'control_theme' in control;
}

export function isTXRAMPControl(control: Control): control is TXRAMPControl {
  return 'level1' in control && 'level2' in control;
}

export function isGovRAMPControl(control: Control): control is GovRAMPControl {
  return 'core_control' in control && 'baselines' in control;
}

export function isAIUCControl(control: Control): control is AIUCControl {
  return 'application' in control && 'controls_evidence' in control;
}

// Framework/Risk List type
export type ContentType = 'framework' | 'risk-list';

// License type
export type LicenseType = 'public-domain' | 'proprietary' | 'open-license' | 'cc-by-nd' | 'cc-by-nc-sa';

// Framework configuration
export interface FrameworkConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  hasBaselines?: boolean; // For NIST/FedRAMP low/moderate/high baseline filtering
  hasImpactLevels?: boolean; // For FedRAMP KSI impact filtering
  hasImplementationGroups?: boolean; // For CIS Controls IG1/IG2/IG3 filtering
  hasSeverityLevels?: boolean; // For STIGs CAT I/II/III filtering
  hasRiskTiers?: boolean; // For EU AI Act risk tier filtering
  hasCMMCLevels?: boolean; // For CMMC Level 1/2/3 filtering
  hasTXRAMPLevels?: boolean; // For TX-RAMP Level 1/2 filtering
  familyLabel: string; // "Family" for NIST, "Requirement" for PCI-DSS, "Risk Category" for OWASP
  underConstruction?: boolean; // Flag for frameworks still being developed
  type: ContentType; // 'framework' or 'risk-list'
  tags?: string[]; // e.g., ['AI'] for AI-related content
  itemLabel: string; // "controls", "requirements", "risks" - what to call individual items
  officialUrl?: string; // Link to official documentation
  customDisclaimer?: string; // HTML string for custom disclaimer (overrides default)
  license: LicenseType; // Public domain or proprietary
  /** Source of framework data if derived from another source (e.g., upstream mapping files) */
  dataSource?: {
    name: string;        // e.g., "Adobe CCF Open Source"
    version?: string;    // e.g., "2025.4"
    url: string;         // e.g., "https://github.com/AdobeDocs/adobe-ccf"
    license: string;     // e.g., "CC BY-ND 4.0"
    licenseUrl: string;  // e.g., "https://creativecommons.org/licenses/by-nd/4.0/"
  };
}

// Framework data structure (JSON file format)
export interface FrameworkData {
  framework: {
    id: string;
    name: string;
    version: string;
    description: string;
  };
  families: Record<string, string>;
  controls: Control[];
  // Stamped by scripts/derive-related-controls.mjs when related_controls
  // were projected through the crosswalk bridge rather than curated.
  related_controls_derived?: boolean;
}

export interface Framework {
  id: string;
  name: string;
  version: string;
  description: string;
  control_count: number;
  families: string[];
}

export interface SearchEntry {
  type?: 'control';
  id: string;
  title: string;
  family: string;
  description: string;
  baselines: string[];
  href: string;
  frameworkId: string;
}

export type BaselineLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'PRIVACY' | 'LI_SAAS';
export type ImpactLevel = 'LOW' | 'MODERATE';  // For FedRAMP KSI
export type DoDImpactLevel = 'IL4_MOD' | 'IL4_HIGH' | 'IL5' | 'IL6';  // For DoD SRG
export type ImplementationGroup = 'IG1' | 'IG2' | 'IG3';
export type SeverityLevel = 'CAT_I' | 'CAT_II' | 'CAT_III';  // For STIGs (high, medium, low)
export type ITSG33Profile = 'PBMM' | 'SECRET';  // For ITSG-33 Canadian profiles
export type CMMCLevel = 1 | 2 | 3;  // For CMMC maturity levels
export type TXRAMPLevel = 'LEVEL1' | 'LEVEL2';  // For TX-RAMP certification levels

// Cross-framework mapping data
export interface CrosswalkMetadata {
  source: string;
  csf_version: string;
  nist_version: string;
  total_mappings: number;
  csf_subcategories: number;
  nist_controls: number;
}

export interface CrosswalkData {
  metadata: CrosswalkMetadata;
  csf_to_nist: Record<string, string[]>;
  nist_to_csf: Record<string, string[]>;
}

// Cross-framework mapping entry for display
export interface CrosswalkEntry {
  csf_id: string;
  csf_title: string;
  nist_id: string;
  nist_title: string;
}

// CSF ↔ PCI-DSS crosswalk types
export interface PCICrosswalkMetadata {
  source: string;
  csf_version: string;
  pci_version: string;
  total_mappings: number;
  csf_subcategories: number;
  pci_requirements: number;
}

export interface PCICrosswalkData {
  metadata: PCICrosswalkMetadata;
  csf_to_pci: Record<string, string[]>;
  pci_to_csf: Record<string, string[]>;
}

export interface PCICrosswalkEntry {
  csf_id: string;
  csf_title: string;
  pci_id: string;
  pci_title: string;
}

// CSF ↔ ISO 27001 crosswalk types (from NIST OLIR)
export interface ISOCrosswalkMetadata {
  source: string;
  source_url: string;
  csf_version: string;
  iso_version: string;
  total_mappings: number;
  iso_controls: number;
  csf_elements: number;
}

export interface ISOCrosswalkData {
  metadata: ISOCrosswalkMetadata;
  iso_to_csf: Record<string, string[]>;
  csf_to_iso: Record<string, string[]>;
}

// ============================================
// Technology Guidance Types
// ============================================

// Technology categories for grouping
export type TechnologyCategory =
  | 'identity'
  | 'containerized'
  | 'security-tools'
  | 'cloud'
  | 'devsecops'
  | 'ai';

// Authoritative source types
export type AuthoritativeSourceType =
  | 'nist'
  | 'cis'
  | 'disa-stig'
  | 'vendor'
  | 'csa'
  | 'owasp'
  | 'cisa'
  | 'soc2'
  | 'iso'
  | 'ccm'
  | 'community';

// Configuration example from authoritative source
export interface ConfigExample {
  title: string;           // "Enable MFA for all users"
  comparisonTitle?: string; // Optional neutral heading for GOOD/BAD comparison snippets
  language: string;        // "json", "yaml", "hcl", "bash", "powershell"
  code: string;            // The actual config snippet
  source?: string;         // "NIST SP 800-63B Section 4.2"
  sourceUrl?: string;      // Clickable link for the source
  discussion?: string;     // Optional: Detailed explanation of how this satisfies the control
}

// Kubernetes guidance with section-level narrative and examples
export interface KubernetesGuidance {
  overview: string;                    // "What this control means in practice" explanation
  attribute_examples?: string[];       // Common attributes (data classification, tenant context, etc.)
  examples: ConfigExample[];           // Implementation code examples
  validation?: string;                 // "How to validate" guidance
}

// Reference to authoritative guidance document
export interface AuthoritativeSource {
  id?: string;
  type: AuthoritativeSourceType;
  title: string;           // "NIST SP 800-63B Digital Identity Guidelines"
  url: string;             // Link to official source
  summary: string;         // Brief 2-3 sentence summary of key points
  section?: string;        // Optional: specific section reference
  configExamples?: ConfigExample[];  // Optional: code snippets from this source
  additionalUrls?: { label: string; url: string }[];  // Optional: extra reference links shown alongside primary
}

// Verification command types
export type TechCommandType = 'cli' | 'api' | 'query' | 'config';
export type TechCommandScope = 'local' | 'repo' | 'org';

// Verification command
export interface TechCommand {
  description: string;
  command: string;
  type: TechCommandType;
  group?: string;
  scope?: TechCommandScope;
  notes?: string;
}

// Customer configuration responsibilities for a technology
export interface TechResponsibilityItem {
  title: string;
  description?: string;
  controls?: string[];
}

export interface TechResponsibilitySection {
  title: string;
  description?: string;
  items: TechResponsibilityItem[];
}

// Control mapping to frameworks
export interface ControlMapping {
  frameworkId: string;
  controlIds: string[];
}

// RSC (Reference Security Configuration) content blocks — discriminated union
export interface RscCodeBlock { type: 'code'; language: string; code: string }
export interface RscTextBlock { type: 'text'; html: string }
export interface RscHeadingBlock { type: 'heading'; level: 2 | 3 | 4; text: string }
export interface RscListBlock { type: 'list'; items: string[]; ordered: boolean }
export interface RscTableBlock { type: 'table'; headers?: string[]; rows: string[][] }
export type RscContentBlock = RscCodeBlock | RscTextBlock | RscHeadingBlock | RscListBlock | RscTableBlock;

export interface RscRequirement {
  id: string;           // e.g. 'FRR-RSC-01'
  title: string;        // e.g. 'Administrative Accounts'
  applicable: boolean;
  blocks: RscContentBlock[];
  controlIds: string[]; // e.g. ['AC-2', 'AC-6']
}

export interface RscServiceData {
  serviceId: string;
  serviceName: string;
  lastUpdated: string;
  overview: string;              // HTML-cleaned executive summary
  securitySensitivity?: string;
  impactLevels?: { confidentiality: string; integrity: string; availability: string };
  requirements: RscRequirement[];
}

// Technology guide section (view into parent's flat data arrays)
export interface TechnologyGuideSection {
  id: string;
  title: string;
  description: string;
  sourceIds?: string[];           // Match by source title substring
  responsibilityTitles?: string[]; // Match by section title
  commandGroups?: string[];       // Match by command group name
  controlMappingFrameworks?: string[];
  rscServiceId?: string;          // Key into AWS_RSC_DATA for RSC sections
}

export type TechnologyGuidePlaybookPriority = 'critical' | 'high' | 'medium';

export interface TechnologyGuideTool {
  id: string;
  name: string;
  summary: string;
  repo?: string;
  url?: string;
  quickCommand?: string;
  notes?: string;
}

export interface TechnologyGuidePlaybookSection {
  id: string;
  title: string;
  priority: TechnologyGuidePlaybookPriority;
  summary: string;
  actions: string[];
  examples: ConfigExample[];
  commands: TechCommand[];
  sourceIds: string[];
  toolIds?: string[];
}

export interface TechnologyGuidePlaybook {
  intro: string;
  sections: TechnologyGuidePlaybookSection[];
}

// Main technology guide entry
export interface TechnologyGuide {
  id: string;                           // URL slug: "okta"
  name: string;                         // "Okta"
  category: TechnologyCategory;
  vendor?: string;
  description: string;                  // One-line overview
  officialUrl?: string;                 // Vendor docs link

  // Authoritative guidance (link & summarize)
  authoritativeSources: AuthoritativeSource[];

  // Verification/testing commands (our value-add)
  commands: TechCommand[];

  // Customer configuration responsibilities
  responsibilities?: TechResponsibilitySection[];

  // Control mappings
  controlMappings: ControlMapping[];

  relatedTechnologies?: string[];

  /** GitHub repos to display as cards: `owner/repo`, or `owner/repo/path` for a directory in a monorepo */
  githubRepos?: string[];

  tools?: TechnologyGuideTool[];

  playbook?: TechnologyGuidePlaybook;

  // Optional subpage sections (view-based, not data duplication)
  sections?: TechnologyGuideSection[];
}

// ============================================
// Unified Search Types (for /search page)
// ============================================

export type SearchEntryType = 'control' | 'framework' | 'guide' | 'crosswalk' | 'page';

export interface ControlSearchEntry {
  type: 'control';
  id: string;
  title: string;
  family: string;
  description: string;
  baselines: string[];
  href: string;
  frameworkId: string;
  tags: string[];
}

export interface FrameworkSearchEntry {
  type: 'framework';
  frameworkId: string;
  title: string;
  description: string;
  href: string;
  controlCount: number;
  version: string;
  tags: string[];
}

export interface GuideSearchEntry {
  type: 'guide';
  title: string;
  description: string;
  href: string;
  category: string;
  vendor?: string;
  tags: string[];
}

export interface CrosswalkSearchEntry {
  type: 'crosswalk';
  title: string;
  description: string;
  href: string;
  fromFramework: string;
  toFramework: string;
  tags: string[];
}

export interface PageSearchEntry {
  type: 'page';
  title: string;
  description: string;
  href: string;
  tags: string[];
}

export type UnifiedSearchEntry =
  | ControlSearchEntry
  | FrameworkSearchEntry
  | GuideSearchEntry
  | CrosswalkSearchEntry
  | PageSearchEntry;

// ============================================
// Trust Center Types (FedRAMP 20x KSI)
// ============================================

export type TrustCenterCategory =
  | 'documents-reports'
  | 'policies'
  | 'certifications-badges'
  | 'architecture-diagrams'
  | 'dashboards'
  | 'product-security-features'
  | 'evidence-artifacts'
  | 'questionnaire-responses'
  | 'vendor-supply-chain'
  | 'processes-procedures';

export interface TrustCenterCategoryMeta {
  id: TrustCenterCategory;
  name: string;
  color: string; // Tailwind color prefix (e.g., 'blue', 'emerald')
}

export interface TrustCenterComponent {
  name: string;
  category: TrustCenterCategory;
  description: string;
  examples?: string[];
  evidenceExamples?: string[];   // Concrete evidence artifacts (real-world artifacts)
  validationHint?: string;       // How this component gets validated
}

export interface KSITrustCenterMapping {
  ksiId: string;
  implementationInsight?: string;  // Real-world implementation insight for this KSI
  components: TrustCenterComponent[];
}

// ============================================
// KSI Programmatic Query Types (FedRAMP 20x)
// ============================================

export type KSIToolCategory = 'cloud' | 'identity' | 'cicd' | 'security' | 'infrastructure' | 'grc';

export interface KSIToolCommand {
  description: string;
  command: string;
}

export interface KSITool {
  id: string;
  name: string;
  category: KSIToolCategory;
  commands: KSIToolCommand[];
  docs?: string;
}

export interface KSIProgrammaticQuery {
  ksiId: string;
  title: string;
  tools: KSITool[];
}

// Category metadata for display
export interface TechnologyCategoryMeta {
  id: TechnologyCategory;
  name: string;
  description: string;
  icon: string;  // SVG path or icon name
  path?: string;
  detailPathPrefix?: string;
}
