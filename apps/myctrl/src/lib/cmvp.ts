const DEFAULT_CMVP_API_BASE = 'https://hackidle.github.io/nist-cmvp-api/api';
const CMVP_API_BASE = (import.meta.env.PUBLIC_CMVP_API_BASE_URL ?? DEFAULT_CMVP_API_BASE).replace(/\/+$/, '');
const CMVP_CACHE_TTL_MS = 10 * 60 * 1000;

export type CMVPDataset = 'active' | 'historical' | 'in_process';
export type CMVPScope = CMVPDataset | 'all';
export type CryptoUsageType = 'at-rest' | 'in-transit' | 'key-management' | 'signing' | 'other';

export interface NormalizedCmvpModule {
  id: string;
  dataset: CMVPDataset;
  certificateNumber: string | null;
  vendorName: string;
  moduleName: string;
  standard: string | null;
  status: string;
  moduleType: string | null;
  overallLevel: number | null;
  validationDate: string | null;
  sunsetDate: string | null;
  algorithms: string[];
  securityPolicyUrl: string | null;
  certificateDetailUrl: string | null;
  caveat: string | null;
  description: string | null;
  embodiment: string | null;
}

export interface CmvpFileLink {
  label: string;
  url: string;
}

export interface CmvpValidationHistoryEntry {
  date: string;
  type: string;
  lab: string;
}

export interface CmvpVendorInfo {
  name: string;
  websiteUrl: string | null;
  addressLines: string[];
  country: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface CmvpCertificateDetail {
  certificateNumber: string;
  dataset: Exclude<CMVPDataset, 'in_process'>;
  generatedAt: string | null;
  nistPageUrl: string | null;
  certificateDetailUrl: string | null;
  securityPolicyUrl: string | null;
  vendorName: string;
  moduleName: string;
  standard: string | null;
  status: string;
  moduleType: string | null;
  embodiment: string | null;
  overallLevel: number | null;
  validationDate: string | null;
  validationDates: string[];
  sunsetDate: string | null;
  caveat: string | null;
  description: string | null;
  securityLevelExceptions: string[];
  relatedFiles: CmvpFileLink[];
  validationHistory: CmvpValidationHistoryEntry[];
  vendor: CmvpVendorInfo;
  algorithms: string[];
}

export interface AssessmentCryptoModule extends NormalizedCmvpModule {
  moduleId: string;
  assessmentId: string;
  componentName?: string;
  usageTypes?: CryptoUsageType[];
  notes?: string;
  detailSnapshot?: CmvpCertificateDetail;
  snapshottedAt?: number;
  sourceGeneratedAt?: string | null;
  stale?: boolean;
  addedAt: number;
  updatedAt: number;
}

export interface CmvpMetadataSummary {
  name: string;
  lastUpdated: string | null;
  totalModules: number;
  totalHistoricalModules: number;
  totalModulesInProcess: number;
  totalCertificatesWithAlgorithms: number;
  features: {
    securityPolicyUrls: boolean;
    certificateDetailUrls: boolean;
    algorithmExtraction: boolean;
    certificateDetailRecords?: boolean;
  };
}

export interface CmvpFilterMetadata {
  standards: string[];
  moduleTypes: string[];
  statuses: string[];
  algorithms: string[];
}

export interface CmvpSearchFilters {
  q?: string;
  scope?: CMVPScope;
  limit?: number;
  standard?: string;
  moduleType?: string;
  status?: string;
  algorithm?: string;
}

export interface CmvpSearchResult {
  filters: Required<CmvpSearchFilters>;
  total: number;
  results: NormalizedCmvpModule[];
}

interface CachedValue<T> {
  fetchedAt: number;
  value: T;
}

interface UpstreamIndex {
  name?: string;
  last_updated?: string;
  total_modules?: number;
  total_historical_modules?: number;
  total_modules_in_process?: number;
  features?: {
    security_policy_urls?: boolean;
    certificate_detail_urls?: boolean;
    algorithm_extraction?: boolean;
    certificate_detail_records?: boolean;
  };
}

interface UpstreamMetadata {
  total_certificates_with_algorithms?: number;
}

interface UpstreamAlgorithmsResponse {
  algorithms?: Record<string, { certificates?: Array<number | string> }>;
}

interface UpstreamCertificateDetailVendor {
  name?: unknown;
  website_url?: unknown;
  address_lines?: unknown;
  country?: unknown;
  contact_name?: unknown;
  contact_email?: unknown;
  contact_phone?: unknown;
}

interface UpstreamCertificateDetailRecord {
  certificate_number?: unknown;
  dataset?: unknown;
  generated_at?: unknown;
  nist_page_url?: unknown;
  certificate_detail_url?: unknown;
  security_policy_url?: unknown;
  vendor_name?: unknown;
  module_name?: unknown;
  standard?: unknown;
  status?: unknown;
  module_type?: unknown;
  embodiment?: unknown;
  overall_level?: unknown;
  validation_date?: unknown;
  validation_dates?: unknown;
  sunset_date?: unknown;
  caveat?: unknown;
  description?: unknown;
  security_level_exceptions?: unknown;
  related_files?: unknown;
  validation_history?: unknown;
  vendor?: UpstreamCertificateDetailVendor;
  algorithms?: unknown;
}

interface UpstreamCertificateDetailResponse {
  metadata?: {
    generated_at?: unknown;
    dataset?: unknown;
    source?: unknown;
  };
  certificate?: UpstreamCertificateDetailRecord;
}

type UpstreamRecord = Record<string, unknown>;

const modulesCache = new Map<CMVPDataset, CachedValue<NormalizedCmvpModule[]>>();
const detailCache = new Map<string, CachedValue<CmvpCertificateDetail | null>>();
let metadataCache: CachedValue<CmvpMetadataSummary> | null = null;
let filtersCache: CachedValue<CmvpFilterMetadata> | null = null;
let algorithmMapCache: CachedValue<Map<string, string[]>> | null = null;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMaybeText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  const normalized = normalizeMaybeText(value);
  return normalized ? [normalized] : [];
}

function cleanVendorName(value: unknown): string {
  const vendor = normalizeText(value).replace(/View Contacts\s*$/i, '').trim();
  return vendor;
}

function slugifyCmvpPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function createInProcessId(record: UpstreamRecord): string {
  const parts = [
    normalizeText(record['Vendor Name']),
    normalizeText(record['Module Name']),
    normalizeText(record['Status']),
  ].filter(Boolean);
  return `in-process:${slugifyCmvpPart(parts.join('-'))}`;
}

function normalizeDateField(value: unknown): string | null {
  const raw = normalizeMaybeText(value);
  if (!raw) return null;

  const slashDateMatches = raw.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? [];
  if (slashDateMatches.length > 1) {
    return Array.from(new Set(slashDateMatches)).join(', ');
  }

  return raw;
}

function normalizeDataset(value: unknown): CMVPDataset | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'active' || normalized === 'historical' || normalized === 'in_process') {
    return normalized;
  }
  return null;
}

function normalizeVendorInfo(
  rawVendor: UpstreamCertificateDetailVendor | undefined,
  fallbackName: string,
): CmvpVendorInfo {
  const addressLines = normalizeStringArray(rawVendor?.address_lines);
  return {
    name: normalizeMaybeText(rawVendor?.name) ?? fallbackName,
    websiteUrl: normalizeMaybeText(rawVendor?.website_url),
    addressLines,
    country: normalizeMaybeText(rawVendor?.country) ?? addressLines.at(-1) ?? null,
    contactName: normalizeMaybeText(rawVendor?.contact_name),
    contactEmail: normalizeMaybeText(rawVendor?.contact_email),
    contactPhone: normalizeMaybeText(rawVendor?.contact_phone),
  };
}

function normalizeFileLinks(value: unknown): CmvpFileLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const label = normalizeMaybeText((entry as Record<string, unknown>).label);
      const url = normalizeMaybeText((entry as Record<string, unknown>).url);
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((entry): entry is CmvpFileLink => !!entry);
}

function normalizeValidationHistory(value: unknown): CmvpValidationHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const date = normalizeMaybeText(record.date) ?? '';
      const type = normalizeMaybeText(record.type) ?? '';
      const lab = normalizeMaybeText(record.lab) ?? '';
      if (!date && !type && !lab) return null;
      return { date, type, lab };
    })
    .filter((entry): entry is CmvpValidationHistoryEntry => !!entry);
}

export function normalizeCmvpCertificateDetail(
  response: UpstreamCertificateDetailResponse,
): CmvpCertificateDetail | null {
  const raw = response.certificate;
  if (!raw) return null;

  const certificateNumber = normalizeMaybeText(raw.certificate_number);
  if (!certificateNumber) return null;

  const validationHistory = normalizeValidationHistory(raw.validation_history);
  const validationDatesFromHistory = validationHistory
    .map((entry) => entry.date)
    .filter(Boolean);
  const validationDates = Array.from(new Set([
    ...normalizeStringArray(raw.validation_dates).flatMap((entry) => entry.split(/\s*,\s*/).filter(Boolean)),
    ...validationDatesFromHistory,
  ]));

  const vendorName = normalizeMaybeText(raw.vendor_name)
    ?? normalizeMaybeText(raw.vendor?.name)
    ?? '';
  const dataset = normalizeDataset(raw.dataset ?? response.metadata?.dataset);
  const overallLevelValue = typeof raw.overall_level === 'number'
    ? raw.overall_level
    : typeof raw.overall_level === 'string' && raw.overall_level
      ? Number(raw.overall_level)
      : null;

  return {
    certificateNumber,
    dataset: dataset === 'historical' ? 'historical' : 'active',
    generatedAt: normalizeDateField(raw.generated_at) ?? normalizeDateField(response.metadata?.generated_at),
    nistPageUrl: normalizeMaybeText(raw.nist_page_url) ?? normalizeMaybeText(response.metadata?.source),
    certificateDetailUrl: normalizeMaybeText(raw.certificate_detail_url),
    securityPolicyUrl: normalizeMaybeText(raw.security_policy_url),
    vendorName,
    moduleName: normalizeMaybeText(raw.module_name) ?? '',
    standard: normalizeMaybeText(raw.standard),
    status: normalizeMaybeText(raw.status) ?? 'Unknown',
    moduleType: normalizeMaybeText(raw.module_type),
    embodiment: normalizeMaybeText(raw.embodiment),
    overallLevel: typeof overallLevelValue === 'number' && Number.isFinite(overallLevelValue) ? overallLevelValue : null,
    validationDate: normalizeDateField(raw.validation_date) ?? (validationDates.length > 0 ? validationDates.join(', ') : null),
    validationDates,
    sunsetDate: normalizeDateField(raw.sunset_date),
    caveat: normalizeMaybeText(raw.caveat),
    description: normalizeMaybeText(raw.description),
    securityLevelExceptions: normalizeStringArray(raw.security_level_exceptions),
    relatedFiles: normalizeFileLinks(raw.related_files),
    validationHistory,
    vendor: normalizeVendorInfo(raw.vendor, vendorName),
    algorithms: normalizeStringArray(raw.algorithms),
  };
}

export function detailToNormalizedCmvpModule(detail: CmvpCertificateDetail): NormalizedCmvpModule {
  return {
    id: detail.certificateNumber,
    dataset: detail.dataset,
    certificateNumber: detail.certificateNumber,
    vendorName: detail.vendorName,
    moduleName: detail.moduleName,
    standard: detail.standard,
    status: detail.status,
    moduleType: detail.moduleType,
    overallLevel: detail.overallLevel,
    validationDate: detail.validationDate,
    sunsetDate: detail.sunsetDate,
    algorithms: detail.algorithms,
    securityPolicyUrl: detail.securityPolicyUrl,
    certificateDetailUrl: detail.certificateDetailUrl ?? detail.nistPageUrl,
    caveat: detail.caveat,
    description: detail.description,
    embodiment: detail.embodiment,
  };
}

export function buildCertificateAlgorithmMap(response: UpstreamAlgorithmsResponse): Map<string, string[]> {
  const certificateAlgorithms = new Map<string, Set<string>>();
  const algorithms = response.algorithms ?? {};

  for (const [algorithm, details] of Object.entries(algorithms)) {
    for (const certificate of details.certificates ?? []) {
      const certificateKey = String(certificate);
      if (!certificateAlgorithms.has(certificateKey)) {
        certificateAlgorithms.set(certificateKey, new Set());
      }
      certificateAlgorithms.get(certificateKey)?.add(algorithm);
    }
  }

  return new Map(
    Array.from(certificateAlgorithms.entries()).map(([certificate, values]) => [
      certificate,
      Array.from(values).sort((a, b) => a.localeCompare(b)),
    ]),
  );
}

export function normalizeCmvpRecord(
  dataset: CMVPDataset,
  record: UpstreamRecord,
  certificateAlgorithms: Map<string, string[]>,
): NormalizedCmvpModule {
  const certificateNumber = normalizeMaybeText(record['Certificate Number']);
  const vendorName = cleanVendorName(record['Vendor Name']);
  const moduleName = normalizeText(record['Module Name']) || normalizeText(record['module_name']);
  const standard = normalizeMaybeText(record['standard']) ?? normalizeMaybeText(record['Standard']);
  const status = normalizeText(record['status']) || normalizeText(record['Status']) || (dataset === 'active' ? 'Active' : dataset === 'historical' ? 'Historical' : 'In Process');
  const moduleType = normalizeMaybeText(record['module_type']) ?? normalizeMaybeText(record['Module Type']);
  const overallLevelValue = record['overall_level'];
  const overallLevel = typeof overallLevelValue === 'number'
    ? overallLevelValue
    : typeof overallLevelValue === 'string' && overallLevelValue
      ? Number(overallLevelValue)
      : null;
  const id = certificateNumber ?? createInProcessId(record);

  return {
    id,
    dataset,
    certificateNumber,
    vendorName,
    moduleName,
    standard,
    status,
    moduleType,
    overallLevel: Number.isFinite(overallLevel) ? overallLevel : null,
    validationDate: normalizeDateField(record['Validation Date']),
    sunsetDate: normalizeDateField(record['sunset_date']) ?? normalizeDateField(record['Sunset Date']),
    algorithms: certificateNumber ? (certificateAlgorithms.get(certificateNumber) ?? []) : [],
    securityPolicyUrl: normalizeMaybeText(record['security_policy_url']),
    certificateDetailUrl: normalizeMaybeText(record['certificate_detail_url']) ?? normalizeMaybeText(record['Certificate Number_url']),
    caveat: normalizeMaybeText(record['caveat']) ?? normalizeMaybeText(record['Caveat']),
    description: normalizeMaybeText(record['description']) ?? normalizeMaybeText(record['Description']),
    embodiment: normalizeMaybeText(record['embodiment']) ?? normalizeMaybeText(record['Embodiment']),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`CMVP request failed for ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchJsonIfExists<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`CMVP request failed for ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function isCacheFresh(cached: CachedValue<unknown> | null | undefined): boolean {
  return !!cached && Date.now() - cached.fetchedAt < CMVP_CACHE_TTL_MS;
}

async function getCertificateAlgorithmMap(): Promise<Map<string, string[]>> {
  if (isCacheFresh(algorithmMapCache)) {
    return algorithmMapCache!.value;
  }

  const payload = await fetchJson<UpstreamAlgorithmsResponse>(`${CMVP_API_BASE}/algorithms.json`);
  const map = buildCertificateAlgorithmMap(payload);
  algorithmMapCache = {
    fetchedAt: Date.now(),
    value: map,
  };
  return map;
}

async function getDatasetPayload(dataset: CMVPDataset): Promise<UpstreamRecord[]> {
  if (dataset === 'active') {
    const payload = await fetchJson<{ modules?: UpstreamRecord[] }>(`${CMVP_API_BASE}/modules.json`);
    return payload.modules ?? [];
  }

  if (dataset === 'historical') {
    const payload = await fetchJson<{ modules?: UpstreamRecord[] }>(`${CMVP_API_BASE}/historical-modules.json`);
    return payload.modules ?? [];
  }

  const payload = await fetchJson<{ modules_in_process?: UpstreamRecord[] }>(`${CMVP_API_BASE}/modules-in-process.json`);
  return payload.modules_in_process ?? [];
}

export async function getCmvpModules(dataset: CMVPDataset): Promise<NormalizedCmvpModule[]> {
  const cached = modulesCache.get(dataset);
  if (isCacheFresh(cached)) {
    return cached!.value;
  }

  const [records, certificateAlgorithms] = await Promise.all([
    getDatasetPayload(dataset),
    getCertificateAlgorithmMap(),
  ]);

  const normalized = records
    .map((record) => normalizeCmvpRecord(dataset, record, certificateAlgorithms))
    .filter((record) => record.moduleName && record.vendorName);

  modulesCache.set(dataset, {
    fetchedAt: Date.now(),
    value: normalized,
  });

  return normalized;
}

export async function getCmvpModulesForScope(scope: CMVPScope = 'active'): Promise<NormalizedCmvpModule[]> {
  if (scope === 'all') {
    const [active, historical, inProcess] = await Promise.all([
      getCmvpModules('active'),
      getCmvpModules('historical'),
      getCmvpModules('in_process'),
    ]);
    return [...active, ...historical, ...inProcess];
  }

  return getCmvpModules(scope);
}

export async function getCmvpMetadata(): Promise<CmvpMetadataSummary> {
  if (isCacheFresh(metadataCache)) {
    return metadataCache!.value;
  }

  const [index, metadata] = await Promise.all([
    fetchJson<UpstreamIndex>(`${CMVP_API_BASE}/index.json`),
    fetchJson<UpstreamMetadata>(`${CMVP_API_BASE}/metadata.json`),
  ]);

  const summary: CmvpMetadataSummary = {
    name: index.name ?? 'NIST CMVP Data API',
    lastUpdated: index.last_updated ?? null,
    totalModules: index.total_modules ?? 0,
    totalHistoricalModules: index.total_historical_modules ?? 0,
    totalModulesInProcess: index.total_modules_in_process ?? 0,
    totalCertificatesWithAlgorithms: metadata.total_certificates_with_algorithms ?? 0,
    features: {
      securityPolicyUrls: !!index.features?.security_policy_urls,
      certificateDetailUrls: !!index.features?.certificate_detail_urls,
      algorithmExtraction: !!index.features?.algorithm_extraction,
      certificateDetailRecords: !!index.features?.certificate_detail_records,
    },
  };

  metadataCache = {
    fetchedAt: Date.now(),
    value: summary,
  };

  return summary;
}

export async function getCmvpFilterMetadata(): Promise<CmvpFilterMetadata> {
  if (isCacheFresh(filtersCache)) {
    return filtersCache!.value;
  }

  const modules = await getCmvpModulesForScope('all');
  const metadata: CmvpFilterMetadata = {
    standards: Array.from(new Set(modules.map((module) => module.standard).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b)),
    moduleTypes: Array.from(new Set(modules.map((module) => module.moduleType).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b)),
    statuses: Array.from(new Set(modules.map((module) => module.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    algorithms: Array.from(new Set(modules.flatMap((module) => module.algorithms))).sort((a, b) => a.localeCompare(b)),
  };

  filtersCache = {
    fetchedAt: Date.now(),
    value: metadata,
  };

  return metadata;
}

export function filterCmvpModules(
  modules: NormalizedCmvpModule[],
  filters: Required<CmvpSearchFilters>,
): NormalizedCmvpModule[] {
  const query = filters.q.trim().toLowerCase();
  const standard = filters.standard.trim().toLowerCase();
  const moduleType = filters.moduleType.trim().toLowerCase();
  const status = filters.status.trim().toLowerCase();
  const algorithm = filters.algorithm.trim().toLowerCase();

  let filtered = modules;

  if (standard) {
    filtered = filtered.filter((module) => (module.standard ?? '').toLowerCase() === standard);
  }

  if (moduleType) {
    filtered = filtered.filter((module) => (module.moduleType ?? '').toLowerCase() === moduleType);
  }

  if (status) {
    filtered = filtered.filter((module) => module.status.toLowerCase() === status);
  }

  if (algorithm) {
    filtered = filtered.filter((module) => module.algorithms.some((entry) => entry.toLowerCase() === algorithm));
  }

  if (!query) {
    return filtered;
  }

  return filtered
    .map((module) => {
      let score = 0;
      const certificate = module.certificateNumber ?? '';
      const moduleName = module.moduleName.toLowerCase();
      const vendorName = module.vendorName.toLowerCase();
      const description = (module.description ?? '').toLowerCase();

      if (certificate && certificate === query) score += 120;
      else if (certificate.startsWith(query)) score += 90;
      else if (certificate.includes(query)) score += 60;

      if (moduleName === query) score += 110;
      else if (moduleName.startsWith(query)) score += 85;
      else if (moduleName.includes(query)) score += 70;

      if (vendorName === query) score += 80;
      else if (vendorName.startsWith(query)) score += 65;
      else if (vendorName.includes(query)) score += 50;

      if ((module.standard ?? '').toLowerCase().includes(query)) score += 35;
      if (module.algorithms.some((entry) => entry.toLowerCase().includes(query))) score += 40;
      if (description.includes(query)) score += 20;

      return { module, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.module.dataset !== b.module.dataset) {
        const datasetOrder: Record<CMVPDataset, number> = { active: 0, historical: 1, in_process: 2 };
        return datasetOrder[a.module.dataset] - datasetOrder[b.module.dataset];
      }
      return a.module.moduleName.localeCompare(b.module.moduleName);
    })
    .map((entry) => entry.module);
}

export async function searchCmvpModules(filters: CmvpSearchFilters = {}): Promise<CmvpSearchResult> {
  const normalizedFilters: Required<CmvpSearchFilters> = {
    q: filters.q ?? '',
    scope: filters.scope ?? 'active',
    limit: Math.min(Math.max(filters.limit ?? 25, 1), 100),
    standard: filters.standard ?? '',
    moduleType: filters.moduleType ?? '',
    status: filters.status ?? '',
    algorithm: filters.algorithm ?? '',
  };

  const modules = await getCmvpModulesForScope(normalizedFilters.scope);
  const filtered = filterCmvpModules(modules, normalizedFilters);

  return {
    filters: normalizedFilters,
    total: filtered.length,
    results: filtered.slice(0, normalizedFilters.limit),
  };
}

export async function getCmvpModuleByCertificate(certificateNumber: string): Promise<NormalizedCmvpModule | null> {
  const trimmed = certificateNumber.trim();
  if (!trimmed) return null;

  const [active, historical] = await Promise.all([
    getCmvpModules('active'),
    getCmvpModules('historical'),
  ]);

  return active.find((module) => module.certificateNumber === trimmed)
    ?? historical.find((module) => module.certificateNumber === trimmed)
    ?? null;
}

export async function getCmvpCertificateDetail(certificateNumber: string): Promise<CmvpCertificateDetail | null> {
  const trimmed = certificateNumber.trim();
  if (!trimmed) return null;

  const cached = detailCache.get(trimmed);
  if (isCacheFresh(cached)) {
    return cached!.value;
  }

  const payload = await fetchJsonIfExists<UpstreamCertificateDetailResponse>(
    `${CMVP_API_BASE}/certificates/${encodeURIComponent(trimmed)}.json`,
  );

  const normalized = payload ? normalizeCmvpCertificateDetail(payload) : null;
  detailCache.set(trimmed, {
    fetchedAt: Date.now(),
    value: normalized,
  });

  return normalized;
}

export function buildAssessmentCryptoSummary(modules: AssessmentCryptoModule[]): string {
  if (modules.length === 0) {
    return 'No CMVP modules have been recorded for this assessment.';
  }

  const statusCounts = new Map<string, number>();
  const standardCounts = new Map<string, number>();
  const algorithms = new Set<string>();
  const staleCount = modules.filter((module) => module.stale).length;

  for (const module of modules) {
    statusCounts.set(module.status, (statusCounts.get(module.status) ?? 0) + 1);
    if (module.standard) {
      standardCounts.set(module.standard, (standardCounts.get(module.standard) ?? 0) + 1);
    }
    for (const algorithm of module.algorithms) {
      algorithms.add(algorithm);
    }
  }

  const statuses = Array.from(statusCounts.entries())
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
  const standards = Array.from(standardCounts.entries())
    .map(([standard, count]) => `${standard}: ${count}`)
    .join(', ');
  const algorithmList = Array.from(algorithms).sort((a, b) => a.localeCompare(b)).join(', ');

  return [
    `${modules.length} CMVP module${modules.length === 1 ? '' : 's'} recorded.`,
    statuses ? `Statuses: ${statuses}.` : null,
    standards ? `Standards: ${standards}.` : null,
    algorithmList ? `Algorithms: ${algorithmList}.` : null,
    staleCount > 0 ? `Snapshots needing refresh: ${staleCount}.` : null,
  ].filter(Boolean).join(' ');
}

export function buildControlCmvpEvidenceSummary(modules: AssessmentCryptoModule[]): string {
  if (modules.length === 0) {
    return '';
  }

  return modules.map((module) => {
    const certificate = module.certificateNumber ? `Certificate ${module.certificateNumber}` : module.id;
    const algorithms = module.algorithms.length > 0 ? `Algorithms: ${module.algorithms.join(', ')}` : 'Algorithms: not listed in upstream summary';
    const usage = module.usageTypes && module.usageTypes.length > 0 ? `Usage: ${module.usageTypes.join(', ')}` : null;
    const component = module.componentName ? `Component: ${module.componentName}` : null;
    const detailSnapshot = module.detailSnapshot;
    const validationHistory = detailSnapshot?.validationHistory?.[0]
      ? `Validation history: ${detailSnapshot.validationHistory.map((entry) => `${entry.date} (${entry.type}${entry.lab ? ` via ${entry.lab}` : ''})`).join('; ')}`
      : null;
    const exceptions = detailSnapshot?.securityLevelExceptions?.length
      ? `Security level exceptions: ${detailSnapshot.securityLevelExceptions.join('; ')}`
      : null;

    return [
      `${certificate} — ${module.vendorName} / ${module.moduleName}`,
      `Standard: ${module.standard ?? 'Unknown'}; Status: ${module.status}; ${algorithms}`,
      component,
      usage,
      validationHistory,
      exceptions,
      module.notes ? `Module notes: ${module.notes}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

export function getFedRampCryptoPriorityControls(): string[] {
  return ['SC-12', 'SC-13', 'SC-28', 'SC-8', 'IA-7'];
}
