export type Visibility = 'public' | 'request';
export type ResourceKind = 'certifications' | 'documents' | 'faqs' | 'subprocessors' | 'updates';
export type LifecycleStatus = 'draft' | 'review' | 'published' | 'archived';

export const LIFECYCLE_TRANSITIONS: Record<LifecycleStatus, readonly LifecycleStatus[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['archived'],
  archived: ['draft']
};

export function parseLifecycleStatus(value: unknown): LifecycleStatus {
  if (value === 'draft' || value === 'review' || value === 'published' || value === 'archived') return value;
  throw new ValidationError('Lifecycle must be draft, review, published, or archived');
}

export function canTransitionLifecycle(from: LifecycleStatus, to: LifecycleStatus): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export const LOCAL_LOGO_PATH = '/api/logo';
export const LOCAL_FAVICON_PATH = '/api/favicon';
export const LOCAL_BANNER_PATH = '/api/banner';

// Enumerations shared by the API, admin UI, and MCP tools.
export const BANNER_SETTINGS = ['GRADIENT', 'MINIMAL', 'CUSTOM_IMAGE'] as const;
export type BannerSetting = (typeof BANNER_SETTINGS)[number];

export const CONTROL_VISIBILITY_MODES = ['SHOW_OK_ONLY', 'SHOW_OK_AND_UNMAPPED', 'SHOW_ALL_WITHOUT_STATUS', 'SHOW_ALL_WITH_STATUS'] as const;
export type ControlVisibilityMode = (typeof CONTROL_VISIBILITY_MODES)[number];

export const CONTROL_STATUSES = ['OK', 'NEEDS_ATTENTION', 'UNMAPPED'] as const;
export type ControlStatus = (typeof CONTROL_STATUSES)[number];

export const CONTROL_CATEGORY_VISIBILITIES = ['PUBLIC', 'SHAREABLE'] as const;
export type ControlCategoryVisibility = (typeof CONTROL_CATEGORY_VISIBILITIES)[number];

export const DATA_COLLECTED_STATUSES = ['COLLECTED', 'HIDDEN', 'NOT_COLLECTED'] as const;
export type DataCollectedStatus = (typeof DATA_COLLECTED_STATUSES)[number];

export const UPDATE_CATEGORIES = ['GENERAL', 'COMPLIANCE', 'SECURITY', 'PRIVACY', 'INCIDENT', 'ROADMAP'] as const;
export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number];

export const UPDATE_VISIBILITY_TYPES = ['PUBLIC', 'PRIVATE'] as const;
export type UpdateVisibilityType = (typeof UPDATE_VISIBILITY_TYPES)[number];

export const VIEWER_ACCESS_LEVELS = ['FULL_ACCESS', 'PARTIAL_ACCESS'] as const;
export type ViewerAccessLevel = (typeof VIEWER_ACCESS_LEVELS)[number];

export const CATEGORY_KINDS = ['resource', 'faq', 'control'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const FRAMEWORK_STANDARDS = [
  'aiact', 'aiuc1', 'aue8', 'awsFTR', 'bsic5', 'ccpa', 'cisv8', 'cjis', 'cmmc2', 'cps234', 'cri', 'dora',
  'fedRAMPr5', 'fedramp', 'fedramp20x', 'fedramp20x_2026', 'gdpr', 'hipaa', 'hitruste1', 'iso9001', 'iso27001',
  'iso27001_2022', 'iso27017', 'iso27018', 'iso27701', 'iso27701_2025', 'iso42001', 'msftSSPA', 'mvsp', 'nis2d',
  'nist53', 'nist171', 'nist171r3', 'nistAiRmf', 'nistCSF', 'nistcsf2', 'ofdss', 'pciDss4', 'pciSaqA', 'pciSaqAEP',
  'pciSaqDMerchant', 'pciSaqDSP', 'soc2', 'soxITGC', 't23nycrr500', 'tisax', 'tisax2027', 'iso22301', 'trust',
  'ukCyberEssentials', 'ukCyberEssentials33', 'usDataPrivacy', 'fedrampKSI'
] as const;
export type FrameworkStandard = (typeof FRAMEWORK_STANDARDS)[number];

export interface SiteConfig {
  companyName: string;
  title: string;
  headline: string;
  summary: string;
  securityEmail: string;
  location: string;
  accent: string;
  secondaryColor: string;
  logoUrl: string;
  logoObjectKey: string | null;
  faviconObjectKey: string | null;
  privacyPolicyUrl: string;
  isPublic: boolean;
  bannerSetting: BannerSetting;
  bannerStartColor: string;
  bannerEndColor: string;
  bannerObjectKey: string | null;
  controlVisibilityMode: ControlVisibilityMode;
  dataCollectedHeading: string;
  createdAt: string;
  updatedAt: string;
}

export interface Certification {
  id: string;
  name: string;
  status: string;
  description: string;
  standard: FrameworkStandard | null;
  badgeObjectKey: string | null;
  lifecycle: LifecycleStatus;
  sortOrder: number;
}

export interface DocumentRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryId: string | null;
  visibility: Visibility;
  sourceType: 'external' | 'r2';
  url: string | null;
  objectKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  version: string;
  publishedAt: string | null;
  reviewAt: string | null;
  lifecycle: LifecycleStatus;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  categoryId: string | null;
  lifecycle: LifecycleStatus;
  sortOrder: number;
}

export interface Subprocessor {
  id: string;
  name: string;
  description: string;
  purpose: string;
  location: string;
  url: string;
  lifecycle: LifecycleStatus;
  sortOrder: number;
}

export interface UpdateRecord {
  id: string;
  title: string;
  body: string;
  category: UpdateCategory;
  visibilityType: UpdateVisibilityType;
  publishedAt: string;
  lifecycle: LifecycleStatus;
  notifiedAt: string | null;
}

export interface Video {
  id: string;
  url: string;
  title: string;
  description: string;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ControlCategory extends Category {
  visibility: ControlCategoryVisibility;
  statusVisibilityOverride: ControlVisibilityMode | null;
}

export interface ControlMembership {
  categoryId: string;
  sortOrder: number;
}

export interface ControlRecord {
  id: string;
  externalId: string | null;
  name: string;
  description: string;
  status: ControlStatus;
  tags: Record<string, string[]>;
  memberships: ControlMembership[];
  createdAt: string;
}

export interface DataCollectedItem {
  id: string;
  dataCollected: string;
  status: DataCollectedStatus;
  sortOrder: number;
}

export interface SubscriberRecord {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'unsubscribed';
  createdAt: string;
  confirmedAt: string | null;
}

export interface AccessRequestRecord {
  id: string;
  name: string;
  email: string;
  company: string;
  reason: string;
  requestedResources: string[] | null;
  accessLevel: ViewerAccessLevel;
  status: 'pending' | 'approved' | 'denied';
  denialReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewerRecord {
  id: string;
  email: string;
  name: string;
  companyName: string;
  accessLevel: ViewerAccessLevel;
  resourceIds: string[] | null;
  ndaRequired: boolean;
  ndaAcceptedAt: string | null;
  expiresAt: string | null;
  tokenHash: string | null;
  addedBy: string;
  accessRequestId: string | null;
  inviteSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
}

export interface ChatbotConversation {
  id: string;
  firstMessage: string;
  numMessages: number;
  userEmail: string | null;
  isPublicConversation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  message: string;
  references: string[];
  createdAt: string;
}

export interface TrustCenterState {
  site: SiteConfig;
  certifications: Certification[];
  documents: DocumentRecord[];
  faqs: Faq[];
  subprocessors: Subprocessor[];
  updates: UpdateRecord[];
  videos: Video[];
  resourceCategories: Category[];
  faqCategories: Category[];
  controlCategories: ControlCategory[];
  controls: ControlRecord[];
  dataCollected: DataCollectedItem[];
}

/** Full-table counts, because the admin lists themselves are capped. */
export interface AdminTotals {
  subscribers: number;
  activeSubscribers: number;
  accessRequests: number;
  pendingAccessRequests: number;
}

export interface AdminState extends TrustCenterState {
  subscribers: SubscriberRecord[];
  accessRequests: AccessRequestRecord[];
  viewers: ViewerRecord[];
  chatbotConversations: ChatbotConversation[];
  auditLog: Array<Record<string, unknown>>;
  emailOutbox: Array<Record<string, unknown>>;
  totals: AdminTotals;
}

type ImportItem<T> = Partial<Omit<T, 'lifecycle' | 'notifiedAt'>> & { visible?: boolean };

export interface ImportControlCategory extends Partial<Omit<ControlCategory, 'id'>> {
  name: string;
  controls?: Array<Partial<Omit<ControlRecord, 'id' | 'memberships' | 'createdAt'>> & { name: string }>;
}

export interface ImportBundle {
  source: 'manual';
  site: Partial<SiteConfig> & Pick<SiteConfig, 'companyName' | 'headline' | 'summary'>;
  certifications?: Array<ImportItem<Certification>>;
  documents?: Array<ImportItem<DocumentRecord> & { category?: string }>;
  faqs?: Array<ImportItem<Faq> & { category?: string }>;
  subprocessors?: Array<ImportItem<Subprocessor>>;
  updates?: Array<ImportItem<UpdateRecord>>;
  videos?: Array<Partial<Omit<Video, 'id'>> & { url: string; title: string }>;
  controlCategories?: ImportControlCategory[];
  dataCollected?: Array<{ dataCollected: string; status: DataCollectedStatus }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function cleanText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return '';
    throw new ValidationError(`${label} must be text`);
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new ValidationError(`${label} is required`);
  if (cleaned.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer`);
  return cleaned;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], label: string, fallback?: T): T {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(`${label} is required`);
  }
  if (typeof value === 'string' && (options as readonly string[]).includes(value)) return value as T;
  throw new ValidationError(`${label} must be one of ${options.join(', ')}`);
}

export const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export function requireId(value: unknown, label = 'id'): string {
  if (typeof value === 'string' && ID_PATTERN.test(value)) return value;
  throw new ValidationError(`${label} must be a valid identifier`);
}

export function optionalId(value: unknown, label = 'id'): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireId(value, label);
}

export function idList(value: unknown, label: string, max = 500): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) throw new ValidationError(`${label} must be a list of at most ${max} identifiers`);
  return [...new Set(value.map((item) => requireId(item, label)))];
}

export function emailList(value: unknown, label: string, max = 100): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) throw new ValidationError(`${label} must be a list of at most ${max} email addresses`);
  return [...new Set(value.map((item) => normalizeEmail(item)))];
}

export function optionalBoolean(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  throw new ValidationError(`${label} must be true or false`);
}

export function optionalDateTime(value: unknown, label = 'Date'): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = cleanText(value, label, 40);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${label} must be an ISO 8601 date`);
  return date.toISOString();
}

function hexColor(value: unknown, label: string, fallback: string | null): string {
  if (value === undefined || value === null || value === '') {
    if (fallback === null) return '';
    return fallback;
  }
  const text = cleanText(value, label, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(text)) throw new ValidationError(`${label} must be a six-digit hex value`);
  return text.toLowerCase();
}

export function publicSiteView(site: SiteConfig) {
  const {
    logoObjectKey: _logo,
    faviconObjectKey,
    bannerObjectKey,
    ...rest
  } = site;
  return {
    ...rest,
    title: site.title || `${site.companyName} Trust Center`,
    faviconUrl: faviconObjectKey ? LOCAL_FAVICON_PATH : '',
    bannerSetting: {
      setting: site.bannerSetting,
      startColor: site.bannerSetting === 'GRADIENT' ? site.bannerStartColor || site.accent : null,
      endColor: site.bannerSetting === 'GRADIENT' ? site.bannerEndColor || site.secondaryColor || site.accent : null,
      imageUrl: site.bannerSetting === 'CUSTOM_IMAGE' && bannerObjectKey ? LOCAL_BANNER_PATH : null
    },
    customTheme: {
      primary: site.accent,
      secondary: site.secondaryColor || null
    }
  };
}

export type PublicSiteView = ReturnType<typeof publicSiteView>;

function publishedOnly<T extends { lifecycle: LifecycleStatus }>(items: T[]): T[] {
  return items.filter((item) => item.lifecycle === 'published');
}

function byOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function controlIsVisible(status: ControlStatus, mode: ControlVisibilityMode): boolean {
  if (mode === 'SHOW_OK_ONLY') return status === 'OK';
  if (mode === 'SHOW_OK_AND_UNMAPPED') return status !== 'NEEDS_ATTENTION';
  return true;
}

export function publicControlCategories(state: TrustCenterState, includeShareable: boolean) {
  const ordered = byOrder(state.controlCategories).filter((category) => includeShareable || category.visibility === 'PUBLIC');
  return ordered.map((category) => {
    const mode = category.statusVisibilityOverride ?? state.site.controlVisibilityMode;
    const showStatus = mode !== 'SHOW_ALL_WITHOUT_STATUS';
    const controls = state.controls
      .map((control) => ({ control, membership: control.memberships.find((entry) => entry.categoryId === category.id) }))
      .filter((entry): entry is { control: ControlRecord; membership: ControlMembership } => Boolean(entry.membership))
      .sort((a, b) => a.membership.sortOrder - b.membership.sortOrder || a.control.name.localeCompare(b.control.name))
      .filter(({ control }) => controlIsVisible(control.status, mode))
      .map(({ control }) => ({
        id: control.id,
        name: control.name,
        description: control.description,
        tags: control.tags,
        ...(showStatus ? { status: control.status } : {})
      }));
    return {
      id: category.id,
      name: category.name,
      visibility: category.visibility,
      statusVisibilityMode: mode,
      controls
    };
  });
}

function documentCategoryName(document: DocumentRecord, categories: Category[]): string {
  const match = document.categoryId ? categories.find((category) => category.id === document.categoryId) : undefined;
  return match?.name ?? document.category ?? '';
}

function categoryRank(categoryId: string | null, categories: Category[]): number {
  if (!categoryId) return Number.MAX_SAFE_INTEGER;
  const match = categories.find((category) => category.id === categoryId);
  return match ? match.sortOrder : Number.MAX_SAFE_INTEGER - 1;
}

export interface SnapshotOptions {
  viewer?: {
    accessLevel: ViewerAccessLevel;
    resourceIds: string[] | null;
    ndaSatisfied: boolean;
  };
}

export function publicSnapshot(state: TrustCenterState, options: SnapshotOptions = {}) {
  const viewer = options.viewer;
  const resourceCategories = byOrder(state.resourceCategories);
  const faqCategories = byOrder(state.faqCategories);
  const documents = publishedOnly(state.documents)
    .sort((a, b) => categoryRank(a.categoryId, resourceCategories) - categoryRank(b.categoryId, resourceCategories) || a.title.localeCompare(b.title))
    .map(({ lifecycle: _lifecycle, objectKey: _objectKey, ...item }) => {
      const category = documentCategoryName(item as DocumentRecord, resourceCategories);
      const base = { ...item, category };
      if (item.visibility !== 'request') return { ...base, accessible: true };
      const { url: _url, ...gatedItem } = base;
      const allowed = Boolean(viewer) && viewer!.ndaSatisfied &&
        (viewer!.accessLevel === 'FULL_ACCESS' || (viewer!.resourceIds ?? []).includes(item.id));
      return { ...gatedItem, accessible: allowed };
    });
  const updates = publishedOnly(state.updates)
    .filter((item) => item.visibilityType === 'PUBLIC' || Boolean(viewer))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map(({ lifecycle: _lifecycle, notifiedAt: _notifiedAt, ...item }) => item);
  return {
    site: publicSiteView(state.site),
    certifications: byOrder(publishedOnly(state.certifications))
      .map(({ lifecycle: _lifecycle, badgeObjectKey, ...item }) => ({
        ...item,
        badgeUrl: badgeObjectKey ? `/api/certifications/${encodeURIComponent(item.id)}/badge` : null
      })),
    documents,
    resourceCategories: resourceCategories.map(({ id, name }) => ({ id, name })),
    faqs: byOrder(publishedOnly(state.faqs))
      .map(({ lifecycle: _lifecycle, ...item }) => ({
        ...item,
        category: item.categoryId ? faqCategories.find((category) => category.id === item.categoryId)?.name ?? null : null
      })),
    faqCategories: faqCategories.map(({ id, name }) => ({ id, name })),
    subprocessors: byOrder(publishedOnly(state.subprocessors))
      .map(({ lifecycle: _lifecycle, ...item }) => item),
    updates,
    videos: byOrder(state.videos).map(({ sortOrder: _order, ...item }) => item),
    controlCategories: publicControlCategories(state, Boolean(viewer)),
    dataCollected: {
      heading: state.site.dataCollectedHeading,
      items: byOrder(state.dataCollected)
        .filter((item) => item.status !== 'HIDDEN')
        .map(({ dataCollected, status }) => ({ dataCollected, status }))
    }
  };
}

export function privateSnapshot(state: TrustCenterState) {
  const site = publicSiteView(state.site);
  return {
    private: true as const,
    site: {
      companyName: site.companyName,
      title: site.title,
      headline: site.headline,
      securityEmail: site.securityEmail,
      accent: site.accent,
      logoUrl: site.logoUrl,
      faviconUrl: site.faviconUrl,
      isPublic: false as const,
      customTheme: site.customTheme,
      bannerSetting: site.bannerSetting
    }
  };
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Enter a valid email address');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ValidationError('Enter a valid email address');
  }
  return email;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [a = 0, b = 0] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export function safePublicUrl(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Enter a public HTTPS URL');
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ValidationError('Enter a public HTTPS URL');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const unsafeName = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') || hostname.endsWith('.internal');
  const unsafeIpv6 = hostname === '::1' || hostname.startsWith('fc') ||
    hostname.startsWith('fd') || hostname.startsWith('fe80:');
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') || unsafeName || isPrivateIpv4(hostname) || unsafeIpv6) {
    throw new ValidationError('Enter a public HTTPS URL');
  }
  return url.toString();
}

export function optionalPublicUrl(value: unknown, label: string): string {
  const raw = cleanText(value, label, 500, false);
  return raw ? safePublicUrl(raw) : '';
}

export function safeDocumentUrl(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Enter a safe document URL');
  const candidate = value.trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      throw new ValidationError('Enter a safe document URL');
    }
    const safePath = /^\/(?:demo|public-documents)\/[a-zA-Z0-9._/-]+$/.test(decoded) &&
      !decoded.split('/').some((segment) => segment === '.' || segment === '..') &&
      !decoded.includes('\\');
    if (safePath) return candidate;
    throw new ValidationError('Enter a safe document URL');
  }
  try {
    return safePublicUrl(candidate);
  } catch {
    throw new ValidationError('Enter a safe document URL');
  }
}

export function normalizeLogoUrl(value: unknown): string {
  const raw = cleanText(value, 'Logo URL', 500, false);
  if (!raw) return '';
  if (raw === LOCAL_LOGO_PATH) return LOCAL_LOGO_PATH;
  return safePublicUrl(raw);
}

export function hasUploadedLogo(site: Pick<SiteConfig, 'logoUrl' | 'logoObjectKey'>): boolean {
  return site.logoUrl === LOCAL_LOGO_PATH && Boolean(site.logoObjectKey);
}

const STORED_SITE_KEYS = ['logoObjectKey', 'faviconObjectKey', 'bannerObjectKey', 'createdAt'] as const;

export function mergeSiteUpdate(current: SiteConfig, patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current, ...patch };
  // Stored object keys and creation time are managed by upload routes, never by a profile save.
  for (const key of STORED_SITE_KEYS) next[key] = current[key];
  if (Object.prototype.hasOwnProperty.call(patch, 'logoUrl')) {
    const raw = patch.logoUrl;
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim());
    if (empty && hasUploadedLogo(current)) {
      next.logoUrl = LOCAL_LOGO_PATH;
    }
  }
  if (next.logoUrl !== LOCAL_LOGO_PATH) next.logoObjectKey = null;
  return next;
}

export function storedLogoKeyToDelete(current: SiteConfig, next: SiteConfig): string | null {
  if (!current.logoObjectKey || current.logoObjectKey === next.logoObjectKey) return null;
  return current.logoObjectKey;
}

export function validateSite(value: unknown, updatedAt: string): SiteConfig {
  if (!isRecord(value)) throw new ValidationError('Site settings must be an object');
  const accent = hexColor(value.accent ?? value.primaryColor, 'Accent color', '#1f6b52');
  const logoUrl = normalizeLogoUrl(value.logoUrl);
  const logoObjectKey = logoUrl === LOCAL_LOGO_PATH && typeof value.logoObjectKey === 'string' && value.logoObjectKey
    ? cleanText(value.logoObjectKey, 'Logo object key', 500)
    : null;
  const bannerSetting = oneOf(value.bannerSetting, BANNER_SETTINGS, 'Banner setting', 'MINIMAL');
  const createdAt = typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : updatedAt;
  return {
    companyName: cleanText(value.companyName, 'Company name', 120),
    title: cleanText(value.title, 'Title', 160, false),
    headline: cleanText(value.headline, 'Headline', 180),
    summary: cleanText(value.summary, 'Summary', 2400),
    securityEmail: normalizeEmail(value.securityEmail),
    location: cleanText(value.location, 'Location', 160),
    accent,
    secondaryColor: hexColor(value.secondaryColor, 'Secondary color', null),
    logoUrl,
    logoObjectKey,
    faviconObjectKey: typeof value.faviconObjectKey === 'string' && value.faviconObjectKey ? value.faviconObjectKey : null,
    privacyPolicyUrl: optionalPublicUrl(value.privacyPolicyUrl, 'Privacy policy URL'),
    isPublic: optionalBoolean(value.isPublic, 'isPublic', true),
    bannerSetting,
    bannerStartColor: hexColor(value.bannerStartColor, 'Banner start color', null),
    bannerEndColor: hexColor(value.bannerEndColor, 'Banner end color', null),
    bannerObjectKey: typeof value.bannerObjectKey === 'string' && value.bannerObjectKey ? value.bannerObjectKey : null,
    controlVisibilityMode: oneOf(value.controlVisibilityMode, CONTROL_VISIBILITY_MODES, 'Control visibility mode', 'SHOW_ALL_WITH_STATUS'),
    dataCollectedHeading: cleanText(value.dataCollectedHeading, 'Data collected heading', 160, false),
    createdAt,
    updatedAt
  };
}

function arrayOfRecords(value: unknown, label: string, max = 200): Record<string, unknown>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some((item) => !isRecord(item))) {
    throw new ValidationError(`${label} must be an array with at most ${max} records`);
  }
  return value as Record<string, unknown>[];
}

function optionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = cleanText(value, 'Date', 32);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text)) throw new ValidationError('Date must use ISO format');
  return text;
}

export function sortOrder(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isInteger(numeric) || numeric < -10000 || numeric > 10000) {
    throw new ValidationError('Sort order must be an integer between -10000 and 10000');
  }
  return numeric;
}

function optionalStandard(value: unknown): FrameworkStandard | null {
  if (value === undefined || value === null || value === '') return null;
  return oneOf(value, FRAMEWORK_STANDARDS, 'Compliance standard');
}

export function normalizeResource(
  kind: ResourceKind,
  value: unknown,
  id: string,
  now: string
): Record<string, unknown> {
  if (!isRecord(value)) throw new ValidationError('Resource must be an object');
  switch (kind) {
    case 'certifications':
      return {
        id,
        name: cleanText(value.name, 'Certification name', 120),
        status: cleanText(value.status ?? 'Current', 'Certification status', 80),
        description: cleanText(value.description ?? '', 'Certification description', 500, false),
        standard: optionalStandard(value.standard),
        badgeObjectKey: typeof value.badgeObjectKey === 'string' && value.badgeObjectKey ? value.badgeObjectKey : null,
        sortOrder: sortOrder(value.sortOrder)
      };
    case 'documents': {
      const sourceType = value.sourceType === 'r2' ? 'r2' : 'external';
      const visibility = value.visibility === 'request' || value.isPublic === false ? 'request' : 'public';
      let url: string | null = null;
      if (sourceType === 'external') {
        if (!value.url && visibility === 'public') throw new ValidationError('Enter a safe document URL');
        if (value.url) url = safeDocumentUrl(value.url);
      }
      return {
        id,
        title: cleanText(value.title, 'Document title', 160),
        description: cleanText(value.description ?? '', 'Document description', 800, false),
        category: cleanText(value.category ?? '', 'Document category', 80, false),
        categoryId: optionalId(value.categoryId, 'categoryId'),
        visibility,
        sourceType,
        url,
        objectKey: sourceType === 'r2' ? cleanText(value.objectKey, 'Object key', 500) : null,
        fileName: cleanText(value.fileName ?? '', 'File name', 200, false) || null,
        mimeType: cleanText(value.mimeType ?? '', 'MIME type', 120, false) || null,
        version: cleanText(value.version ?? '1.0', 'Document version', 40),
        publishedAt: optionalDate(value.publishedAt) ?? now.slice(0, 10),
        reviewAt: optionalDate(value.reviewAt)
      };
    }
    case 'faqs':
      return {
        id,
        question: cleanText(value.question, 'FAQ question', 300),
        answer: cleanText(value.answer, 'FAQ answer', 2400),
        categoryId: optionalId(value.categoryId, 'categoryId'),
        sortOrder: sortOrder(value.sortOrder)
      };
    case 'subprocessors':
      return {
        id,
        name: cleanText(value.name, 'Subprocessor name', 120),
        description: cleanText(value.description ?? '', 'Subprocessor description', 800, false),
        purpose: cleanText(value.purpose ?? '', 'Subprocessor purpose', 500, false),
        location: cleanText(value.location ?? '', 'Subprocessor location', 160, false),
        url: value.url ? safePublicUrl(value.url) : '',
        sortOrder: sortOrder(value.sortOrder)
      };
    case 'updates':
      return {
        id,
        title: cleanText(value.title, 'Update title', 160),
        body: cleanText(value.body ?? value.description, 'Update body', 2400),
        category: oneOf(value.category, UPDATE_CATEGORIES, 'Update category', 'GENERAL'),
        visibilityType: oneOf(value.visibilityType, UPDATE_VISIBILITY_TYPES, 'Update visibility', 'PUBLIC'),
        publishedAt: optionalDate(value.publishedAt) ?? now
      };
  }
}

export function normalizeVideo(value: unknown, id: string): Video {
  if (!isRecord(value)) throw new ValidationError('Video must be an object');
  return {
    id,
    url: safePublicUrl(value.url),
    title: cleanText(value.title, 'Video title', 160),
    description: cleanText(value.description ?? '', 'Video description', 800, false),
    sortOrder: sortOrder(value.sortOrder)
  };
}

export function normalizeVideos(value: unknown, nextId: () => string): Video[] {
  if (!Array.isArray(value) || value.length > 50) throw new ValidationError('videos must be a list of at most 50 videos');
  return value.map((item, index) => ({ ...normalizeVideo(item, nextId()), sortOrder: index }));
}

export function normalizeCategoryName(value: unknown): string {
  return cleanText(value, 'Category name', 120);
}

export function normalizeControlCategoryPatch(value: unknown): Partial<Pick<ControlCategory, 'name' | 'visibility' | 'statusVisibilityOverride'>> {
  if (!isRecord(value)) throw new ValidationError('Category must be an object');
  const patch: Partial<Pick<ControlCategory, 'name' | 'visibility' | 'statusVisibilityOverride'>> = {};
  if (value.name !== undefined) patch.name = normalizeCategoryName(value.name);
  if (value.visibility !== undefined) patch.visibility = oneOf(value.visibility, CONTROL_CATEGORY_VISIBILITIES, 'Category visibility');
  if (Object.prototype.hasOwnProperty.call(value, 'statusVisibilityOverride')) {
    patch.statusVisibilityOverride = value.statusVisibilityOverride === null || value.statusVisibilityOverride === ''
      ? null
      : oneOf(value.statusVisibilityOverride, CONTROL_VISIBILITY_MODES, 'Status visibility override');
  }
  return patch;
}

export function normalizeTags(value: unknown): Record<string, string[]> {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new ValidationError('tags must be an object of tag categories to tag lists');
  const tags: Record<string, string[]> = {};
  for (const [category, list] of Object.entries(value)) {
    const key = cleanText(category, 'Tag category', 80);
    if (!Array.isArray(list) || list.length > 50) throw new ValidationError(`Tags for ${key} must be a list of at most 50 values`);
    tags[key] = [...new Set(list.map((tag) => cleanText(tag, 'Tag', 80)))];
  }
  return tags;
}

export function normalizeControl(value: unknown, id: string, now: string): Omit<ControlRecord, 'memberships'> {
  if (!isRecord(value)) throw new ValidationError('Control must be an object');
  return {
    id,
    externalId: cleanText(value.externalId ?? value.controlId ?? '', 'External control id', 120, false) || null,
    name: cleanText(value.name, 'Control name', 200),
    description: cleanText(value.description ?? '', 'Control description', 2400, false),
    status: oneOf(value.status, CONTROL_STATUSES, 'Control status', 'UNMAPPED'),
    tags: normalizeTags(value.tags),
    createdAt: now
  };
}

export function normalizeControlPatch(value: unknown): Partial<Omit<ControlRecord, 'id' | 'memberships' | 'createdAt'>> {
  if (!isRecord(value)) throw new ValidationError('Control must be an object');
  const patch: Partial<Omit<ControlRecord, 'id' | 'memberships' | 'createdAt'>> = {};
  if (value.name !== undefined) patch.name = cleanText(value.name, 'Control name', 200);
  if (value.description !== undefined) patch.description = cleanText(value.description ?? '', 'Control description', 2400, false);
  if (value.status !== undefined) patch.status = oneOf(value.status, CONTROL_STATUSES, 'Control status');
  if (value.tags !== undefined) patch.tags = normalizeTags(value.tags);
  if (value.externalId !== undefined) patch.externalId = cleanText(value.externalId ?? '', 'External control id', 120, false) || null;
  return patch;
}

export function normalizeDataCollected(value: unknown, nextId: () => string): DataCollectedItem[] {
  if (!Array.isArray(value) || value.length > 200) throw new ValidationError('dataCollected must be a list of at most 200 disclosures');
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) throw new ValidationError('Each disclosure must be an object');
    const label = cleanText(item.dataCollected ?? item.label, 'Data collected', 200);
    const key = label.toLowerCase();
    if (seen.has(key)) throw new ValidationError(`Duplicate disclosure: ${label}`);
    seen.add(key);
    return {
      id: nextId(),
      dataCollected: label,
      status: oneOf(item.status, DATA_COLLECTED_STATUSES, 'Disclosure status'),
      sortOrder: index
    };
  });
}

export function viewerIsActive(viewer: ViewerRecord, at: string): boolean {
  if (viewer.removedAt) return false;
  if (viewer.expiresAt && viewer.expiresAt <= at) return false;
  return true;
}

export function viewerNdaSatisfied(viewer: ViewerRecord): boolean {
  return !viewer.ndaRequired || Boolean(viewer.ndaAcceptedAt);
}

export function viewerCanAccessDocument(viewer: ViewerRecord, document: DocumentRecord): boolean {
  if (document.lifecycle !== 'published') return false;
  if (document.visibility === 'public') return true;
  if (!viewerNdaSatisfied(viewer)) return false;
  if (viewer.accessLevel === 'FULL_ACCESS') return true;
  return (viewer.resourceIds ?? []).includes(document.id);
}

export function normalizeImportBundle(value: unknown): { requiresReview: true; bundle: ImportBundle; counts: Record<string, number> } {
  if (!isRecord(value)) throw new ValidationError('Import bundle must be an object');
  if (value.source !== 'manual') throw new ValidationError('Content bundle source must be manual');
  const source = 'manual' as const;
  if (!isRecord(value.site)) throw new ValidationError('Import bundle requires site settings');

  const siteInput = value.site;
  const site: ImportBundle['site'] = {
    companyName: cleanText(siteInput.companyName, 'Company name', 120),
    headline: cleanText(siteInput.headline, 'Headline', 180),
    summary: cleanText(siteInput.summary, 'Summary', 2400)
  };
  if (siteInput.title !== undefined) site.title = cleanText(siteInput.title, 'Title', 160, false);
  if (siteInput.securityEmail !== undefined) site.securityEmail = normalizeEmail(siteInput.securityEmail);
  if (siteInput.location !== undefined) site.location = cleanText(siteInput.location, 'Location', 160, false);
  if (siteInput.accent !== undefined) site.accent = hexColor(siteInput.accent, 'Accent color', '#1f6b52');
  if (siteInput.secondaryColor !== undefined) site.secondaryColor = hexColor(siteInput.secondaryColor, 'Secondary color', null);
  if (siteInput.logoUrl !== undefined) site.logoUrl = normalizeLogoUrl(siteInput.logoUrl);
  if (siteInput.privacyPolicyUrl !== undefined) site.privacyPolicyUrl = optionalPublicUrl(siteInput.privacyPolicyUrl, 'Privacy policy URL');
  if (siteInput.isPublic !== undefined) site.isPublic = optionalBoolean(siteInput.isPublic, 'isPublic', true);
  if (siteInput.bannerSetting !== undefined) site.bannerSetting = oneOf(siteInput.bannerSetting, BANNER_SETTINGS, 'Banner setting');
  if (siteInput.bannerStartColor !== undefined) site.bannerStartColor = hexColor(siteInput.bannerStartColor, 'Banner start color', null);
  if (siteInput.bannerEndColor !== undefined) site.bannerEndColor = hexColor(siteInput.bannerEndColor, 'Banner end color', null);
  if (siteInput.controlVisibilityMode !== undefined) site.controlVisibilityMode = oneOf(siteInput.controlVisibilityMode, CONTROL_VISIBILITY_MODES, 'Control visibility mode');
  if (siteInput.dataCollectedHeading !== undefined) site.dataCollectedHeading = cleanText(siteInput.dataCollectedHeading, 'Data collected heading', 160, false);

  const certifications = arrayOfRecords(value.certifications, 'Certifications').map((item) => ({
    name: cleanText(item.name, 'Certification name', 120),
    status: cleanText(item.status ?? 'Current', 'Certification status', 80),
    description: cleanText(item.description ?? '', 'Certification description', 500, false),
    standard: optionalStandard(item.standard),
    visible: item.visible !== false,
    sortOrder: sortOrder(item.sortOrder)
  }));
  const documents = arrayOfRecords(value.documents, 'Documents').map((item) => {
    const visibility = item.visibility === 'request' ? 'request' as const : 'public' as const;
    const url = item.url ? safeDocumentUrl(item.url) : null;
    if (visibility === 'public' && !url) throw new ValidationError('Enter a safe document URL');
    return {
      title: cleanText(item.title, 'Document title', 160),
      description: cleanText(item.description ?? '', 'Document description', 800, false),
      category: cleanText(item.category ?? 'Security', 'Document category', 80),
      visibility,
      sourceType: 'external' as const,
      url,
      objectKey: null,
      version: cleanText(item.version ?? '1.0', 'Document version', 40),
      publishedAt: optionalDate(item.publishedAt),
      reviewAt: optionalDate(item.reviewAt),
      visible: item.visible !== false
    };
  });
  const faqs = arrayOfRecords(value.faqs, 'FAQs').map((item) => ({
    question: cleanText(item.question, 'FAQ question', 300),
    answer: cleanText(item.answer, 'FAQ answer', 2400),
    category: cleanText(item.category ?? '', 'FAQ category', 120, false),
    visible: item.visible !== false,
    sortOrder: sortOrder(item.sortOrder)
  }));
  const subprocessors = arrayOfRecords(value.subprocessors, 'Subprocessors').map((item) => ({
    name: cleanText(item.name, 'Subprocessor name', 120),
    description: cleanText(item.description ?? '', 'Subprocessor description', 800, false),
    purpose: cleanText(item.purpose ?? '', 'Subprocessor purpose', 500, false),
    location: cleanText(item.location ?? '', 'Subprocessor location', 160, false),
    url: item.url ? safePublicUrl(item.url) : '',
    visible: item.visible !== false,
    sortOrder: sortOrder(item.sortOrder)
  }));
  const updates = arrayOfRecords(value.updates, 'Updates').map((item) => ({
    title: cleanText(item.title, 'Update title', 160),
    body: cleanText(item.body, 'Update body', 2400),
    category: oneOf(item.category, UPDATE_CATEGORIES, 'Update category', 'GENERAL'),
    visibilityType: oneOf(item.visibilityType, UPDATE_VISIBILITY_TYPES, 'Update visibility', 'PUBLIC'),
    publishedAt: optionalDate(item.publishedAt) ?? new Date(0).toISOString(),
    visible: item.visible !== false
  }));
  const videos = arrayOfRecords(value.videos, 'Videos', 50).map((item) => ({
    url: safePublicUrl(item.url),
    title: cleanText(item.title, 'Video title', 160),
    description: cleanText(item.description ?? '', 'Video description', 800, false)
  }));
  const controlCategories: ImportControlCategory[] = arrayOfRecords(value.controlCategories, 'Control categories', 100).map((category) => ({
    name: normalizeCategoryName(category.name),
    visibility: oneOf(category.visibility, CONTROL_CATEGORY_VISIBILITIES, 'Category visibility', 'PUBLIC'),
    statusVisibilityOverride: category.statusVisibilityOverride ? oneOf(category.statusVisibilityOverride, CONTROL_VISIBILITY_MODES, 'Status visibility override') : null,
    controls: arrayOfRecords(category.controls, 'Controls', 200).map((control) => ({
      name: cleanText(control.name, 'Control name', 200),
      description: cleanText(control.description ?? '', 'Control description', 2400, false),
      status: oneOf(control.status, CONTROL_STATUSES, 'Control status', 'UNMAPPED'),
      tags: normalizeTags(control.tags),
      externalId: cleanText(control.externalId ?? '', 'External control id', 120, false) || null
    }))
  }));
  const dataCollected = value.dataCollected === undefined
    ? []
    : normalizeDataCollected(value.dataCollected, () => 'import').map(({ dataCollected: label, status }) => ({ dataCollected: label, status }));

  const bundle: ImportBundle = { source, site };
  if (value.certifications !== undefined) bundle.certifications = certifications;
  if (value.documents !== undefined) bundle.documents = documents;
  if (value.faqs !== undefined) bundle.faqs = faqs;
  if (value.subprocessors !== undefined) bundle.subprocessors = subprocessors;
  if (value.updates !== undefined) bundle.updates = updates;
  if (value.videos !== undefined) bundle.videos = videos;
  if (value.controlCategories !== undefined) bundle.controlCategories = controlCategories;
  if (value.dataCollected !== undefined) bundle.dataCollected = dataCollected;
  return {
    requiresReview: true,
    bundle,
    counts: {
      certifications: certifications.length,
      documents: documents.length,
      faqs: faqs.length,
      subprocessors: subprocessors.length,
      updates: updates.length,
      videos: videos.length,
      controlCategories: controlCategories.length,
      controls: controlCategories.reduce((sum, category) => sum + (category.controls?.length ?? 0), 0),
      dataCollected: dataCollected.length
    }
  };
}
