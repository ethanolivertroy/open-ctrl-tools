import { answerQuestion, type AiBinding } from './chatbot';
import { demoImportBundle, demoImportCounts } from './demo-content';
import {
  canTransitionLifecycle,
  cleanText,
  ConflictError,
  idList,
  LOCAL_LOGO_PATH,
  mergeSiteUpdate,
  normalizeCategoryName,
  normalizeControl,
  normalizeControlCategoryPatch,
  normalizeControlPatch,
  normalizeDataCollected,
  normalizeEmail,
  normalizeResource,
  normalizeVideos,
  NotFoundError,
  oneOf,
  optionalBoolean,
  optionalDateTime,
  optionalId,
  parseLifecycleStatus,
  privateSnapshot,
  publicSnapshot,
  requireId,
  storedLogoKeyToDelete,
  ValidationError,
  validateSite,
  VIEWER_ACCESS_LEVELS,
  viewerCanAccessDocument,
  viewerIsActive,
  viewerNdaSatisfied,
  type AccessRequestRecord,
  type Category,
  type CategoryKind,
  type ChatbotMessage,
  type ControlCategory,
  type DocumentRecord,
  type LifecycleStatus,
  type ResourceKind,
  type SiteConfig,
  type UpdateRecord,
  type ViewerAccessLevel,
  type ViewerRecord
} from './domain';
import { accessRequestNotificationEmail, drainOutbox, subscriptionConfirmEmail, updatePublishedEmail, viewerAccessEmail, type EmailSender, type OutgoingEmail } from './email';
import { API_HEADERS, json } from './http';
import type { Repository, UpdateNotification } from './repository';

export interface AdminIdentity {
  actor: string;
}

export interface PublicRateLimiter {
  /** Returns false when the key has exceeded its budget for the current window. */
  allow(key: string): Promise<boolean>;
}

export type TurnstileVerifier = (token: string, remoteIp: string | null) => Promise<boolean>;

export class RateLimitedError extends Error {
  constructor() {
    super('Too many requests from this network. Wait a minute and try again.');
    this.name = 'RateLimitedError';
  }
}

export interface StoredDocument {
  bytes: Uint8Array;
  contentType: string;
}

export interface DocumentStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredDocument | null>;
  delete(key: string): Promise<void>;
}

export interface AppServices {
  repository: Repository;
  documents?: DocumentStore;
  adminToken: string;
  authenticate?: (request: Request) => Promise<AdminIdentity | null>;
  emailSender?: EmailSender;
  ai?: AiBinding;
  waitUntil?: (promise: Promise<unknown>) => void;
  baseUrl?: string;
  /** Per-client budget for the public subscribe and access-request forms. */
  rateLimiter?: PublicRateLimiter;
  /** When set, public forms must carry a valid Turnstile token. */
  verifyTurnstile?: TurnstileVerifier;
  turnstileSiteKey?: string;
  /** Overrides the site security email as the recipient of access-request alerts. */
  notifyEmail?: string;
  now?: () => Date;
  randomId?: () => string;
  randomToken?: () => string;
}

export interface ServiceContext {
  services: AppServices;
  actor: string;
  origin: string;
}

export const RESOURCE_KINDS = ['certifications', 'documents', 'faqs', 'subprocessors', 'updates'] as const;

export const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};

export const FAVICON_TYPES: Record<string, string> = {
  ...LOGO_TYPES,
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico'
};

export const DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md'
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const CONFIRM_WINDOW_MS = 48 * 60 * 60 * 1000;
export const CONFIRM_RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_UPDATE_RECIPIENTS = 5000;

export function clientIp(request: Request): string | null {
  const direct = request.headers.get('cf-connecting-ip')?.trim();
  if (direct) return direct;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || null;
}

// Both public POST forms share the same two checks: a per-network budget and,
// when the operator configured Turnstile, a fresh challenge token.
export async function guardPublicForm(services: AppServices, request: Request, scope: string, body: Record<string, unknown>): Promise<void> {
  const ip = clientIp(request);
  if (services.rateLimiter) {
    const allowed = await services.rateLimiter.allow(`${scope}:${ip ?? 'unknown'}`);
    if (!allowed) throw new RateLimitedError();
  }
  if (services.verifyTurnstile) {
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';
    if (!token || token.length > 2048) throw new ValidationError('Complete the verification challenge and try again.');
    const verified = await services.verifyTurnstile(token, ip);
    if (!verified) throw new ValidationError('The verification challenge could not be confirmed. Reload the page and try again.');
  }
}

export function now(services: AppServices): Date {
  return (services.now ?? (() => new Date()))();
}

export function nextId(services: AppServices): string {
  return (services.randomId ?? (() => crypto.randomUUID()))();
}

export function nextToken(services: AppServices): string {
  if (services.randomToken) return services.randomToken();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function baseUrl(ctx: ServiceContext): string {
  return (ctx.services.baseUrl ?? ctx.origin).replace(/\/+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function background(services: AppServices, task: Promise<unknown>): Promise<void> {
  if (services.waitUntil) {
    services.waitUntil(task);
    return Promise.resolve();
  }
  return task.then(() => undefined);
}

export async function deliverQueuedEmail(services: AppServices): Promise<void> {
  if (!services.emailSender) return;
  const task = drainOutbox(services.repository, services.emailSender).catch((error: unknown) => {
    console.error(JSON.stringify({ context: 'email_drain', error: error instanceof Error ? error.name : 'UnknownError' }));
  });
  await background(services, task);
}

export function bytesFromBase64(value: string): Uint8Array {
  const cleaned = value.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!cleaned) throw new ValidationError('File bytes are required');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function looksLikeImage(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/webp') {
    const text = new TextDecoder().decode(bytes.slice(0, 12));
    return text.startsWith('RIFF') && text.includes('WEBP');
  }
  if (contentType === 'image/svg+xml') {
    const text = new TextDecoder().decode(bytes.slice(0, 4000)).trim().toLowerCase();
    return (text.startsWith('<svg') || text.startsWith('<?xml')) && !text.includes('<script');
  }
  if (contentType === 'image/x-icon' || contentType === 'image/vnd.microsoft.icon') {
    return bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && (bytes[2] === 0x01 || bytes[2] === 0x02) && bytes[3] === 0x00;
  }
  return false;
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'document';
}

export function asToolError(error: unknown): { error: string } {
  if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) return { error: error.message };
  if (error instanceof Error && error.message) return { error: error.message };
  return { error: 'The request could not be completed.' };
}

export function requireKind(value: string): ResourceKind {
  if ((RESOURCE_KINDS as readonly string[]).includes(value)) return value as ResourceKind;
  throw new ValidationError('kind must be certifications, documents, faqs, subprocessors, or updates');
}

export function requireRecordId(value: string): string {
  return cleanText(value, 'id', 80);
}

export async function deleteStoredObject(services: AppServices, objectKey: string | null, actor: string, orphanAction = 'storage.orphaned'): Promise<void> {
  if (!objectKey || !services.documents) return;
  try {
    await services.documents.delete(objectKey);
  } catch {
    await services.repository.log(orphanAction, { objectKey }, actor);
  }
}

// --- Snapshots -------------------------------------------------------------

export async function getPublicSnapshot(ctx: ServiceContext) {
  const state = await ctx.services.repository.getPublicState();
  const protection = { turnstileSiteKey: ctx.services.turnstileSiteKey ?? null };
  if (!state.site.isPublic) return { ...privateSnapshot(state), protection };
  return { ...publicSnapshot(state), protection };
}

export const ADMIN_SECTIONS = [
  'site', 'certifications', 'documents', 'faqs', 'subprocessors', 'updates', 'videos', 'resourceCategories', 'faqCategories',
  'controlCategories', 'controls', 'dataCollected', 'subscribers', 'accessRequests', 'viewers',
  'chatbotConversations', 'emailOutbox', 'auditLog', 'totals'
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export async function getAdminState(ctx: ServiceContext, sections?: string[]) {
  const state = { ...(await ctx.services.repository.getAdminState()), actor: ctx.actor };
  if (!sections?.length) return state;
  const allowed = new Set<string>(ADMIN_SECTIONS);
  const picked: Record<string, unknown> = { actor: state.actor };
  for (const section of sections) {
    if (!allowed.has(section)) throw new ValidationError(`Unknown section: ${section}`);
    picked[section] = state[section as keyof typeof state];
  }
  return picked;
}

// --- Site profile and branding assets --------------------------------------

export async function updateSite(ctx: ServiceContext, patch: Record<string, unknown>) {
  const current = await ctx.services.repository.getSiteConfig();
  const site = validateSite(mergeSiteUpdate(current, patch), now(ctx.services).toISOString());
  await ctx.services.repository.updateSite(site, ctx.actor);
  await deleteStoredObject(ctx.services, storedLogoKeyToDelete(current, site), ctx.actor, 'branding.storage_orphaned');
  return { ok: true, site };
}

export type BrandingAsset = 'logo' | 'favicon' | 'banner';

const ASSET_LIMITS: Record<BrandingAsset, { max: number; types: Record<string, string>; label: string }> = {
  logo: { max: 1024 * 1024, types: LOGO_TYPES, label: 'logo' },
  favicon: { max: 256 * 1024, types: FAVICON_TYPES, label: 'favicon' },
  banner: { max: 4 * 1024 * 1024, types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }, label: 'banner image' }
};

function assetKey(asset: BrandingAsset): keyof SiteConfig {
  return asset === 'logo' ? 'logoObjectKey' : asset === 'favicon' ? 'faviconObjectKey' : 'bannerObjectKey';
}

export async function uploadBrandingAsset(ctx: ServiceContext, asset: BrandingAsset, bytes: Uint8Array, contentType: string) {
  const services = ctx.services;
  if (!services.documents) throw new ValidationError('Document storage is not configured.');
  const limit = ASSET_LIMITS[asset];
  const extension = limit.types[contentType];
  if (!extension) throw new ValidationError(`Upload a ${Object.values(limit.types).map((value) => value.toUpperCase()).join(', ')} ${limit.label}`);
  if (bytes.length < 1 || bytes.length > limit.max) throw new ValidationError(`The ${limit.label} must be between 1 byte and ${Math.round(limit.max / 1024)} KB`);
  if (!looksLikeImage(bytes, contentType)) throw new ValidationError(`The uploaded file is not a valid ${limit.label}`);
  const current = await services.repository.getSiteConfig();
  const previousKey = current[assetKey(asset)] as string | null;
  const objectKey = `branding/${asset}-${nextId(services)}.${extension}`;
  await services.documents.put(objectKey, bytes, contentType);
  const patch: Record<string, unknown> = { ...current, [assetKey(asset)]: objectKey };
  if (asset === 'logo') patch.logoUrl = LOCAL_LOGO_PATH;
  if (asset === 'banner') patch.bannerSetting = 'CUSTOM_IMAGE';
  const site = validateSite(patch, now(services).toISOString());
  try {
    await services.repository.updateSite(site, ctx.actor);
  } catch (error) {
    await deleteStoredObject(services, objectKey, ctx.actor, 'branding.storage_orphaned');
    throw error;
  }
  if (previousKey !== objectKey) await deleteStoredObject(services, previousKey, ctx.actor, 'branding.storage_orphaned');
  return { ok: true, site };
}

export async function removeBrandingAsset(ctx: ServiceContext, asset: BrandingAsset) {
  const services = ctx.services;
  if (!services.documents) throw new ValidationError('Document storage is not configured.');
  const current = await services.repository.getSiteConfig();
  const patch: Record<string, unknown> = { ...current, [assetKey(asset)]: null };
  if (asset === 'logo') patch.logoUrl = '';
  if (asset === 'banner' && current.bannerSetting === 'CUSTOM_IMAGE') patch.bannerSetting = 'MINIMAL';
  const site = validateSite(patch, now(services).toISOString());
  await services.repository.updateSite(site, ctx.actor);
  await deleteStoredObject(services, current[assetKey(asset)] as string | null, ctx.actor, 'branding.storage_orphaned');
  return { ok: true, site };
}

export async function uploadFrameworkBadge(ctx: ServiceContext, id: string, bytes: Uint8Array, contentType: string) {
  const services = ctx.services;
  if (!services.documents) throw new ValidationError('Document storage is not configured.');
  const extension = LOGO_TYPES[contentType];
  if (!extension) throw new ValidationError('Upload a PNG, JPEG, WebP, or SVG badge');
  if (bytes.length < 1 || bytes.length > 512 * 1024) throw new ValidationError('Badges must be between 1 byte and 512 KB');
  if (!looksLikeImage(bytes, contentType)) throw new ValidationError('The uploaded file is not a valid badge image');
  const current = await services.repository.getResource('certifications', id);
  if (!current) throw new NotFoundError('Compliance framework not found');
  const previousKey = (current.badgeObjectKey as string | null) ?? null;
  const objectKey = `badges/${id}-${nextId(services)}.${extension}`;
  await services.documents.put(objectKey, bytes, contentType);
  try {
    await services.repository.setCertificationBadge(id, objectKey, ctx.actor);
  } catch (error) {
    await deleteStoredObject(services, objectKey, ctx.actor, 'badges.storage_orphaned');
    throw error;
  }
  if (previousKey !== objectKey) await deleteStoredObject(services, previousKey, ctx.actor, 'badges.storage_orphaned');
  return { isSuccessful: true, badgeUrl: `/api/certifications/${encodeURIComponent(id)}/badge` };
}

export async function removeFrameworkBadge(ctx: ServiceContext, id: string) {
  const current = await ctx.services.repository.getResource('certifications', id);
  if (!current) throw new NotFoundError('Compliance framework not found');
  await ctx.services.repository.setCertificationBadge(id, null, ctx.actor);
  await deleteStoredObject(ctx.services, (current.badgeObjectKey as string | null) ?? null, ctx.actor, 'badges.storage_orphaned');
  return { ok: true, id };
}

// --- Lifecycle resources ---------------------------------------------------

export async function listRecords(ctx: ServiceContext, kind: ResourceKind) {
  return ctx.services.repository.listResources(kind);
}

export async function getRecord(ctx: ServiceContext, kind: ResourceKind, id: string) {
  const record = await ctx.services.repository.getResource(kind, id);
  if (!record) throw new NotFoundError('Resource not found.');
  return record;
}

export async function createRecord(ctx: ServiceContext, kind: ResourceKind, fields: Record<string, unknown>) {
  const id = nextId(ctx.services);
  const value = normalizeResource(kind, fields, id, now(ctx.services).toISOString());
  const resource = await ctx.services.repository.createResource(kind, value, ctx.actor);
  return { ok: true, resource };
}

export async function updateRecord(ctx: ServiceContext, kind: ResourceKind, id: string, fields: Record<string, unknown>) {
  const current = await ctx.services.repository.getResource(kind, id);
  if (!current) throw new NotFoundError('Resource not found.');
  const merged = { ...current, ...fields };
  if (kind === 'documents' && current.sourceType === 'r2') {
    merged.sourceType = 'r2';
    merged.objectKey = current.objectKey;
  }
  const value = normalizeResource(kind, merged, id, now(ctx.services).toISOString());
  const resource = await ctx.services.repository.updateResource(kind, id, value, ctx.actor);
  return { ok: true, resource };
}

export async function deleteRecord(ctx: ServiceContext, kind: ResourceKind, id: string) {
  let objectKey: string | null = null;
  let badgeKey: string | null = null;
  if (kind === 'documents' && ctx.services.documents) {
    const document = await ctx.services.repository.getDocument(id);
    if (document?.sourceType === 'r2') objectKey = document.objectKey;
  }
  if (kind === 'certifications' && ctx.services.documents) {
    const framework = await ctx.services.repository.getResource('certifications', id);
    badgeKey = (framework?.badgeObjectKey as string | null) ?? null;
  }
  await ctx.services.repository.deleteResource(kind, id, ctx.actor);
  await deleteStoredObject(ctx.services, objectKey, ctx.actor, 'documents.storage_orphaned');
  await deleteStoredObject(ctx.services, badgeKey, ctx.actor, 'badges.storage_orphaned');
  return { ok: true, id, deleted: true };
}

async function buildUpdateNotification(ctx: ServiceContext, update: UpdateRecord, recipients: Array<{ id: string; email: string; unsubscribeToken: string | null }>): Promise<UpdateNotification> {
  const site = await ctx.services.repository.getSiteConfig();
  const origin = baseUrl(ctx);
  const unsubscribeTokens: Array<{ id: string; token: string }> = [];
  const seen = new Set<string>();
  const emails: OutgoingEmail[] = [];
  for (const recipient of recipients) {
    if (seen.has(recipient.email)) continue;
    seen.add(recipient.email);
    let unsubscribeToken = recipient.unsubscribeToken;
    if (!unsubscribeToken) {
      unsubscribeToken = nextToken(ctx.services);
      unsubscribeTokens.push({ id: recipient.id, token: unsubscribeToken });
    }
    emails.push(updatePublishedEmail({
      to: recipient.email,
      companyName: site.companyName,
      title: update.title,
      body: update.body,
      siteUrl: origin,
      unsubscribeUrl: `${origin}/unsubscribe?token=${unsubscribeToken}`
    }));
  }
  if (emails.length > MAX_UPDATE_RECIPIENTS) throw new ValidationError(`Notifications are limited to ${MAX_UPDATE_RECIPIENTS} recipients`);
  return { emails, notifiedAt: now(ctx.services).toISOString(), unsubscribeTokens };
}

export async function setLifecycle(ctx: ServiceContext, kind: ResourceKind, id: string, lifecycle: string) {
  const target = parseLifecycleStatus(lifecycle);
  const current = await ctx.services.repository.getResource(kind, id);
  if (!current) throw new NotFoundError('Resource not found.');
  const from = current.lifecycle as LifecycleStatus;
  if (from === target) return { ok: true, id, lifecycle: target, notified: 0 };
  if (!canTransitionLifecycle(from, target)) throw new ValidationError(`A ${from} record cannot move to ${target}.`);

  let notify: UpdateNotification | undefined;
  if (kind === 'updates' && target === 'published' && !current.notifiedAt) {
    const recipients = await ctx.services.repository.listActiveSubscribers();
    if (recipients.length > 0) notify = await buildUpdateNotification(ctx, current as unknown as UpdateRecord, recipients);
  }
  const queued = await ctx.services.repository.setResourceLifecycle(kind, id, target, ctx.actor, notify);
  if (queued > 0) await deliverQueuedEmail(ctx.services);
  return { ok: true, id, lifecycle: target, notified: queued };
}

// --- Documents -------------------------------------------------------------

export async function uploadDocument(ctx: ServiceContext, input: {
  title: string;
  description?: string;
  category?: string;
  categoryId?: string | null;
  visibility?: 'public' | 'request';
  isPublic?: boolean;
  version?: string;
  reviewAt?: string | null;
  bytes: Uint8Array;
  contentType: string;
  filename?: string;
}) {
  const services = ctx.services;
  if (!services.documents) throw new ValidationError('Document storage is not configured.');
  const extension = DOCUMENT_TYPES[input.contentType];
  if (!extension) throw new ValidationError('Upload a PDF, Markdown, or plain-text document');
  if (input.bytes.length < 1 || input.bytes.length > 10 * 1024 * 1024) throw new ValidationError('Documents must be between 1 byte and 10 MB');
  if (input.contentType === 'application/pdf' && new TextDecoder().decode(input.bytes.slice(0, 5)) !== '%PDF-') {
    throw new ValidationError('The uploaded file is not a valid PDF');
  }
  const id = nextId(services);
  const fileBase = slug((input.filename ?? input.title).replace(/\.[^.]+$/, ''));
  const objectKey = `documents/${id}-${fileBase}.${extension}`;
  await services.documents.put(objectKey, input.bytes, input.contentType);
  try {
    const visibility = input.visibility === 'request' || input.isPublic === false ? 'request' : 'public';
    const value = normalizeResource('documents', {
      title: input.title,
      description: input.description ?? '',
      category: input.category ?? '',
      categoryId: input.categoryId ?? null,
      visibility,
      sourceType: 'r2',
      objectKey,
      fileName: `${fileBase}.${extension}`,
      mimeType: input.contentType,
      version: input.version ?? '1.0',
      publishedAt: now(services).toISOString().slice(0, 10),
      reviewAt: input.reviewAt ?? null
    }, id, now(services).toISOString());
    const document = await services.repository.createResource('documents', value, ctx.actor);
    return { ok: true, document };
  } catch (error) {
    await services.documents.delete(objectKey);
    throw error;
  }
}

export function serveDocumentFile(document: DocumentRecord, documents: DocumentStore | undefined): Promise<Response> | Response {
  if (document.sourceType === 'external') {
    if (!document.url) return json({ error: 'This document has no attached file yet. Contact the security team.' }, 503);
    return new Response(null, { status: 302, headers: { ...API_HEADERS, location: document.url } });
  }
  if (document.objectKey && documents) {
    return (async () => {
      const stored = await documents.get(document.objectKey as string);
      if (!stored) return json({ error: 'Document file not found.' }, 404);
      const extension = stored.contentType === 'application/pdf' ? 'pdf' : stored.contentType === 'text/markdown' ? 'md' : 'txt';
      return new Response(stored.bytes as BodyInit, {
        status: 200,
        headers: {
          'content-type': stored.contentType,
          'content-disposition': `attachment; filename="${document.fileName ?? `${slug(document.title)}.${extension}`}"`,
          'cache-control': 'private, no-store',
          'content-security-policy': "default-src 'none'; sandbox",
          'x-content-type-options': 'nosniff'
        }
      });
    })();
  }
  return json({ error: 'Document storage is unavailable.' }, 503);
}

// --- Videos, categories, controls, data collected --------------------------

export async function setVideos(ctx: ServiceContext, videos: unknown) {
  const normalized = normalizeVideos(videos, () => nextId(ctx.services));
  const results = await ctx.services.repository.setVideos(normalized, ctx.actor);
  return { results: results.map(({ sortOrder: _order, ...video }) => video) };
}

export function categoryKind(value: string): CategoryKind {
  return oneOf(value, ['resource', 'faq', 'control'] as const, 'Category kind');
}

export async function listCategories(ctx: ServiceContext, kind: CategoryKind) {
  return ctx.services.repository.listCategories(kind);
}

export async function createCategory(ctx: ServiceContext, kind: CategoryKind, input: Record<string, unknown>) {
  const base: Category = { id: nextId(ctx.services), name: normalizeCategoryName(input.name), sortOrder: 0 };
  if (kind === 'control') {
    const patch = normalizeControlCategoryPatch(input);
    const category: ControlCategory = { ...base, visibility: patch.visibility ?? 'PUBLIC', statusVisibilityOverride: patch.statusVisibilityOverride ?? null };
    return ctx.services.repository.createCategory(kind, category, ctx.actor);
  }
  return ctx.services.repository.createCategory(kind, base, ctx.actor);
}

export async function updateCategory(ctx: ServiceContext, kind: CategoryKind, id: string, input: Record<string, unknown>) {
  const patch = kind === 'control' ? normalizeControlCategoryPatch(input) : { name: normalizeCategoryName(input.name) };
  if (!Object.keys(patch).length) throw new ValidationError('Nothing to update');
  return ctx.services.repository.updateCategory(kind, id, patch, ctx.actor);
}

export async function deleteCategory(ctx: ServiceContext, kind: CategoryKind, id: string) {
  await ctx.services.repository.deleteCategory(kind, id, ctx.actor);
  return { ok: true, id, deleted: true };
}

export async function reorderCategories(ctx: ServiceContext, kind: CategoryKind, orderedIds: unknown) {
  const ids = idList(orderedIds, 'category IDs', 500);
  return { results: await ctx.services.repository.reorderCategories(kind, ids, ctx.actor) };
}

export async function listControls(ctx: ServiceContext) {
  const [controls, categories] = await Promise.all([ctx.services.repository.listControls(), ctx.services.repository.listCategories('control')]);
  return controls.map((control) => withControlCategories(control, categories as ControlCategory[]));
}

function withControlCategories(control: Awaited<ReturnType<Repository['listControls']>>[number], categories: ControlCategory[]) {
  const { memberships, ...rest } = control;
  return {
    ...rest,
    categories: memberships
      .map((membership) => categories.find((category) => category.id === membership.categoryId))
      .filter((category): category is ControlCategory => Boolean(category))
      .map(({ sortOrder: _order, ...category }) => category)
  };
}

export async function getControl(ctx: ServiceContext, id: string) {
  const control = await ctx.services.repository.getControl(id);
  if (!control) throw new NotFoundError('Control not found.');
  const categories = await ctx.services.repository.listCategories('control');
  return withControlCategories(control, categories as ControlCategory[]);
}

export async function createControl(ctx: ServiceContext, input: Record<string, unknown>) {
  const categoryIds = idList(input.categoryIds, 'categoryIds', 50);
  if (!categoryIds.length) throw new ValidationError('categoryIds must include at least one control category');
  const control = normalizeControl(input, nextId(ctx.services), now(ctx.services).toISOString());
  await ctx.services.repository.createControl(control, categoryIds, ctx.actor);
  return getControl(ctx, control.id);
}

export async function updateControl(ctx: ServiceContext, id: string, input: Record<string, unknown>) {
  const patch = normalizeControlPatch(input);
  if (!Object.keys(patch).length) throw new ValidationError('Nothing to update');
  await ctx.services.repository.updateControl(id, patch, ctx.actor);
  return getControl(ctx, id);
}

export async function deleteControl(ctx: ServiceContext, id: string) {
  await ctx.services.repository.deleteControl(id, ctx.actor);
  return { ok: true, id, deleted: true };
}

export async function editControlsInCategory(ctx: ServiceContext, categoryId: string, input: Record<string, unknown>) {
  const add = idList(input.controlsToAdd, 'controlsToAdd', 200);
  const remove = idList(input.controlsToRemove, 'controlsToRemove', 200);
  return ctx.services.repository.setControlCategoryMembers(categoryId, add, remove, ctx.actor);
}

export async function reorderControlsInCategory(ctx: ServiceContext, categoryId: string, orderedControlIds: unknown) {
  return ctx.services.repository.reorderControlsInCategory(categoryId, idList(orderedControlIds, 'orderedControlIds', 500), ctx.actor);
}

export async function tagControls(ctx: ServiceContext, input: Record<string, unknown>, mode: 'add' | 'remove') {
  const controlIds = idList(input.controlIds, 'controlIds', 100);
  if (!controlIds.length) throw new ValidationError('controlIds must include at least one control');
  const tagCategory = cleanText(input.tagCategory, 'tagCategory', 80);
  const tagsRaw = input.tags;
  if (!Array.isArray(tagsRaw) || !tagsRaw.length || tagsRaw.length > 50) throw new ValidationError('tags must be a list of 1 to 50 values');
  const tags = tagsRaw.map((tag) => cleanText(tag, 'Tag', 80));
  const controls = await ctx.services.repository.tagControls(controlIds, tagCategory, tags, mode, ctx.actor);
  const categories = await ctx.services.repository.listCategories('control');
  return { results: controls.map((control) => withControlCategories(control, categories as ControlCategory[])) };
}

export async function listDataCollected(ctx: ServiceContext) {
  const [items, site] = await Promise.all([ctx.services.repository.listDataCollected(), ctx.services.repository.getSiteConfig()]);
  return { heading: site.dataCollectedHeading, results: items.map(({ dataCollected, status }) => ({ dataCollected, status })) };
}

export async function setDataCollected(ctx: ServiceContext, input: Record<string, unknown>) {
  const items = normalizeDataCollected(input.dataCollected, () => nextId(ctx.services));
  const heading = Object.prototype.hasOwnProperty.call(input, 'dataCollectedHeading')
    ? (input.dataCollectedHeading === null ? '' : cleanText(input.dataCollectedHeading, 'Data collected heading', 160, false))
    : undefined;
  await ctx.services.repository.setDataCollected(items, heading, ctx.actor);
  return listDataCollected(ctx);
}

// --- Subscribers -----------------------------------------------------------

function subscriberView(subscriber: Awaited<ReturnType<Repository['listSubscribers']>>[number]) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    status: subscriber.status,
    isEmailVerified: subscriber.status === 'active',
    creationDate: subscriber.createdAt,
    confirmedAt: subscriber.confirmedAt
  };
}

export async function listSubscribers(ctx: ServiceContext) {
  return (await ctx.services.repository.listSubscribers()).map(subscriberView);
}

export async function getSubscriber(ctx: ServiceContext, id: string) {
  const subscriber = await ctx.services.repository.getSubscriber(id);
  if (!subscriber) throw new NotFoundError('Subscriber not found.');
  return subscriberView(subscriber);
}

export async function createSubscriber(ctx: ServiceContext, input: Record<string, unknown>) {
  const email = normalizeEmail(input.email);
  const verified = optionalBoolean(input.shouldSkipEmailVerification, 'shouldSkipEmailVerification', false);
  const timestamp = now(ctx.services);
  const unsubscribeToken = nextToken(ctx.services);
  let confirmEmail: OutgoingEmail | null = null;
  let confirmTokenHash: string | null = null;
  let confirmExpiresAt: string | null = null;
  if (!verified) {
    const confirmToken = nextToken(ctx.services);
    confirmTokenHash = await sha256Hex(confirmToken);
    confirmExpiresAt = new Date(timestamp.getTime() + CONFIRM_WINDOW_MS).toISOString();
    const site = await ctx.services.repository.getSiteConfig();
    const origin = baseUrl(ctx);
    confirmEmail = subscriptionConfirmEmail({
      to: email,
      companyName: site.companyName,
      confirmUrl: `${origin}/confirm?token=${confirmToken}`,
      unsubscribeUrl: `${origin}/unsubscribe?token=${unsubscribeToken}`
    });
  }
  const subscriber = await ctx.services.repository.createSubscriber({
    id: nextId(ctx.services),
    email,
    verified,
    confirmTokenHash,
    confirmExpiresAt,
    unsubscribeToken,
    createdAt: timestamp.toISOString()
  }, confirmEmail, ctx.actor);
  if (confirmEmail) await deliverQueuedEmail(ctx.services);
  return subscriberView(subscriber);
}

export async function deleteSubscriber(ctx: ServiceContext, id: string) {
  await ctx.services.repository.deleteSubscriber(id, ctx.actor);
  return { ok: true, id, deleted: true };
}

function csvCell(value: string | null): string {
  const text = value ?? '';
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportSubscribersCsv(ctx: ServiceContext): Promise<{ filename: string; body: string; count: number }> {
  const rows = await ctx.services.repository.listSubscribers();
  const lines = ['email,status,subscribed_at,confirmed_at'];
  for (const row of rows) {
    lines.push([row.email, row.status, row.createdAt, row.confirmedAt].map(csvCell).join(','));
  }
  await ctx.services.repository.log('subscribers.exported', { count: rows.length }, ctx.actor);
  return {
    filename: `subscribers-${now(ctx.services).toISOString().slice(0, 10)}.csv`,
    body: `${lines.join('\r\n')}\r\n`,
    count: rows.length
  };
}

export async function retryEmail(ctx: ServiceContext, id: string) {
  await ctx.services.repository.retryEmail(id, ctx.actor);
  await deliverQueuedEmail(ctx.services);
  return { ok: true, id, status: 'pending' };
}

// --- Access requests and viewers -------------------------------------------

export function accessRequestView(request: AccessRequestRecord) {
  return {
    id: request.id,
    email: request.email,
    name: request.name,
    companyName: request.company,
    reason: request.reason,
    requestedResources: request.requestedResources,
    accessLevel: request.accessLevel,
    status: request.status,
    creationDate: request.createdAt,
    updatedDate: request.updatedAt,
    ...(request.status === 'pending' ? {} : {
      outcome: request.status === 'approved' ? 'APPROVED' : 'DENIED',
      manualDenialReason: request.denialReason
    })
  };
}

export async function listAccessRequests(ctx: ServiceContext) {
  return (await ctx.services.repository.listAccessRequests()).map(accessRequestView);
}

export async function getAccessRequest(ctx: ServiceContext, id: string) {
  const request = await ctx.services.repository.getAccessRequest(id);
  if (!request) throw new NotFoundError('Access request not found.');
  return accessRequestView(request);
}

export async function submitAccessRequest(ctx: ServiceContext, body: Record<string, unknown>) {
  const site = await ctx.services.repository.getSiteConfig();
  const documentIds = body.documentIds !== undefined
    ? idList(body.documentIds, 'documentIds', 50)
    : body.documentId ? [requireId(body.documentId, 'documentId')] : [];
  let accessLevel: ViewerAccessLevel = documentIds.length ? 'PARTIAL_ACCESS' : 'FULL_ACCESS';
  if (body.accessLevel !== undefined) accessLevel = oneOf(body.accessLevel, VIEWER_ACCESS_LEVELS, 'accessLevel');
  if (accessLevel === 'PARTIAL_ACCESS' && !documentIds.length) throw new ValidationError('Choose at least one document to request');
  const documentTitles: string[] = [];
  for (const documentId of documentIds) {
    const document = await ctx.services.repository.getDocument(documentId);
    if (!document || document.lifecycle !== 'published' || document.visibility !== 'request') {
      throw new NotFoundError('That document is not available by request.');
    }
    documentTitles.push(document.title);
  }
  if (accessLevel === 'FULL_ACCESS' && site.isPublic && !documentIds.length) {
    const gated = (await ctx.services.repository.getPublicState()).documents.some((document) => document.visibility === 'request');
    if (!gated) throw new NotFoundError('There are no request-only resources on this trust center.');
  }
  const timestamp = now(ctx.services).toISOString();
  const record: AccessRequestRecord = {
    id: nextId(ctx.services),
    name: cleanText(body.name, 'Name', 120),
    email: normalizeEmail(body.email),
    company: cleanText(body.company ?? body.companyName, 'Company', 160),
    reason: cleanText(body.reason ?? '', 'Reason', 800, false),
    requestedResources: accessLevel === 'FULL_ACCESS' ? null : documentIds,
    accessLevel,
    status: 'pending',
    denialReason: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  // The alert is queued in the same transaction as the request, so an admin
  // hears about every new request exactly once. A repeat while the first is
  // still pending is absorbed by the repository: no new row, no new alert.
  const outcome = await ctx.services.repository.createAccessRequest(record, accessRequestNotificationEmail({
    to: ctx.services.notifyEmail ?? site.securityEmail,
    companyName: site.companyName,
    documentTitles,
    requesterName: record.name,
    requesterEmail: record.email,
    requesterCompany: record.company,
    reason: record.reason,
    adminUrl: `${baseUrl(ctx)}/admin/#requests`
  }));
  if (outcome.created) await deliverQueuedEmail(ctx.services);
  return { ok: true, id: outcome.id, created: outcome.created, message: 'If the request is eligible, the security team will review it.' };
}

function viewerView(viewer: ViewerRecord) {
  return {
    id: viewer.id,
    email: viewer.email,
    name: viewer.name || null,
    companyName: viewer.companyName || null,
    resourceIds: viewer.accessLevel === 'FULL_ACCESS' ? null : viewer.resourceIds ?? [],
    accessLevel: viewer.accessLevel,
    ndaInfo: viewer.ndaRequired
      ? { provider: 'ONE_CLICK', satisfiedDate: viewer.ndaAcceptedAt, oneClick: viewer.ndaAcceptedAt ? { name: viewer.name, date: viewer.ndaAcceptedAt, ndaUploadedDocumentId: null } : null, docuSign: null }
      : null,
    creationDate: viewer.createdAt,
    updatedDate: viewer.updatedAt,
    expirationDate: viewer.expiresAt,
    addedByUser: viewer.addedBy,
    accessRequestId: viewer.accessRequestId,
    inviteSentAt: viewer.inviteSentAt,
    removedAt: viewer.removedAt,
    hasActiveLink: Boolean(viewer.tokenHash) && !viewer.removedAt
  };
}

export type ViewerView = ReturnType<typeof viewerView>;

async function validateResourceIds(ctx: ServiceContext, ids: string[]): Promise<void> {
  for (const id of ids) {
    const document = await ctx.services.repository.getDocument(id);
    if (!document) throw new NotFoundError(`Document not found: ${id}`);
  }
}

async function issueViewer(ctx: ServiceContext, input: {
  existing: ViewerRecord | null;
  email: string;
  name: string;
  companyName: string;
  accessLevel: ViewerAccessLevel;
  resourceIds: string[] | null;
  ndaRequired: boolean;
  expiresAt: string | null;
  accessRequestId: string | null;
}): Promise<{ viewer: ViewerRecord; accessUrl: string; email: OutgoingEmail }> {
  const timestamp = now(ctx.services).toISOString();
  const token = nextToken(ctx.services);
  const site = await ctx.services.repository.getSiteConfig();
  const accessUrl = `${baseUrl(ctx)}/access?token=${token}`;
  const viewer: ViewerRecord = {
    id: input.existing?.id ?? nextId(ctx.services),
    email: input.email,
    name: input.name,
    companyName: input.companyName,
    accessLevel: input.accessLevel,
    resourceIds: input.accessLevel === 'FULL_ACCESS' ? null : input.resourceIds ?? [],
    ndaRequired: input.ndaRequired,
    ndaAcceptedAt: input.ndaRequired ? input.existing?.ndaAcceptedAt ?? null : null,
    expiresAt: input.expiresAt,
    tokenHash: await sha256Hex(token),
    addedBy: ctx.actor,
    accessRequestId: input.accessRequestId ?? input.existing?.accessRequestId ?? null,
    inviteSentAt: timestamp,
    createdAt: input.existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    removedAt: null
  };
  const email = viewerAccessEmail({
    to: viewer.email,
    companyName: site.companyName,
    viewerName: viewer.name,
    accessUrl,
    expiresAt: viewer.expiresAt,
    ndaRequired: viewer.ndaRequired
  });
  return { viewer, accessUrl, email };
}

export async function approveAccessRequest(ctx: ServiceContext, id: string, body: Record<string, unknown>) {
  const request = await ctx.services.repository.getAccessRequest(id);
  if (!request) throw new NotFoundError('Access request not found.');
  if (request.status !== 'pending') throw new ConflictError('This access request has already been decided');
  const accessLevel = body.accessLevel === undefined ? request.accessLevel : oneOf(body.accessLevel, VIEWER_ACCESS_LEVELS, 'accessLevel');
  const resourceIds = body.resourceIds !== undefined ? idList(body.resourceIds, 'resourceIds', 200) : request.requestedResources ?? [];
  const expiresAt = optionalDateTime(body.expirationDate, 'expirationDate');
  if (expiresAt && expiresAt <= now(ctx.services).toISOString()) throw new ValidationError('expirationDate must be in the future');
  await validateResourceIds(ctx, resourceIds);
  if (accessLevel === 'PARTIAL_ACCESS') {
    for (const resourceId of resourceIds) {
      const document = await ctx.services.repository.getDocument(resourceId);
      if (document && document.lifecycle !== 'published') {
        throw new ConflictError(`"${document.title}" is no longer published. Publish it again before approving access, or deny the request.`);
      }
    }
  }
  const existing = await ctx.services.repository.getViewerByEmail(request.email);
  const issued = await issueViewer(ctx, {
    existing,
    email: request.email,
    name: request.name,
    companyName: request.company,
    accessLevel,
    resourceIds: accessLevel === 'FULL_ACCESS' ? null : [...new Set([...(existing && !existing.removedAt ? existing.resourceIds ?? [] : []), ...resourceIds])],
    ndaRequired: optionalBoolean(body.isNdaRequired, 'isNdaRequired', existing?.ndaRequired ?? false),
    expiresAt,
    accessRequestId: request.id
  });
  const viewer = await ctx.services.repository.approveAccessRequest(id, issued.viewer, issued.email, ctx.actor, issued.viewer.updatedAt);
  await deliverQueuedEmail(ctx.services);
  return { ok: true, id, status: 'approved' as const, viewer: { ...viewerView(viewer), accessUrl: issued.accessUrl } };
}

export async function denyAccessRequest(ctx: ServiceContext, id: string, body: Record<string, unknown>) {
  const reason = cleanText(body.reason ?? '', 'Reason', 800, false) || null;
  await ctx.services.repository.denyAccessRequest(id, reason, ctx.actor, now(ctx.services).toISOString());
  return { ok: true, id, status: 'denied' as const, reason };
}

export async function listViewers(ctx: ServiceContext, includeRemoved: boolean) {
  return (await ctx.services.repository.listViewers(includeRemoved)).map(viewerView);
}

export async function getViewer(ctx: ServiceContext, id: string) {
  const viewer = await ctx.services.repository.getViewer(id);
  if (!viewer) throw new NotFoundError('Viewer not found.');
  return viewerView(viewer);
}

export async function addViewer(ctx: ServiceContext, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const existing = await ctx.services.repository.getViewerByEmail(email);
  if (existing && !existing.removedAt) throw new ConflictError('A viewer with that email already has access. Update the viewer instead.');
  const accessLevel = oneOf(body.accessLevel, VIEWER_ACCESS_LEVELS, 'accessLevel');
  const resourceIds = body.resourceIds !== undefined ? idList(body.resourceIds, 'resourceIds', 200) : null;
  if (accessLevel === 'PARTIAL_ACCESS' && !resourceIds?.length) throw new ValidationError('Partial access requires at least one resource ID');
  const expiresAt = optionalDateTime(body.expirationDate, 'expirationDate');
  if (expiresAt && expiresAt <= now(ctx.services).toISOString()) throw new ValidationError('expirationDate must be in the future');
  await validateResourceIds(ctx, resourceIds ?? []);
  const issued = await issueViewer(ctx, {
    existing,
    email,
    name: cleanText(body.name, 'Name', 120),
    companyName: cleanText(body.companyName ?? body.company, 'Company name', 160),
    accessLevel,
    resourceIds,
    ndaRequired: optionalBoolean(body.isNdaRequired, 'isNdaRequired', false),
    expiresAt,
    accessRequestId: null
  });
  const viewer = await ctx.services.repository.saveViewer(issued.viewer, issued.email, ctx.actor, 'viewer.added');
  await deliverQueuedEmail(ctx.services);
  return { ...viewerView(viewer), accessUrl: issued.accessUrl };
}

export async function updateViewer(ctx: ServiceContext, id: string, body: Record<string, unknown>) {
  const current = await ctx.services.repository.getViewer(id);
  if (!current || current.removedAt) throw new NotFoundError('Viewer not found.');
  const next: ViewerRecord = { ...current, updatedAt: now(ctx.services).toISOString() };
  if (body.accessLevel !== undefined) next.accessLevel = oneOf(body.accessLevel, VIEWER_ACCESS_LEVELS, 'accessLevel');
  if (body.resourceIds !== undefined) {
    next.resourceIds = idList(body.resourceIds, 'resourceIds', 200);
    await validateResourceIds(ctx, next.resourceIds);
  }
  if (next.accessLevel === 'FULL_ACCESS') next.resourceIds = null;
  else if (!next.resourceIds?.length) throw new ValidationError('Partial access requires at least one resource ID');
  if (Object.prototype.hasOwnProperty.call(body, 'expirationDate')) {
    next.expiresAt = optionalDateTime(body.expirationDate, 'expirationDate');
    if (next.expiresAt && next.expiresAt <= next.updatedAt) throw new ValidationError('expirationDate must be in the future');
  }
  if (body.isNdaRequired !== undefined) {
    next.ndaRequired = optionalBoolean(body.isNdaRequired, 'isNdaRequired', current.ndaRequired);
    if (!next.ndaRequired) next.ndaAcceptedAt = null;
  }
  if (body.name !== undefined) next.name = cleanText(body.name, 'Name', 120, false);
  if (body.companyName !== undefined) next.companyName = cleanText(body.companyName, 'Company name', 160, false);
  const viewer = await ctx.services.repository.saveViewer(next, null, ctx.actor, 'viewer.updated');
  return viewerView(viewer);
}

export async function removeViewer(ctx: ServiceContext, id: string) {
  await ctx.services.repository.removeViewer(id, ctx.actor, now(ctx.services).toISOString());
  return { ok: true, id, removed: true };
}

// --- Viewer-facing access --------------------------------------------------

export async function resolveViewer(ctx: ServiceContext, token: string): Promise<ViewerRecord | null> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return null;
  const viewer = await ctx.services.repository.getViewerByTokenHash(await sha256Hex(token));
  if (!viewer || !viewerIsActive(viewer, now(ctx.services).toISOString())) return null;
  return viewer;
}

export async function viewerSnapshot(ctx: ServiceContext, viewer: ViewerRecord) {
  const state = await ctx.services.repository.getPublicState();
  const snapshot = publicSnapshot(state, {
    viewer: { accessLevel: viewer.accessLevel, resourceIds: viewer.resourceIds, ndaSatisfied: viewerNdaSatisfied(viewer) }
  });
  return {
    ...snapshot,
    viewer: {
      email: viewer.email,
      name: viewer.name,
      companyName: viewer.companyName,
      accessLevel: viewer.accessLevel,
      expiresAt: viewer.expiresAt,
      ndaRequired: viewer.ndaRequired,
      ndaAcceptedAt: viewer.ndaAcceptedAt
    }
  };
}

export async function acceptViewerNda(ctx: ServiceContext, viewer: ViewerRecord) {
  if (!viewer.ndaRequired) return { ok: true, ndaAcceptedAt: null };
  const at = now(ctx.services).toISOString();
  await ctx.services.repository.acceptViewerNda(viewer.id, at);
  return { ok: true, ndaAcceptedAt: viewer.ndaAcceptedAt ?? at };
}

export async function viewerDocument(ctx: ServiceContext, viewer: ViewerRecord, documentId: string): Promise<Response> {
  const document = await ctx.services.repository.getDocument(documentId);
  if (!document || document.lifecycle !== 'published') return json({ error: 'Document not found.' }, 404);
  if (!viewerCanAccessDocument(viewer, document)) {
    if (document.visibility === 'request' && !viewerNdaSatisfied(viewer)) return json({ error: 'Accept the confidentiality agreement before downloading.', ndaRequired: true }, 403);
    return json({ error: 'This document is not included in your access.' }, 403);
  }
  return serveDocumentFile(document, ctx.services.documents);
}

// --- Chatbot ---------------------------------------------------------------

export async function chat(ctx: ServiceContext, body: Record<string, unknown>) {
  const question = cleanText(body.message, 'message', 1000);
  const conversationId = optionalId(body.conversationId, 'conversationId');
  const viewer = typeof body.viewerToken === 'string' ? await resolveViewer(ctx, body.viewerToken) : null;
  const state = await ctx.services.repository.getPublicState();
  if (!state.site.isPublic && !viewer) throw new NotFoundError('This trust center is private.');
  const snapshot = publicSnapshot(state, viewer
    ? { viewer: { accessLevel: viewer.accessLevel, resourceIds: viewer.resourceIds, ndaSatisfied: viewerNdaSatisfied(viewer) } }
    : {});
  const timestamp = now(ctx.services).toISOString();
  let conversation = conversationId ? await ctx.services.repository.getChatbotConversation(conversationId) : null;
  if (conversationId && !conversation) throw new NotFoundError('Conversation not found.');
  if (conversation && conversation.conversation.numMessages >= 60) throw new ValidationError('This conversation is full. Start a new one.');
  const history = conversation?.messages.map((message) => ({ role: message.role, message: message.message })) ?? [];
  const answer = await answerQuestion({ question, history, snapshot, ai: ctx.services.ai });
  const id = conversation?.conversation.id ?? nextId(ctx.services);
  const messages: ChatbotMessage[] = [
    { id: nextId(ctx.services), conversationId: id, role: 'USER', message: question, references: [], createdAt: timestamp },
    { id: nextId(ctx.services), conversationId: id, role: 'ASSISTANT', message: answer.reply, references: answer.references, createdAt: timestamp }
  ];
  const record = {
    id,
    firstMessage: conversation?.conversation.firstMessage ?? question.slice(0, 300),
    numMessages: (conversation?.conversation.numMessages ?? 0) + messages.length,
    userEmail: conversation?.conversation.userEmail ?? viewer?.email ?? null,
    isPublicConversation: conversation?.conversation.isPublicConversation ?? !viewer,
    createdAt: conversation?.conversation.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  await ctx.services.repository.appendChatbotMessages(record, messages);
  return { conversationId: id, reply: answer.reply, references: answer.references, mode: answer.mode };
}

export async function listChatbotConversations(ctx: ServiceContext, search: string | null) {
  return ctx.services.repository.listChatbotConversations(search ? cleanText(search, 'searchString', 200) : null);
}

export async function getChatbotConversation(ctx: ServiceContext, id: string) {
  const conversation = await ctx.services.repository.getChatbotConversation(id);
  if (!conversation) throw new NotFoundError('Conversation not found.');
  return { conversation: conversation.conversation, results: conversation.messages };
}

// --- Demo reset ------------------------------------------------------------

export async function resetDemoContent(ctx: ServiceContext, confirm: boolean) {
  if (confirm !== true) throw new ValidationError('Set confirm=true to replace published demonstration content.');
  await ctx.services.repository.applyImport(demoImportBundle(), ctx.actor);
  return {
    ok: true,
    reset: 'demo',
    counts: demoImportCounts(),
    note: 'Published demonstration records were restored. Uploaded R2 documents are kept. Review every claim before treating this as a real company site.'
  };
}

export { DAY_MS };
