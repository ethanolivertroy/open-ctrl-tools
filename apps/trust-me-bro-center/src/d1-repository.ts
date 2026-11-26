import {
  ConflictError,
  normalizeResource,
  NotFoundError,
  validateSite,
  type AccessRequestRecord,
  type AdminState,
  type AdminTotals,
  type Category,
  type CategoryKind,
  type ChatbotConversation,
  type ChatbotMessage,
  type ControlCategory,
  type ControlCategoryVisibility,
  type ControlRecord,
  type ControlStatus,
  type ControlVisibilityMode,
  type DataCollectedItem,
  type DataCollectedStatus,
  type DocumentRecord,
  type ImportBundle,
  type LifecycleStatus,
  type ResourceKind,
  type SiteConfig,
  type SubscriberRecord,
  type TrustCenterState,
  type UpdateCategory,
  type UpdateRecord,
  type UpdateVisibilityType,
  type Video,
  type ViewerAccessLevel,
  type ViewerRecord
} from './domain';
import { EMAIL_CLAIM_LEASE_MS, MAX_EMAIL_ATTEMPTS, type OutgoingEmail, type StoredOutboxEmail } from './email';
import type { AccessRequestCreation, ActiveSubscriber, AdminSubscriberInput, Repository, SubscriptionRequest, UpdateNotification } from './repository';

type Row = Record<string, unknown>;
type SqlValue = string | number | null | ArrayBuffer;

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function nullableText(row: Row, key: string): string | null {
  return typeof row[key] === 'string' ? row[key] as string : null;
}

function numberValue(row: Row, key: string): number {
  return typeof row[key] === 'number' ? row[key] as number : 0;
}

function boolValue(row: Row, key: string): boolean {
  return row[key] === 1 || row[key] === true;
}

function jsonValue<T>(row: Row, key: string, fallback: T): T {
  const raw = row[key];
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stringList(row: Row, key: string): string[] {
  const value = jsonValue<unknown>(row, key, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function nullableStringList(row: Row, key: string): string[] | null {
  if (row[key] === null || row[key] === undefined) return null;
  return stringList(row, key);
}

function lifecycleValue(row: Row): LifecycleStatus {
  const value = row.lifecycle;
  return value === 'review' || value === 'published' || value === 'archived' ? value : 'draft';
}

function siteFromRow(row: Row): SiteConfig {
  return {
    companyName: text(row, 'company_name'),
    title: text(row, 'title'),
    headline: text(row, 'headline'),
    summary: text(row, 'summary'),
    securityEmail: text(row, 'security_email'),
    location: text(row, 'location'),
    accent: text(row, 'accent'),
    secondaryColor: text(row, 'secondary_color'),
    logoUrl: text(row, 'logo_url'),
    logoObjectKey: nullableText(row, 'logo_object_key'),
    faviconObjectKey: nullableText(row, 'favicon_object_key'),
    privacyPolicyUrl: text(row, 'privacy_policy_url'),
    isPublic: row.is_public === undefined ? true : boolValue(row, 'is_public'),
    bannerSetting: (text(row, 'banner_setting') || 'MINIMAL') as SiteConfig['bannerSetting'],
    bannerStartColor: text(row, 'banner_start_color'),
    bannerEndColor: text(row, 'banner_end_color'),
    bannerObjectKey: nullableText(row, 'banner_object_key'),
    controlVisibilityMode: (text(row, 'control_visibility_mode') || 'SHOW_ALL_WITH_STATUS') as ControlVisibilityMode,
    dataCollectedHeading: text(row, 'data_collected_heading'),
    createdAt: text(row, 'created_at') || text(row, 'updated_at'),
    updatedAt: text(row, 'updated_at')
  };
}

function certificationFromRow(row: Row) {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    status: text(row, 'status'),
    description: text(row, 'description'),
    standard: (nullableText(row, 'standard') || null) as never,
    badgeObjectKey: nullableText(row, 'badge_object_key'),
    lifecycle: lifecycleValue(row),
    sortOrder: numberValue(row, 'sort_order')
  };
}

function documentFromRow(row: Row): DocumentRecord {
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    description: text(row, 'description'),
    category: text(row, 'category'),
    categoryId: nullableText(row, 'category_id'),
    visibility: text(row, 'visibility') === 'request' ? 'request' : 'public',
    sourceType: text(row, 'source_type') === 'r2' ? 'r2' : 'external',
    url: nullableText(row, 'url'),
    objectKey: nullableText(row, 'object_key'),
    fileName: nullableText(row, 'file_name'),
    mimeType: nullableText(row, 'mime_type'),
    version: text(row, 'version'),
    publishedAt: nullableText(row, 'published_at'),
    reviewAt: nullableText(row, 'review_at'),
    lifecycle: lifecycleValue(row)
  };
}

function faqFromRow(row: Row) {
  return {
    id: text(row, 'id'),
    question: text(row, 'question'),
    answer: text(row, 'answer'),
    categoryId: nullableText(row, 'category_id'),
    lifecycle: lifecycleValue(row),
    sortOrder: numberValue(row, 'sort_order')
  };
}

function subprocessorFromRow(row: Row) {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    description: text(row, 'description'),
    purpose: text(row, 'purpose'),
    location: text(row, 'location'),
    url: text(row, 'url'),
    lifecycle: lifecycleValue(row),
    sortOrder: numberValue(row, 'sort_order')
  };
}

function updateFromRow(row: Row): UpdateRecord {
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    body: text(row, 'body'),
    category: (text(row, 'category') || 'GENERAL') as UpdateCategory,
    visibilityType: (text(row, 'visibility_type') || 'PUBLIC') as UpdateVisibilityType,
    publishedAt: text(row, 'published_at'),
    lifecycle: lifecycleValue(row),
    notifiedAt: nullableText(row, 'notified_at')
  };
}

function videoFromRow(row: Row): Video {
  return {
    id: text(row, 'id'),
    url: text(row, 'url'),
    title: text(row, 'title'),
    description: text(row, 'description'),
    sortOrder: numberValue(row, 'sort_order')
  };
}

function categoryFromRow(row: Row): Category {
  return { id: text(row, 'id'), name: text(row, 'name'), sortOrder: numberValue(row, 'sort_order') };
}

function controlCategoryFromRow(row: Row): ControlCategory {
  return {
    ...categoryFromRow(row),
    visibility: (text(row, 'visibility') || 'PUBLIC') as ControlCategoryVisibility,
    statusVisibilityOverride: (nullableText(row, 'status_visibility_override') || null) as ControlVisibilityMode | null
  };
}

function controlFromRow(row: Row, memberships: Array<{ categoryId: string; sortOrder: number }>): ControlRecord {
  return {
    id: text(row, 'id'),
    externalId: nullableText(row, 'external_id'),
    name: text(row, 'name'),
    description: text(row, 'description'),
    status: (text(row, 'status') || 'UNMAPPED') as ControlStatus,
    tags: jsonValue<Record<string, string[]>>(row, 'tags_json', {}),
    memberships,
    createdAt: text(row, 'created_at')
  };
}

function dataCollectedFromRow(row: Row): DataCollectedItem {
  return {
    id: text(row, 'id'),
    dataCollected: text(row, 'label'),
    status: text(row, 'status') as DataCollectedStatus,
    sortOrder: numberValue(row, 'sort_order')
  };
}

function subscriberFromRow(row: Row): SubscriberRecord {
  const status = text(row, 'status');
  return {
    id: text(row, 'id'),
    email: text(row, 'email'),
    status: status === 'active' || status === 'unsubscribed' ? status : 'pending',
    createdAt: text(row, 'created_at'),
    confirmedAt: nullableText(row, 'confirmed_at')
  };
}

function accessRequestFromRow(row: Row): AccessRequestRecord {
  const status = text(row, 'status');
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    email: text(row, 'email'),
    company: text(row, 'company'),
    reason: text(row, 'reason'),
    requestedResources: nullableStringList(row, 'requested_resources_json'),
    accessLevel: (text(row, 'access_level') || 'PARTIAL_ACCESS') as ViewerAccessLevel,
    status: status === 'approved' || status === 'denied' ? status : 'pending',
    denialReason: nullableText(row, 'denial_reason'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at') || text(row, 'created_at')
  };
}

function viewerFromRow(row: Row): ViewerRecord {
  return {
    id: text(row, 'id'),
    email: text(row, 'email'),
    name: text(row, 'name'),
    companyName: text(row, 'company_name'),
    accessLevel: (text(row, 'access_level') || 'PARTIAL_ACCESS') as ViewerAccessLevel,
    resourceIds: nullableStringList(row, 'resource_ids_json'),
    ndaRequired: boolValue(row, 'nda_required'),
    ndaAcceptedAt: nullableText(row, 'nda_accepted_at'),
    expiresAt: nullableText(row, 'expires_at'),
    tokenHash: nullableText(row, 'token_hash'),
    addedBy: text(row, 'added_by'),
    accessRequestId: nullableText(row, 'access_request_id'),
    inviteSentAt: nullableText(row, 'invite_sent_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
    removedAt: nullableText(row, 'removed_at')
  };
}

function conversationFromRow(row: Row): ChatbotConversation {
  return {
    id: text(row, 'id'),
    firstMessage: text(row, 'first_message'),
    numMessages: numberValue(row, 'num_messages'),
    userEmail: nullableText(row, 'user_email'),
    isPublicConversation: boolValue(row, 'is_public'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at')
  };
}

function chatMessageFromRow(row: Row): ChatbotMessage {
  return {
    id: text(row, 'id'),
    conversationId: text(row, 'conversation_id'),
    role: text(row, 'role') === 'ASSISTANT' ? 'ASSISTANT' : 'USER',
    message: text(row, 'message'),
    references: stringList(row, 'references_json'),
    createdAt: text(row, 'created_at')
  };
}

function d1Value(value: unknown): SqlValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' || typeof value === 'number' || value === null || value instanceof ArrayBuffer) return value;
  if (value === undefined) return null;
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  throw new Error('Unsupported database value');
}

function values(record: Record<string, unknown>, ...keys: string[]): SqlValue[] {
  return keys.map((key) => d1Value(record[key]));
}

const TABLES: Record<ResourceKind, string> = {
  certifications: 'certifications',
  documents: 'documents',
  faqs: 'faqs',
  subprocessors: 'subprocessors',
  updates: 'updates'
};

const CATEGORY_TABLES: Record<CategoryKind, string> = {
  resource: 'resource_categories',
  faq: 'faq_categories',
  control: 'control_categories'
};

function changed(result: D1Result | undefined): boolean {
  return Boolean(result && (result.meta.changes ?? 0) > 0);
}

export class D1Repository implements Repository {
  constructor(private readonly db: D1Database) {}

  private auditStatement(
    action: string,
    detail: Record<string, unknown> = {},
    actor = 'admin',
    exists?: { table: string; id: string; andWhere?: string }
  ): D1PreparedStatement {
    const bindings = [
      crypto.randomUUID(),
      actor,
      action.slice(0, 120),
      JSON.stringify(detail).slice(0, 8000),
      new Date().toISOString()
    ];
    if (exists) {
      return this.db.prepare(`
        INSERT INTO audit_log (id, actor, action, detail_json, created_at)
        SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ${exists.table} WHERE id = ?${exists.andWhere ? ` AND ${exists.andWhere}` : ''})
      `).bind(...bindings, exists.id);
    }
    return this.db.prepare('INSERT INTO audit_log (id, actor, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(...bindings);
  }

  private async rows<T = Row>(sql: string, ...bindings: SqlValue[]): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...bindings).all<T>();
    return result.results as T[];
  }

  private async loadControls(): Promise<ControlRecord[]> {
    const [controls, members] = await Promise.all([
      this.rows('SELECT * FROM controls ORDER BY name'),
      this.rows('SELECT category_id, control_id, sort_order FROM control_category_members ORDER BY sort_order')
    ]);
    const membershipMap = new Map<string, Array<{ categoryId: string; sortOrder: number }>>();
    for (const member of members) {
      const controlId = text(member, 'control_id');
      const list = membershipMap.get(controlId) ?? [];
      list.push({ categoryId: text(member, 'category_id'), sortOrder: numberValue(member, 'sort_order') });
      membershipMap.set(controlId, list);
    }
    return controls.map((row) => controlFromRow(row, membershipMap.get(text(row, 'id')) ?? []));
  }

  private async loadUpdates(where: string, bindings: SqlValue[] = []): Promise<UpdateRecord[]> {
    const updates = await this.rows(`SELECT * FROM updates${where} ORDER BY published_at DESC`, ...bindings);
    return updates.map(updateFromRow);
  }

  private async readState(publicOnly: boolean): Promise<TrustCenterState> {
    const visibility = publicOnly ? " WHERE lifecycle = 'published'" : '';
    const documentColumns = publicOnly
      ? 'id, title, description, category, category_id, visibility, source_type, url, NULL AS object_key, file_name, mime_type, version, published_at, review_at, lifecycle'
      : '*';
    const [site, certifications, documents, faqs, subprocessors, updates, videos, resourceCategories, faqCategories, controlCategories, controls, dataCollected] = await Promise.all([
      this.db.prepare('SELECT * FROM site_config WHERE id = 1').first<Row>(),
      this.rows(`SELECT * FROM certifications${visibility} ORDER BY sort_order, name`),
      this.rows(`SELECT ${documentColumns} FROM documents${visibility} ORDER BY category, title`),
      this.rows(`SELECT * FROM faqs${visibility} ORDER BY sort_order, question`),
      this.rows(`SELECT * FROM subprocessors${visibility} ORDER BY sort_order, name`),
      this.loadUpdates(visibility),
      this.rows('SELECT * FROM videos ORDER BY sort_order'),
      this.rows('SELECT * FROM resource_categories ORDER BY sort_order, name'),
      this.rows('SELECT * FROM faq_categories ORDER BY sort_order, name'),
      this.rows('SELECT * FROM control_categories ORDER BY sort_order, name'),
      this.loadControls(),
      this.rows('SELECT * FROM data_collected ORDER BY sort_order')
    ]);
    if (!site) throw new Error('Trust center has not been initialized');
    return {
      site: siteFromRow(site),
      certifications: certifications.map(certificationFromRow),
      documents: documents.map(documentFromRow),
      faqs: faqs.map(faqFromRow),
      subprocessors: subprocessors.map(subprocessorFromRow),
      updates,
      videos: videos.map(videoFromRow),
      resourceCategories: resourceCategories.map(categoryFromRow),
      faqCategories: faqCategories.map(categoryFromRow),
      controlCategories: controlCategories.map(controlCategoryFromRow),
      controls,
      dataCollected: dataCollected.map(dataCollectedFromRow)
    };
  }

  async getPublicState(): Promise<TrustCenterState> {
    return this.readState(true);
  }

  async getAdminState(): Promise<AdminState> {
    const [state, subscribers, accessRequests, viewers, conversations, auditLog, emailOutbox, totalsRow] = await Promise.all([
      this.readState(false),
      this.listSubscribers(),
      // Pending first so a burst of junk cannot push undecided requests off the list.
      this.rows(`
        SELECT * FROM access_requests
        ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 500
      `),
      this.listViewers(true),
      this.listChatbotConversations(null),
      this.rows('SELECT id, actor, action, detail_json, created_at FROM audit_log ORDER BY created_at DESC LIMIT 200'),
      this.rows('SELECT id, to_email, subject, template, status, attempts, last_error, created_at, sent_at FROM email_outbox ORDER BY created_at DESC LIMIT 200'),
      this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM subscribers) AS subscribers,
          (SELECT COUNT(*) FROM subscribers WHERE status = 'active') AS active_subscribers,
          (SELECT COUNT(*) FROM access_requests) AS access_requests,
          (SELECT COUNT(*) FROM access_requests WHERE status = 'pending') AS pending_access_requests
      `).first<Row>()
    ]);
    // Full-table counts, because the lists above are capped.
    const totals: AdminTotals = {
      subscribers: numberValue(totalsRow ?? {}, 'subscribers'),
      activeSubscribers: numberValue(totalsRow ?? {}, 'active_subscribers'),
      accessRequests: numberValue(totalsRow ?? {}, 'access_requests'),
      pendingAccessRequests: numberValue(totalsRow ?? {}, 'pending_access_requests')
    };
    return {
      ...state,
      subscribers,
      accessRequests: accessRequests.map(accessRequestFromRow),
      viewers,
      chatbotConversations: conversations.slice(0, 100),
      emailOutbox,
      totals,
      auditLog: auditLog.map((row) => {
        let detail: unknown = {};
        try { detail = JSON.parse(text(row, 'detail_json')); } catch { detail = {}; }
        return { ...row, detail };
      })
    };
  }

  private siteStatement(site: SiteConfig): D1PreparedStatement {
    return this.db.prepare(`
      UPDATE site_config
      SET company_name = ?, title = ?, headline = ?, summary = ?, security_email = ?, location = ?, accent = ?, secondary_color = ?,
          logo_url = ?, logo_object_key = ?, favicon_object_key = ?, privacy_policy_url = ?, is_public = ?,
          banner_setting = ?, banner_start_color = ?, banner_end_color = ?, banner_object_key = ?, control_visibility_mode = ?,
          data_collected_heading = ?, created_at = ?, updated_at = ?
      WHERE id = 1
    `).bind(
      site.companyName, site.title, site.headline, site.summary, site.securityEmail, site.location, site.accent, site.secondaryColor,
      site.logoUrl, site.logoObjectKey, site.faviconObjectKey, site.privacyPolicyUrl, site.isPublic ? 1 : 0,
      site.bannerSetting, site.bannerStartColor, site.bannerEndColor, site.bannerObjectKey, site.controlVisibilityMode,
      site.dataCollectedHeading, site.createdAt, site.updatedAt
    );
  }

  async updateSite(site: SiteConfig, actor: string): Promise<void> {
    await this.db.batch([
      this.siteStatement(site),
      this.auditStatement('site.updated', { companyName: site.companyName }, actor)
    ]);
  }

  private resourceStatement(kind: ResourceKind, value: Record<string, unknown>, update: boolean): D1PreparedStatement {
    switch (kind) {
      case 'certifications':
        return update
          ? this.db.prepare('UPDATE certifications SET name=?, status=?, description=?, standard=?, sort_order=? WHERE id=?').bind(...values(value, 'name', 'status', 'description', 'standard', 'sortOrder'), d1Value(value.id))
          : this.db.prepare('INSERT INTO certifications (id,name,status,description,standard,badge_object_key,lifecycle,sort_order) VALUES (?,?,?,?,?,?,?,?)').bind(...values(value, 'id', 'name', 'status', 'description', 'standard', 'badgeObjectKey', 'lifecycle', 'sortOrder'));
      case 'documents':
        return update
          ? this.db.prepare('UPDATE documents SET title=?, description=?, category=?, category_id=?, visibility=?, source_type=?, url=?, object_key=?, file_name=?, mime_type=?, version=?, published_at=?, review_at=? WHERE id=?').bind(...values(value, 'title', 'description', 'category', 'categoryId', 'visibility', 'sourceType', 'url', 'objectKey', 'fileName', 'mimeType', 'version', 'publishedAt', 'reviewAt'), d1Value(value.id))
          : this.db.prepare('INSERT INTO documents (id,title,description,category,category_id,visibility,source_type,url,object_key,file_name,mime_type,version,published_at,review_at,lifecycle) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values(value, 'id', 'title', 'description', 'category', 'categoryId', 'visibility', 'sourceType', 'url', 'objectKey', 'fileName', 'mimeType', 'version', 'publishedAt', 'reviewAt', 'lifecycle'));
      case 'faqs':
        return update
          ? this.db.prepare('UPDATE faqs SET question=?, answer=?, category_id=?, sort_order=? WHERE id=?').bind(...values(value, 'question', 'answer', 'categoryId', 'sortOrder'), d1Value(value.id))
          : this.db.prepare('INSERT INTO faqs (id,question,answer,category_id,lifecycle,sort_order) VALUES (?,?,?,?,?,?)').bind(...values(value, 'id', 'question', 'answer', 'categoryId', 'lifecycle', 'sortOrder'));
      case 'subprocessors':
        return update
          ? this.db.prepare('UPDATE subprocessors SET name=?, description=?, purpose=?, location=?, url=?, sort_order=? WHERE id=?').bind(...values(value, 'name', 'description', 'purpose', 'location', 'url', 'sortOrder'), d1Value(value.id))
          : this.db.prepare('INSERT INTO subprocessors (id,name,description,purpose,location,url,lifecycle,sort_order) VALUES (?,?,?,?,?,?,?,?)').bind(...values(value, 'id', 'name', 'description', 'purpose', 'location', 'url', 'lifecycle', 'sortOrder'));
      case 'updates':
        return update
          ? this.db.prepare('UPDATE updates SET title=?, body=?, category=?, visibility_type=?, published_at=? WHERE id=?').bind(...values(value, 'title', 'body', 'category', 'visibilityType', 'publishedAt'), d1Value(value.id))
          : this.db.prepare('INSERT INTO updates (id,title,body,category,visibility_type,published_at,lifecycle) VALUES (?,?,?,?,?,?,?)').bind(...values(value, 'id', 'title', 'body', 'category', 'visibilityType', 'publishedAt', 'lifecycle'));
    }
  }

  private resourceFromRow(kind: ResourceKind, row: Row): Record<string, unknown> {
    switch (kind) {
      case 'certifications': return certificationFromRow(row);
      case 'documents': return documentFromRow(row) as unknown as Record<string, unknown>;
      case 'faqs': return faqFromRow(row);
      case 'subprocessors': return subprocessorFromRow(row);
      case 'updates': return updateFromRow(row) as unknown as Record<string, unknown>;
    }
  }

  private async assertCategoryExists(kind: CategoryKind, id: string | null | undefined): Promise<void> {
    if (!id) return;
    const row = await this.db.prepare(`SELECT id FROM ${CATEGORY_TABLES[kind]} WHERE id = ?`).bind(id).first<Row>();
    if (!row) throw new NotFoundError(`${kind === 'resource' ? 'Resource' : 'FAQ'} category not found`);
  }

  async listResources(kind: ResourceKind): Promise<Record<string, unknown>[]> {
    if (kind === 'updates') return (await this.loadUpdates('')) as unknown as Record<string, unknown>[];
    const order = kind === 'documents' ? 'category, title' : kind === 'faqs' ? 'sort_order, question' : 'sort_order, name';
    const rows = await this.rows(`SELECT * FROM ${TABLES[kind]} ORDER BY ${order}`);
    return rows.map((row) => this.resourceFromRow(kind, row));
  }

  async createResource(kind: ResourceKind, value: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
    if (kind === 'documents') await this.assertCategoryExists('resource', value.categoryId as string | null);
    if (kind === 'faqs') await this.assertCategoryExists('faq', value.categoryId as string | null);
    const record: Record<string, unknown> = { ...value, lifecycle: 'draft' };
    await this.db.batch([
      this.resourceStatement(kind, record, false),
      this.auditStatement(`${kind}.created`, { id: record.id }, actor)
    ]);
    if (kind === 'updates') return { ...record, notifiedAt: null };
    return record;
  }

  async getResource(kind: ResourceKind, id: string): Promise<Record<string, unknown> | null> {
    if (kind === 'updates') {
      const updates = await this.loadUpdates(' WHERE id = ?', [id]);
      return (updates[0] as unknown as Record<string, unknown>) ?? null;
    }
    const row = await this.db.prepare(`SELECT * FROM ${TABLES[kind]} WHERE id = ?`).bind(id).first<Row>();
    return row ? this.resourceFromRow(kind, row) : null;
  }

  private notificationStatements(updateId: string, notify: UpdateNotification, actor: string): D1PreparedStatement[] {
    const statements: D1PreparedStatement[] = [];
    for (const assignment of notify.unsubscribeTokens) {
      statements.push(this.db.prepare('UPDATE subscribers SET unsubscribe_token = ? WHERE id = ? AND unsubscribe_token IS NULL')
        .bind(assignment.token, assignment.id));
    }
    for (const email of notify.emails) statements.push(this.outboxStatement(email, notify.notifiedAt, { onlyIfUpdateUnnotified: updateId }));
    statements.push(this.db.prepare(`
      INSERT INTO audit_log (id, actor, action, detail_json, created_at)
      SELECT ?, ?, 'update.notified', ?, ? WHERE EXISTS (SELECT 1 FROM updates WHERE id = ? AND notified_at IS NULL)
    `).bind(crypto.randomUUID(), actor, JSON.stringify({ id: updateId, recipients: notify.emails.length }).slice(0, 8000), notify.notifiedAt, updateId));
    return statements;
  }

  async setResourceLifecycle(kind: ResourceKind, id: string, lifecycle: LifecycleStatus, actor: string, notify?: UpdateNotification): Promise<number> {
    const statements: D1PreparedStatement[] = [
      this.db.prepare(`UPDATE ${TABLES[kind]} SET lifecycle = ? WHERE id = ?`).bind(lifecycle, id),
      this.auditStatement(`${kind}.lifecycle_changed`, { id, lifecycle }, actor, { table: TABLES[kind], id })
    ];
    let stampIndex = -1;
    if (notify) {
      statements.push(...this.notificationStatements(id, notify, actor));
      stampIndex = statements.length;
      statements.push(this.db.prepare('UPDATE updates SET notified_at = ? WHERE id = ? AND notified_at IS NULL')
        .bind(notify.notifiedAt, id));
    }
    const results = await this.db.batch(statements);
    if (!changed(results[0])) throw new NotFoundError('Resource not found');
    if (!notify || stampIndex < 0) return 0;
    return changed(results[stampIndex]) ? notify.emails.length : 0;
  }

  async updateResource(kind: ResourceKind, id: string, value: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
    if (kind === 'documents') await this.assertCategoryExists('resource', value.categoryId as string | null);
    if (kind === 'faqs') await this.assertCategoryExists('faq', value.categoryId as string | null);
    const [result] = await this.db.batch([
      this.resourceStatement(kind, { ...value, id }, true),
      this.auditStatement(`${kind}.updated`, { id }, actor, { table: TABLES[kind], id })
    ]);
    if (!changed(result)) throw new NotFoundError('Resource not found');
    return (await this.getResource(kind, id)) ?? { ...value, id };
  }

  async deleteResource(kind: ResourceKind, id: string, actor: string): Promise<void> {
    const table = TABLES[kind];
    const [, result] = await this.db.batch([
      this.auditStatement(`${kind}.deleted`, { id }, actor, { table, id }),
      this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id)
    ]);
    if (!changed(result)) throw new NotFoundError('Resource not found');
  }

  async setCertificationBadge(id: string, badgeObjectKey: string | null, actor: string): Promise<void> {
    const [result] = await this.db.batch([
      this.db.prepare('UPDATE certifications SET badge_object_key = ? WHERE id = ?').bind(badgeObjectKey, id),
      this.auditStatement(badgeObjectKey ? 'certifications.badge_uploaded' : 'certifications.badge_removed', { id }, actor, { table: 'certifications', id })
    ]);
    if (!changed(result)) throw new NotFoundError('Compliance framework not found');
  }

  async getSiteConfig(): Promise<SiteConfig> {
    const row = await this.db.prepare('SELECT * FROM site_config WHERE id = 1').first<Row>();
    if (!row) throw new Error('Trust center has not been initialized');
    return siteFromRow(row);
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const row = await this.db.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<Row>();
    return row ? documentFromRow(row) : null;
  }

  async setVideos(videos: Video[], actor: string): Promise<Video[]> {
    await this.db.batch([
      this.db.prepare('DELETE FROM videos'),
      ...videos.map((video) => this.db.prepare('INSERT INTO videos (id, url, title, description, sort_order) VALUES (?, ?, ?, ?, ?)')
        .bind(video.id, video.url, video.title, video.description, video.sortOrder)),
      this.auditStatement('videos.replaced', { count: videos.length }, actor)
    ]);
    return videos;
  }

  private categoryMapper(kind: CategoryKind): (row: Row) => Category | ControlCategory {
    return kind === 'control' ? controlCategoryFromRow : categoryFromRow;
  }

  async listCategories(kind: CategoryKind): Promise<Category[] | ControlCategory[]> {
    const rows = await this.rows(`SELECT * FROM ${CATEGORY_TABLES[kind]} ORDER BY sort_order, name`);
    return rows.map(this.categoryMapper(kind)) as Category[] | ControlCategory[];
  }

  async getCategory(kind: CategoryKind, id: string): Promise<Category | ControlCategory | null> {
    const row = await this.db.prepare(`SELECT * FROM ${CATEGORY_TABLES[kind]} WHERE id = ?`).bind(id).first<Row>();
    return row ? this.categoryMapper(kind)(row) : null;
  }

  async createCategory(kind: CategoryKind, category: Category | ControlCategory, actor: string): Promise<Category | ControlCategory> {
    const table = CATEGORY_TABLES[kind];
    const max = await this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table}`).first<Row>();
    const sortOrder = numberValue(max ?? {}, 'next');
    const statement = kind === 'control'
      ? this.db.prepare('INSERT INTO control_categories (id, name, visibility, status_visibility_override, sort_order) VALUES (?, ?, ?, ?, ?)')
        .bind(category.id, category.name, (category as ControlCategory).visibility, (category as ControlCategory).statusVisibilityOverride, sortOrder)
      : this.db.prepare(`INSERT INTO ${table} (id, name, sort_order) VALUES (?, ?, ?)`).bind(category.id, category.name, sortOrder);
    await this.db.batch([statement, this.auditStatement(`${kind}_category.created`, { id: category.id, name: category.name }, actor)]);
    return { ...category, sortOrder };
  }

  async updateCategory(kind: CategoryKind, id: string, patch: Partial<ControlCategory>, actor: string): Promise<Category | ControlCategory> {
    const current = await this.getCategory(kind, id);
    if (!current) throw new NotFoundError('Category not found');
    const next = { ...current, ...patch } as ControlCategory;
    const statement = kind === 'control'
      ? this.db.prepare('UPDATE control_categories SET name = ?, visibility = ?, status_visibility_override = ? WHERE id = ?')
        .bind(next.name, next.visibility, next.statusVisibilityOverride, id)
      : this.db.prepare(`UPDATE ${CATEGORY_TABLES[kind]} SET name = ? WHERE id = ?`).bind(next.name, id);
    await this.db.batch([statement, this.auditStatement(`${kind}_category.updated`, { id }, actor)]);
    return (await this.getCategory(kind, id)) ?? next;
  }

  async deleteCategory(kind: CategoryKind, id: string, actor: string): Promise<void> {
    const table = CATEGORY_TABLES[kind];
    const statements: D1PreparedStatement[] = [this.auditStatement(`${kind}_category.deleted`, { id }, actor, { table, id })];
    if (kind === 'resource') statements.push(this.db.prepare('UPDATE documents SET category_id = NULL WHERE category_id = ?').bind(id));
    if (kind === 'faq') statements.push(this.db.prepare('UPDATE faqs SET category_id = NULL WHERE category_id = ?').bind(id));
    if (kind === 'control') {
      // Removing a control category removes the controls in it.
      statements.push(this.db.prepare('DELETE FROM controls WHERE id IN (SELECT control_id FROM control_category_members WHERE category_id = ?)').bind(id));
      statements.push(this.db.prepare('DELETE FROM control_category_members WHERE category_id = ?').bind(id));
    }
    statements.push(this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id));
    const results = await this.db.batch(statements);
    if (!changed(results[results.length - 1])) throw new NotFoundError('Category not found');
  }

  async reorderCategories(kind: CategoryKind, orderedIds: string[], actor: string): Promise<Category[] | ControlCategory[]> {
    const existing = await this.listCategories(kind);
    const existingIds = new Set(existing.map((category) => category.id));
    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      throw new ConflictError('The request must contain the complete set of category IDs in the desired order');
    }
    await this.db.batch([
      ...orderedIds.map((id, index) => this.db.prepare(`UPDATE ${CATEGORY_TABLES[kind]} SET sort_order = ? WHERE id = ?`).bind(index, id)),
      this.auditStatement(`${kind}_category.reordered`, { count: orderedIds.length }, actor)
    ]);
    return this.listCategories(kind);
  }

  async listControls(): Promise<ControlRecord[]> {
    return this.loadControls();
  }

  async getControl(id: string): Promise<ControlRecord | null> {
    const controls = await this.loadControls();
    return controls.find((control) => control.id === id) ?? null;
  }

  private async nextMemberOrder(categoryId: string): Promise<number> {
    const row = await this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM control_category_members WHERE category_id = ?').bind(categoryId).first<Row>();
    return numberValue(row ?? {}, 'next');
  }

  async createControl(control: Omit<ControlRecord, 'memberships'>, categoryIds: string[], actor: string): Promise<ControlRecord> {
    const categories = await this.listCategories('control');
    const known = new Set(categories.map((category) => category.id));
    const missing = categoryIds.find((id) => !known.has(id));
    if (missing) throw new NotFoundError(`Control category not found: ${missing}`);
    const statements: D1PreparedStatement[] = [
      this.db.prepare('INSERT INTO controls (id, external_id, name, description, status, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(control.id, control.externalId, control.name, control.description, control.status, JSON.stringify(control.tags), control.createdAt)
    ];
    for (const categoryId of categoryIds) {
      const order = await this.nextMemberOrder(categoryId);
      statements.push(this.db.prepare('INSERT INTO control_category_members (category_id, control_id, sort_order) VALUES (?, ?, ?)').bind(categoryId, control.id, order));
    }
    statements.push(this.auditStatement('controls.created', { id: control.id, categories: categoryIds.length }, actor));
    await this.db.batch(statements);
    return (await this.getControl(control.id)) as ControlRecord;
  }

  async updateControl(id: string, patch: Partial<Omit<ControlRecord, 'id' | 'memberships' | 'createdAt'>>, actor: string): Promise<ControlRecord> {
    const current = await this.getControl(id);
    if (!current) throw new NotFoundError('Control not found');
    const next = { ...current, ...patch };
    await this.db.batch([
      this.db.prepare('UPDATE controls SET external_id = ?, name = ?, description = ?, status = ?, tags_json = ? WHERE id = ?')
        .bind(next.externalId, next.name, next.description, next.status, JSON.stringify(next.tags), id),
      this.auditStatement('controls.updated', { id }, actor)
    ]);
    return (await this.getControl(id)) as ControlRecord;
  }

  async deleteControl(id: string, actor: string): Promise<void> {
    const [, , result] = await this.db.batch([
      this.auditStatement('controls.deleted', { id }, actor, { table: 'controls', id }),
      this.db.prepare('DELETE FROM control_category_members WHERE control_id = ?').bind(id),
      this.db.prepare('DELETE FROM controls WHERE id = ?').bind(id)
    ]);
    if (!changed(result)) throw new NotFoundError('Control not found');
  }

  async setControlCategoryMembers(categoryId: string, add: string[], remove: string[], actor: string): Promise<ControlCategory> {
    const category = await this.getCategory('control', categoryId);
    if (!category) throw new NotFoundError('Control category not found');
    const controls = await this.loadControls();
    const known = new Set(controls.map((control) => control.id));
    const missing = [...add, ...remove].find((id) => !known.has(id));
    if (missing) throw new NotFoundError(`Control not found: ${missing}`);
    const statements: D1PreparedStatement[] = [];
    let order = await this.nextMemberOrder(categoryId);
    for (const controlId of add) {
      statements.push(this.db.prepare('INSERT OR IGNORE INTO control_category_members (category_id, control_id, sort_order) VALUES (?, ?, ?)').bind(categoryId, controlId, order));
      order += 1;
    }
    for (const controlId of remove) {
      statements.push(this.db.prepare('DELETE FROM control_category_members WHERE category_id = ? AND control_id = ?').bind(categoryId, controlId));
    }
    statements.push(this.auditStatement('control_category.members_changed', { id: categoryId, added: add.length, removed: remove.length }, actor));
    await this.db.batch(statements);
    return category as ControlCategory;
  }

  async reorderControlsInCategory(categoryId: string, orderedControlIds: string[], actor: string): Promise<ControlCategory> {
    const category = await this.getCategory('control', categoryId);
    if (!category) throw new NotFoundError('Control category not found');
    const members = await this.rows('SELECT control_id FROM control_category_members WHERE category_id = ?', categoryId);
    const memberIds = new Set(members.map((row) => text(row, 'control_id')));
    if (orderedControlIds.length !== memberIds.size || orderedControlIds.some((id) => !memberIds.has(id))) {
      throw new ConflictError('The request must contain the complete set of control IDs in the category in the desired order');
    }
    await this.db.batch([
      ...orderedControlIds.map((controlId, index) => this.db.prepare('UPDATE control_category_members SET sort_order = ? WHERE category_id = ? AND control_id = ?').bind(index, categoryId, controlId)),
      this.auditStatement('control_category.reordered', { id: categoryId, count: orderedControlIds.length }, actor)
    ]);
    return category as ControlCategory;
  }

  async tagControls(controlIds: string[], tagCategory: string, tags: string[], mode: 'add' | 'remove', actor: string): Promise<ControlRecord[]> {
    const controls = await this.loadControls();
    const targets = controlIds.map((id) => {
      const control = controls.find((entry) => entry.id === id);
      if (!control) throw new NotFoundError(`Control not found: ${id}`);
      return control;
    });
    const statements = targets.map((control) => {
      const current = new Set(control.tags[tagCategory] ?? []);
      for (const tag of tags) {
        if (mode === 'add') current.add(tag);
        else current.delete(tag);
      }
      const nextTags = { ...control.tags };
      if (current.size) nextTags[tagCategory] = [...current];
      else delete nextTags[tagCategory];
      control.tags = nextTags;
      return this.db.prepare('UPDATE controls SET tags_json = ? WHERE id = ?').bind(JSON.stringify(nextTags), control.id);
    });
    statements.push(this.auditStatement(`controls.tags_${mode === 'add' ? 'added' : 'removed'}`, { controls: controlIds.length, tagCategory }, actor));
    await this.db.batch(statements);
    return targets;
  }

  async listDataCollected(): Promise<DataCollectedItem[]> {
    return (await this.rows('SELECT * FROM data_collected ORDER BY sort_order')).map(dataCollectedFromRow);
  }

  async setDataCollected(items: DataCollectedItem[], heading: string | null | undefined, actor: string): Promise<DataCollectedItem[]> {
    const statements: D1PreparedStatement[] = [
      this.db.prepare('DELETE FROM data_collected'),
      ...items.map((item) => this.db.prepare('INSERT INTO data_collected (id, label, status, sort_order) VALUES (?, ?, ?, ?)')
        .bind(item.id, item.dataCollected, item.status, item.sortOrder))
    ];
    if (heading !== undefined) {
      statements.push(this.db.prepare('UPDATE site_config SET data_collected_heading = ? WHERE id = 1').bind(heading ?? ''));
    }
    statements.push(this.auditStatement('data_collected.replaced', { count: items.length }, actor));
    await this.db.batch(statements);
    return items;
  }

  async listSubscribers(): Promise<SubscriberRecord[]> {
    // Active first so real recipients stay visible even if the pending tail is spammed.
    const rows = await this.rows(`
      SELECT id, email, status, created_at, confirmed_at FROM subscribers
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, created_at DESC LIMIT 1000
    `);
    return rows.map(subscriberFromRow);
  }

  async getSubscriber(id: string): Promise<SubscriberRecord | null> {
    const row = await this.db.prepare('SELECT id, email, status, created_at, confirmed_at FROM subscribers WHERE id = ?').bind(id).first<Row>();
    return row ? subscriberFromRow(row) : null;
  }

  async createSubscriber(input: AdminSubscriberInput, confirmEmail: OutgoingEmail | null, actor: string): Promise<SubscriberRecord> {
    const existing = await this.db.prepare('SELECT id, status FROM subscribers WHERE email = ?').bind(input.email).first<Row>();
    if (existing && text(existing, 'status') === 'active') throw new ConflictError('That address is already subscribed');
    const id = existing ? text(existing, 'id') : input.id;
    const status = input.verified ? 'active' : 'pending';
    const statements: D1PreparedStatement[] = [
      existing
        ? this.db.prepare(`
            UPDATE subscribers SET status = ?, confirmed_at = ?, confirm_token_hash = ?, confirm_expires_at = ?, unsubscribe_token = ? WHERE id = ?
          `).bind(status, input.verified ? input.createdAt : null, input.confirmTokenHash, input.confirmExpiresAt, input.unsubscribeToken, id)
        : this.db.prepare(`
            INSERT INTO subscribers (id, email, status, created_at, confirmed_at, confirm_token_hash, confirm_expires_at, unsubscribe_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, input.email, status, input.createdAt, input.verified ? input.createdAt : null, input.confirmTokenHash, input.confirmExpiresAt, input.unsubscribeToken)
    ];
    if (confirmEmail) statements.push(this.outboxStatement(confirmEmail, input.createdAt));
    statements.push(this.auditStatement('subscriber.added', { id, verified: input.verified }, actor));
    await this.db.batch(statements);
    return (await this.getSubscriber(id)) as SubscriberRecord;
  }

  async deleteSubscriber(id: string, actor: string): Promise<void> {
    const [, result] = await this.db.batch([
      this.auditStatement('subscriber.deleted', { id }, actor, { table: 'subscribers', id }),
      this.db.prepare('DELETE FROM subscribers WHERE id = ?').bind(id)
    ]);
    if (!changed(result)) throw new NotFoundError('Subscriber not found');
  }

  async listActiveSubscribers(): Promise<ActiveSubscriber[]> {
    const rows = await this.rows("SELECT id, email, unsubscribe_token FROM subscribers WHERE status = 'active' ORDER BY created_at LIMIT 1000");
    return rows.map((row) => ({ id: text(row, 'id'), email: text(row, 'email'), unsubscribeToken: nullableText(row, 'unsubscribe_token') }));
  }

  async requestSubscription(subscription: SubscriptionRequest, confirmEmail: OutgoingEmail, recentConfirmThreshold: string): Promise<'pending' | 'active' | 'throttled'> {
    const existing = await this.db.prepare('SELECT id, status, confirm_expires_at FROM subscribers WHERE email = ?')
      .bind(subscription.email).first<Row>();
    if (existing && text(existing, 'status') === 'active') return 'active';
    if (existing && text(existing, 'status') === 'pending' && (nullableText(existing, 'confirm_expires_at') ?? '') > recentConfirmThreshold) return 'throttled';
    const upsert = existing
      ? this.db.prepare(`
          UPDATE subscribers SET status = 'pending', confirm_token_hash = ?, confirm_expires_at = ?, unsubscribe_token = ?
          WHERE id = ?
        `).bind(subscription.confirmTokenHash, subscription.confirmExpiresAt, subscription.unsubscribeToken, text(existing, 'id'))
      : this.db.prepare(`
          INSERT INTO subscribers (id, email, status, created_at, confirm_token_hash, confirm_expires_at, unsubscribe_token)
          VALUES (?, ?, 'pending', ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), subscription.email, subscription.createdAt, subscription.confirmTokenHash, subscription.confirmExpiresAt, subscription.unsubscribeToken);
    await this.db.batch([upsert, this.outboxStatement(confirmEmail, subscription.createdAt)]);
    return 'pending';
  }

  async confirmSubscription(confirmTokenHash: string, at: string): Promise<boolean> {
    const row = await this.db.prepare(`
      SELECT id, confirm_expires_at FROM subscribers WHERE confirm_token_hash = ? AND status = 'pending'
    `).bind(confirmTokenHash).first<Row>();
    if (!row) return false;
    const expiresAt = text(row, 'confirm_expires_at');
    if (!expiresAt || expiresAt < at) return false;
    await this.db.batch([
      this.db.prepare(`
        UPDATE subscribers SET status = 'active', confirmed_at = ?, confirm_token_hash = NULL, confirm_expires_at = NULL
        WHERE id = ?
      `).bind(at, text(row, 'id')),
      this.auditStatement('subscriber.confirmed', { id: text(row, 'id') }, 'public')
    ]);
    return true;
  }

  async unsubscribe(unsubscribeToken: string, _at: string): Promise<boolean> {
    const row = await this.db.prepare('SELECT id, status FROM subscribers WHERE unsubscribe_token = ?')
      .bind(unsubscribeToken).first<Row>();
    if (!row) return false;
    if (text(row, 'status') === 'unsubscribed') return true;
    await this.db.batch([
      this.db.prepare(`
        UPDATE subscribers SET status = 'unsubscribed', confirm_token_hash = NULL, confirm_expires_at = NULL
        WHERE id = ?
      `).bind(text(row, 'id')),
      this.auditStatement('subscriber.unsubscribed', { id: text(row, 'id') }, 'public')
    ]);
    return true;
  }

  async listAccessRequests(): Promise<AccessRequestRecord[]> {
    const rows = await this.rows("SELECT * FROM access_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 1000");
    return rows.map(accessRequestFromRow);
  }

  async getAccessRequest(id: string): Promise<AccessRequestRecord | null> {
    const row = await this.db.prepare('SELECT * FROM access_requests WHERE id = ?').bind(id).first<Row>();
    return row ? accessRequestFromRow(row) : null;
  }

  async createAccessRequest(record: AccessRequestRecord, notification?: OutgoingEmail): Promise<AccessRequestCreation> {
    const resourcesJson = record.requestedResources ? JSON.stringify(record.requestedResources) : null;
    const pending = await this.rows("SELECT id, requested_resources_json FROM access_requests WHERE email = ? AND status = 'pending'", record.email);
    const existing = pending.find((row) => nullableText(row, 'requested_resources_json') === resourcesJson);
    if (existing) return { id: text(existing, 'id'), created: false };
    const statements = [
      this.db.prepare(`
        INSERT INTO access_requests (id, name, email, company, reason, requested_resources_json, access_level, status, denial_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
      `).bind(record.id, record.name, record.email, record.company, record.reason, resourcesJson, record.accessLevel, record.createdAt, record.updatedAt),
      this.auditStatement('access_request.created', { id: record.id, accessLevel: record.accessLevel, resources: record.requestedResources?.length ?? null }, 'public')
    ];
    if (notification) statements.push(this.outboxStatement(notification, record.createdAt));
    await this.db.batch(statements);
    return { id: record.id, created: true };
  }

  async retryEmail(id: string, actor: string): Promise<void> {
    const result = await this.db.prepare(`
      UPDATE email_outbox SET status = 'pending', attempts = 0, last_error = NULL, claimed_at = NULL
      WHERE id = ? AND status = 'failed'
    `).bind(id).run();
    if (!changed(result)) throw new NotFoundError('Only failed emails can be retried');
    await this.auditStatement('email.retried', { id }, actor).run();
  }

  private viewerUpsertStatement(viewer: ViewerRecord): D1PreparedStatement {
    return this.db.prepare(`
      INSERT INTO viewers (id, email, name, company_name, access_level, resource_ids_json, nda_required, nda_accepted_at, expires_at, token_hash, added_by, access_request_id, invite_sent_at, created_at, updated_at, removed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name, company_name = excluded.company_name, access_level = excluded.access_level,
        resource_ids_json = excluded.resource_ids_json, nda_required = excluded.nda_required, nda_accepted_at = excluded.nda_accepted_at,
        expires_at = excluded.expires_at, token_hash = excluded.token_hash, added_by = excluded.added_by,
        access_request_id = excluded.access_request_id, invite_sent_at = excluded.invite_sent_at, updated_at = excluded.updated_at,
        removed_at = excluded.removed_at
    `).bind(
      viewer.id, viewer.email, viewer.name, viewer.companyName, viewer.accessLevel,
      viewer.resourceIds ? JSON.stringify(viewer.resourceIds) : null, viewer.ndaRequired ? 1 : 0, viewer.ndaAcceptedAt,
      viewer.expiresAt, viewer.tokenHash, viewer.addedBy, viewer.accessRequestId, viewer.inviteSentAt,
      viewer.createdAt, viewer.updatedAt, viewer.removedAt
    );
  }

  async approveAccessRequest(id: string, viewer: ViewerRecord, email: OutgoingEmail, actor: string, at: string): Promise<ViewerRecord> {
    // Check before writing so a repeated approval never re-issues a viewer or
    // queues a second access email; the conditional UPDATE below covers races.
    const existing = await this.getAccessRequest(id);
    if (!existing) throw new NotFoundError('Access request not found');
    if (existing.status !== 'pending') throw new ConflictError('This access request has already been decided');
    const [result] = await this.db.batch([
      this.db.prepare("UPDATE access_requests SET status = 'approved', updated_at = ? WHERE id = ? AND status = 'pending'").bind(at, id),
      this.viewerUpsertStatement(viewer),
      this.outboxStatement(email, at),
      this.auditStatement('access_request.reviewed', { id, status: 'approved', accessLevel: viewer.accessLevel }, actor, { table: 'access_requests', id }),
      this.auditStatement('viewer.granted', { email: viewer.email, accessLevel: viewer.accessLevel, expiresAt: viewer.expiresAt }, actor)
    ]);
    if (!changed(result)) throw new ConflictError('This access request has already been decided');
    return (await this.getViewerByEmail(viewer.email)) ?? viewer;
  }

  async denyAccessRequest(id: string, reason: string | null, actor: string, at: string): Promise<void> {
    const [result] = await this.db.batch([
      this.db.prepare("UPDATE access_requests SET status = 'denied', denial_reason = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(reason, at, id),
      this.auditStatement('access_request.reviewed', { id, status: 'denied' }, actor, { table: 'access_requests', id })
    ]);
    if (!changed(result)) {
      const existing = await this.getAccessRequest(id);
      if (!existing) throw new NotFoundError('Access request not found');
      throw new ConflictError('This access request has already been decided');
    }
  }

  async listViewers(includeRemoved: boolean): Promise<ViewerRecord[]> {
    const where = includeRemoved ? '' : ' WHERE removed_at IS NULL';
    return (await this.rows(`SELECT * FROM viewers${where} ORDER BY created_at DESC LIMIT 1000`)).map(viewerFromRow);
  }

  async getViewer(id: string): Promise<ViewerRecord | null> {
    const row = await this.db.prepare('SELECT * FROM viewers WHERE id = ?').bind(id).first<Row>();
    return row ? viewerFromRow(row) : null;
  }

  async getViewerByEmail(email: string): Promise<ViewerRecord | null> {
    const row = await this.db.prepare('SELECT * FROM viewers WHERE email = ?').bind(email).first<Row>();
    return row ? viewerFromRow(row) : null;
  }

  async getViewerByTokenHash(tokenHash: string): Promise<ViewerRecord | null> {
    const row = await this.db.prepare('SELECT * FROM viewers WHERE token_hash = ?').bind(tokenHash).first<Row>();
    return row ? viewerFromRow(row) : null;
  }

  async saveViewer(viewer: ViewerRecord, email: OutgoingEmail | null, actor: string, action: string): Promise<ViewerRecord> {
    const statements = [this.viewerUpsertStatement(viewer)];
    if (email) statements.push(this.outboxStatement(email, viewer.updatedAt));
    statements.push(this.auditStatement(action, { email: viewer.email, accessLevel: viewer.accessLevel }, actor));
    await this.db.batch(statements);
    return (await this.getViewerByEmail(viewer.email)) ?? viewer;
  }

  async removeViewer(id: string, actor: string, at: string): Promise<void> {
    // The audit row is written first, guarded on the viewer still being active,
    // so a repeated removal leaves no trace.
    const [, result] = await this.db.batch([
      this.auditStatement('viewer.removed', { id }, actor, { table: 'viewers', id, andWhere: 'removed_at IS NULL' }),
      this.db.prepare('UPDATE viewers SET removed_at = ?, token_hash = NULL, updated_at = ? WHERE id = ? AND removed_at IS NULL').bind(at, at, id)
    ]);
    if (!changed(result)) throw new NotFoundError('Viewer not found or already removed');
  }

  async acceptViewerNda(id: string, at: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('UPDATE viewers SET nda_accepted_at = COALESCE(nda_accepted_at, ?), updated_at = ? WHERE id = ?').bind(at, at, id),
      this.auditStatement('viewer.nda_accepted', { id }, 'viewer', { table: 'viewers', id })
    ]);
  }

  async listChatbotConversations(search: string | null): Promise<ChatbotConversation[]> {
    const rows = search
      ? await this.rows('SELECT * FROM chatbot_conversations WHERE first_message LIKE ? OR user_email LIKE ? ORDER BY created_at DESC LIMIT 1000', `%${search}%`, `%${search}%`)
      : await this.rows('SELECT * FROM chatbot_conversations ORDER BY created_at DESC LIMIT 1000');
    return rows.map(conversationFromRow);
  }

  async getChatbotConversation(id: string): Promise<{ conversation: ChatbotConversation; messages: ChatbotMessage[] } | null> {
    const row = await this.db.prepare('SELECT * FROM chatbot_conversations WHERE id = ?').bind(id).first<Row>();
    if (!row) return null;
    const messages = await this.rows('SELECT * FROM chatbot_messages WHERE conversation_id = ? ORDER BY created_at, rowid', id);
    return { conversation: conversationFromRow(row), messages: messages.map(chatMessageFromRow) };
  }

  async appendChatbotMessages(conversation: ChatbotConversation, messages: ChatbotMessage[]): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        INSERT INTO chatbot_conversations (id, first_message, num_messages, user_email, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET num_messages = excluded.num_messages, updated_at = excluded.updated_at
      `).bind(conversation.id, conversation.firstMessage, conversation.numMessages, conversation.userEmail, conversation.isPublicConversation ? 1 : 0, conversation.createdAt, conversation.updatedAt),
      ...messages.map((message) => this.db.prepare('INSERT INTO chatbot_messages (id, conversation_id, role, message, references_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(message.id, message.conversationId, message.role, message.message, JSON.stringify(message.references), message.createdAt))
    ]);
  }

  async applyImport(bundle: ImportBundle, actor: string): Promise<void> {
    const current = await this.db.prepare('SELECT * FROM site_config WHERE id = 1').first<Row>();
    if (!current) throw new Error('Trust center has not been initialized');
    const timestamp = new Date().toISOString();
    const site = validateSite({ ...siteFromRow(current), ...bundle.site }, timestamp);
    const statements: D1PreparedStatement[] = [this.siteStatement(site)];

    const resourceCategoryIds = new Map<string, string>();
    const faqCategoryIds = new Map<string, string>();
    if (bundle.documents !== undefined) {
      statements.push(this.db.prepare('DELETE FROM resource_categories'));
      const names = [...new Set(bundle.documents.map((item) => item.category).filter((name): name is string => Boolean(name)))];
      names.forEach((name, index) => {
        const id = crypto.randomUUID();
        resourceCategoryIds.set(name, id);
        statements.push(this.db.prepare('INSERT INTO resource_categories (id, name, sort_order) VALUES (?, ?, ?)').bind(id, name, index));
      });
    }
    if (bundle.faqs !== undefined) {
      statements.push(this.db.prepare('DELETE FROM faq_categories'));
      const names = [...new Set(bundle.faqs.map((item) => item.category).filter((name): name is string => Boolean(name)))];
      names.forEach((name, index) => {
        const id = crypto.randomUUID();
        faqCategoryIds.set(name, id);
        statements.push(this.db.prepare('INSERT INTO faq_categories (id, name, sort_order) VALUES (?, ?, ?)').bind(id, name, index));
      });
    }

    for (const kind of Object.keys(TABLES) as ResourceKind[]) {
      const imported = bundle[kind] as Array<Record<string, unknown>> | undefined;
      if (imported === undefined) continue;
      statements.push(kind === 'documents'
        ? this.db.prepare("DELETE FROM documents WHERE source_type = 'external'")
        : this.db.prepare(`DELETE FROM ${TABLES[kind]}`));
      if (kind === 'documents') statements.push(this.db.prepare('UPDATE documents SET category_id = NULL'));
      for (const item of imported) {
        const withCategory = kind === 'documents'
          ? { ...item, categoryId: typeof item.category === 'string' ? resourceCategoryIds.get(item.category) ?? null : null }
          : kind === 'faqs'
            ? { ...item, categoryId: typeof item.category === 'string' ? faqCategoryIds.get(item.category) ?? null : null }
            : item;
        const normalized = normalizeResource(kind, withCategory, crypto.randomUUID(), timestamp);
        const lifecycle: LifecycleStatus = item.visible === false ? 'draft' : 'published';
        statements.push(this.resourceStatement(kind, { ...normalized, lifecycle }, false));
      }
    }

    if (bundle.videos !== undefined) {
      statements.push(this.db.prepare('DELETE FROM videos'));
      bundle.videos.forEach((video, index) => {
        statements.push(this.db.prepare('INSERT INTO videos (id, url, title, description, sort_order) VALUES (?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), video.url, video.title, video.description ?? '', index));
      });
    }
    if (bundle.controlCategories !== undefined) {
      statements.push(this.db.prepare('DELETE FROM control_category_members'), this.db.prepare('DELETE FROM controls'), this.db.prepare('DELETE FROM control_categories'));
      bundle.controlCategories.forEach((category, categoryIndex) => {
        const categoryId = crypto.randomUUID();
        statements.push(this.db.prepare('INSERT INTO control_categories (id, name, visibility, status_visibility_override, sort_order) VALUES (?, ?, ?, ?, ?)')
          .bind(categoryId, category.name, category.visibility ?? 'PUBLIC', category.statusVisibilityOverride ?? null, categoryIndex));
        (category.controls ?? []).forEach((control, controlIndex) => {
          const controlId = crypto.randomUUID();
          statements.push(this.db.prepare('INSERT INTO controls (id, external_id, name, description, status, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(controlId, control.externalId ?? null, control.name, control.description ?? '', control.status ?? 'UNMAPPED', JSON.stringify(control.tags ?? {}), timestamp));
          statements.push(this.db.prepare('INSERT INTO control_category_members (category_id, control_id, sort_order) VALUES (?, ?, ?)').bind(categoryId, controlId, controlIndex));
        });
      });
    }
    if (bundle.dataCollected !== undefined) {
      statements.push(this.db.prepare('DELETE FROM data_collected'));
      bundle.dataCollected.forEach((item, index) => {
        statements.push(this.db.prepare('INSERT INTO data_collected (id, label, status, sort_order) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), item.dataCollected, item.status, index));
      });
    }
    statements.push(this.auditStatement('import.applied', { source: bundle.source }, actor));
    await this.db.batch(statements);
  }

  async log(action: string, detail: Record<string, unknown> = {}, actor = 'admin'): Promise<void> {
    await this.auditStatement(action, detail, actor).run();
  }

  private outboxStatement(email: OutgoingEmail, createdAt: string, guard?: { onlyIfUpdateUnnotified: string }): D1PreparedStatement {
    const bindings = [crypto.randomUUID(), email.to, email.subject, email.bodyText, email.template, JSON.stringify(email.headers ?? {}), createdAt];
    if (guard) {
      return this.db.prepare(`
        INSERT INTO email_outbox (id, to_email, subject, body_text, template, headers_json, status, attempts, created_at)
        SELECT ?, ?, ?, ?, ?, ?, 'pending', 0, ?
        WHERE EXISTS (SELECT 1 FROM updates WHERE id = ? AND notified_at IS NULL)
      `).bind(...bindings, guard.onlyIfUpdateUnnotified);
    }
    return this.db.prepare(`
      INSERT INTO email_outbox (id, to_email, subject, body_text, template, headers_json, status, attempts, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `).bind(...bindings);
  }

  async listSendableEmails(limit: number): Promise<StoredOutboxEmail[]> {
    const leaseExpiry = new Date(Date.now() - EMAIL_CLAIM_LEASE_MS).toISOString();
    const [, rows] = await this.db.batch([
      this.db.prepare(`
        UPDATE email_outbox SET status = 'pending', claimed_at = NULL
        WHERE status = 'sending' AND claimed_at < ?
      `).bind(leaseExpiry),
      this.db.prepare(`
        SELECT id, to_email, subject, body_text, template, headers_json, attempts
        FROM email_outbox
        WHERE status = 'pending' AND attempts < ?
        ORDER BY created_at
        LIMIT ?
      `).bind(MAX_EMAIL_ATTEMPTS, Math.max(1, Math.min(limit, 100)))
    ]);
    if (!rows) return [];
    return rows.results.map((value) => {
      const row = value as Row;
      const email: StoredOutboxEmail = {
        id: text(row, 'id'),
        to: text(row, 'to_email'),
        subject: text(row, 'subject'),
        bodyText: text(row, 'body_text'),
        template: text(row, 'template'),
        attempts: numberValue(row, 'attempts')
      };
      try {
        const headers: unknown = JSON.parse(text(row, 'headers_json'));
        if (headers && typeof headers === 'object' && !Array.isArray(headers) && Object.keys(headers).length > 0) {
          email.headers = headers as Record<string, string>;
        }
      } catch {
      }
      return email;
    });
  }

  async claimEmail(id: string, expectedAttempts: number): Promise<boolean> {
    const result = await this.db.prepare(`
      UPDATE email_outbox SET status = 'sending', attempts = attempts + 1, claimed_at = ?
      WHERE id = ? AND status = 'pending' AND attempts = ?
    `).bind(new Date().toISOString(), id, expectedAttempts).run();
    return (result.meta.changes ?? 0) > 0;
  }

  async markEmailSent(id: string, at: string): Promise<void> {
    await this.db.prepare("UPDATE email_outbox SET status = 'sent', sent_at = ?, last_error = NULL, claimed_at = NULL WHERE id = ? AND status = 'sending'")
      .bind(at, id).run();
  }

  async markEmailFailed(id: string, error: string, exhausted: boolean): Promise<void> {
    await this.db.prepare("UPDATE email_outbox SET status = ?, last_error = ?, claimed_at = NULL WHERE id = ? AND status = 'sending'")
      .bind(exhausted ? 'failed' : 'pending', error, id).run();
  }
}
