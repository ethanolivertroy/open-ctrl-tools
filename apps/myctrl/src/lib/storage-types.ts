import type { ProviderId } from './ai/providers';
import type { AssessmentTargetBaseline } from './assessment-frameworks';
import type { AssessmentCryptoModule, CryptoUsageType } from './cmvp';

export interface FilterPreset {
  id: string;
  name: string;
  categories: string[];
  searchTerm: string;
  createdAt: number;
}

export interface FavoriteFramework {
  frameworkId: string;
  notes: string;
  addedAt: number;
}

export interface ControlNote {
  projectId: string;
  frameworkId: string;
  controlSlug: string;
  notes: string;
  updatedAt: number;
}

export interface RecentlyViewed {
  type: 'framework' | 'control';
  frameworkId: string;
  controlSlug?: string;
  title: string;
  href: string;
  viewedAt: number;
}

export interface SavedView {
  id: string;
  projectId: string;
  name: string;
  prompt: string;
  viewJson: string;
  source?: 'build' | 'assessment' | 'control';
  frameworkId?: string;
  controlId?: string;
  family?: string;
  assessmentId?: string;
  baseline?: string;
  systemName?: string;
  createdAt: number;
  /** Schema version: 1 = legacy ViewSchema, 2 = current ViewSchema runtime-rendered through json-render */
  version?: number;
}

export type ImplementationStatus =
  | 'not-assessed'
  | 'not-implemented'
  | 'partially-implemented'
  | 'planned'
  | 'implemented'
  | 'not-applicable';

/** An assessment is a named collection of control statuses (e.g., "FedRAMP Annual 2026") */
export interface Assessment {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetFrameworks: string[];
  createdAt: number;
  updatedAt: number;
  assessorName?: string;
  assessorOrg?: string;
  systemName?: string;
  targetBaseline?: AssessmentTargetBaseline;
  crosswalkSources?: CrosswalkSource[];
}

/** A framework the user claims compliance with, used for crosswalk auto-fill */
export interface CrosswalkSource {
  frameworkId: string;
  complianceLevel: 'full' | 'partial';
}

/**
 * Control status within a specific assessment.
 * Key: "assessmentId:frameworkId:controlId"
 * Uses delta model — only controls with explicit statuses are stored.
 */
export interface ControlStatus {
  id: string;
  assessmentId: string;
  frameworkId: string;
  controlId: string;
  status: ImplementationStatus;
  owner?: string;
  notes?: string;
  updatedAt: number;
  autoSuggested?: boolean;
  autoSuggestSource?: string;
  confidence?: 'high' | 'medium' | 'low';
  linkedCmvpModuleIds?: string[];
}

export type { AssessmentCryptoModule, CryptoUsageType };

import { getThemeColor, SEMANTIC_COLORS, type SemanticColor } from './theme';

/** Semantic color tokens for owner categories — resolved at render time */
export const OWNER_COLOR_TOKENS: Record<string, SemanticColor> = {
  Platform: 'blue',
  Security: 'red',
  DevOps: 'green',
  Compliance: 'mauve',
  Network: 'peach',
  Identity: 'teal',
  Data: 'yellow',
  Application: 'pink',
};

/** Resolve owner → current theme hex color. Call from client components only. */
export function getOwnerColor(owner: string): string {
  const token = OWNER_COLOR_TOKENS[owner];
  return token ? getThemeColor(SEMANTIC_COLORS[token]) : '#888888';
}

/** Static fallback for SSR / non-reactive contexts (Macchiato defaults) */
export const OWNER_COLORS: Record<string, string> = {
  Platform: '#8aadf4',
  Security: '#ed8796',
  DevOps: '#a6da95',
  Compliance: '#c6a0f6',
  Network: '#f5a97f',
  Identity: '#8bd5ca',
  Data: '#eed49f',
  Application: '#f5bde6',
};

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AgentConversation {
  id: string;
  assessmentId: string;
  controlId: string;
  frameworkId: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
  userId?: string | null;
}

export type AgentThreadMode = 'per-session' | 'per-action';

/** Default assessment ID for backwards compatibility */
export const DEFAULT_ASSESSMENT_ID = '_default';
export const DEFAULT_PROJECT_ID = '_default-project';
export const DEFAULT_PROJECT_NAME = 'General';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/** Semantic color tokens for implementation statuses */
export const STATUS_COLOR_TOKENS: Record<ImplementationStatus, SemanticColor> = {
  'not-assessed': 'overlay2',
  'not-implemented': 'red',
  'partially-implemented': 'yellow',
  planned: 'sapphire',
  implemented: 'green',
  'not-applicable': 'surface2',
};

/** Resolve status → current theme hex color. Call from client components only. */
export function getStatusColor(status: ImplementationStatus): string {
  return getThemeColor(SEMANTIC_COLORS[STATUS_COLOR_TOKENS[status]]);
}

/** Static fallback for SSR / non-reactive contexts (Macchiato defaults) */
export const STATUS_COLORS: Record<ImplementationStatus, string> = {
  'not-assessed': '#939ab7',
  'not-implemented': '#ed8796',
  'partially-implemented': '#eed49f',
  planned: '#89b4fa',
  implemented: '#a6da95',
  'not-applicable': '#494d64',
};

export const STATUS_LABELS: Record<ImplementationStatus, string> = {
  'not-assessed': 'Not Assessed',
  'not-implemented': 'Not Implemented',
  'partially-implemented': 'Partial',
  planned: 'Planned',
  implemented: 'Implemented',
  'not-applicable': 'N/A',
};

export interface Setting {
  key: string;
  value: string;
}

export type ProviderAuthType = 'api-key' | 'oauth';

export interface ProviderOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface ProviderConfigRecord {
  providerId: ProviderId;
  apiKey?: string;
  authType?: ProviderAuthType;
  oauth?: ProviderOAuthTokens;
  model: string;
  baseUrl?: string;
  isDefault?: boolean;
  updatedAt: number;
}

export interface WhiteboardMeta {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  userId?: string | null;
}

export interface WhiteboardSnapshot {
  boardId: string;
  snapshot: unknown;
}
