import { createHandler, type AppServices, type DocumentStore } from '../../src/app';
import {
  ConflictError,
  NotFoundError,
  normalizeResource,
  validateSite,
  type AccessRequestRecord,
  type AdminState,
  type Category,
  type CategoryKind,
  type ChatbotConversation,
  type ChatbotMessage,
  type ControlCategory,
  type ControlRecord,
  type DataCollectedItem,
  type DocumentRecord,
  type ImportBundle,
  type LifecycleStatus,
  type ResourceKind,
  type SiteConfig,
  type SubscriberRecord,
  type TrustCenterState,
  type UpdateRecord,
  type Video,
  type ViewerRecord
} from '../../src/domain';
import type { EmailSender, OutgoingEmail, StoredOutboxEmail } from '../../src/email';
import type { ActiveSubscriber, AdminSubscriberInput, Repository, SubscriptionRequest, UpdateNotification } from '../../src/repository';

export interface OutboxRow extends StoredOutboxEmail {
  status: 'pending' | 'sending' | 'sent' | 'failed';
  lastError?: string;
}

export interface FakeSubscriber extends SubscriberRecord {
  confirmTokenHash: string | null;
  confirmExpiresAt: string | null;
  unsubscribeToken: string | null;
}

export class FakeEmailSender implements EmailSender {
  sent: OutgoingEmail[] = [];
  failNext = false;
  async send(email: OutgoingEmail) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('SMTP unavailable');
    }
    this.sent.push(email);
  }
}

export class MemoryDocuments implements DocumentStore {
  objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  failDelete = false;
  async put(key: string, bytes: Uint8Array, contentType: string) { this.objects.set(key, { bytes, contentType }); }
  async get(key: string) { return this.objects.get(key) ?? null; }
  async delete(key: string) {
    if (this.failDelete) throw new Error('R2 unavailable');
    this.objects.delete(key);
  }
}

export function fixtureSite(): SiteConfig {
  return {
    companyName: 'Northstar Labs',
    title: '',
    headline: 'Security that can be inspected.',
    summary: 'A concise public security profile.',
    securityEmail: 'security@northstar.example',
    location: 'United States',
    accent: '#1f6b52',
    secondaryColor: '',
    logoUrl: '',
    logoObjectKey: null,
    faviconObjectKey: null,
    privacyPolicyUrl: '',
    isPublic: true,
    bannerSetting: 'MINIMAL',
    bannerStartColor: '',
    bannerEndColor: '',
    bannerObjectKey: null,
    controlVisibilityMode: 'SHOW_ALL_WITH_STATUS',
    dataCollectedHeading: '',
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z'
  };
}

export function gatedDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'gated',
    title: 'SOC 2 report',
    description: 'Available by request',
    category: 'Audit',
    categoryId: null,
    visibility: 'request',
    sourceType: 'external',
    url: 'https://example.com/report.pdf',
    objectKey: null,
    fileName: null,
    mimeType: null,
    version: '2026',
    publishedAt: '2026-08-30',
    reviewAt: '2027-08-30',
    lifecycle: 'published',
    ...overrides
  };
}

export function fixtureState(): TrustCenterState {
  return {
    site: fixtureSite(),
    certifications: [],
    documents: [gatedDocument()],
    faqs: [],
    subprocessors: [],
    updates: [],
    videos: [],
    resourceCategories: [],
    faqCategories: [],
    controlCategories: [],
    controls: [],
    dataCollected: []
  };
}

let counter = 0;
const uid = () => `mem-${(counter += 1)}`;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MemoryRepository implements Repository {
  state: TrustCenterState = fixtureState();
  subscribers: FakeSubscriber[] = [];
  accessRequests: AccessRequestRecord[] = [];
  viewers: ViewerRecord[] = [];
  conversations: ChatbotConversation[] = [];
  messages: ChatbotMessage[] = [];
  outbox: OutboxRow[] = [];
  audits: string[] = [];
  actors: string[] = [];
  auditRows: Array<{ action: string; actor: string; detail: Record<string, unknown> }> = [];
  imported: ImportBundle | null = null;
  failNextSiteUpdate = false;

  private audit(action: string, actor = 'admin', detail: Record<string, unknown> = {}) {
    this.audits.push(action);
    this.actors.push(actor);
    this.auditRows.push({ action, actor, detail });
  }

  private list(kind: ResourceKind): Array<Record<string, unknown>> {
    return this.state[kind] as unknown as Array<Record<string, unknown>>;
  }

  async getPublicState() {
    const state = clone(this.state);
    for (const document of state.documents) document.objectKey = null;
    return state;
  }

  async getAdminState(): Promise<AdminState> {
    const state = clone(this.state);
    return {
      ...state,
      subscribers: this.subscribers.map(({ confirmTokenHash: _c, confirmExpiresAt: _e, unsubscribeToken: _u, ...subscriber }) => subscriber),
      accessRequests: clone(this.accessRequests),
      viewers: clone(this.viewers),
      chatbotConversations: clone(this.conversations),
      auditLog: this.auditRows.map((row) => ({ ...row })),
      emailOutbox: this.outbox.map((row) => ({ ...row })),
      totals: {
        subscribers: this.subscribers.length,
        activeSubscribers: this.subscribers.filter((entry) => entry.status === 'active').length,
        accessRequests: this.accessRequests.length,
        pendingAccessRequests: this.accessRequests.filter((entry) => entry.status === 'pending').length
      }
    };
  }

  async getSiteConfig() { return this.state.site; }

  async updateSite(site: SiteConfig, actor: string) {
    if (this.failNextSiteUpdate) {
      this.failNextSiteUpdate = false;
      throw new Error('D1 write failed');
    }
    this.state.site = site;
    this.audit('site.updated', actor);
  }

  async listResources(kind: ResourceKind) {
    return this.list(kind);
  }

  async createResource(kind: ResourceKind, value: Record<string, unknown>, actor: string) {
    if (kind === 'documents' && value.categoryId && !this.state.resourceCategories.some((category) => category.id === value.categoryId)) throw new NotFoundError('Resource category not found');
    if (kind === 'faqs' && value.categoryId && !this.state.faqCategories.some((category) => category.id === value.categoryId)) throw new NotFoundError('FAQ category not found');
    const record = { ...value, lifecycle: 'draft' as LifecycleStatus, ...(kind === 'updates' ? { notifiedAt: null } : {}) };
    this.list(kind).push(record);
    this.audit(`${kind}.created`, actor);
    return record;
  }

  async updateResource(kind: ResourceKind, id: string, value: Record<string, unknown>, actor: string) {
    const items = this.list(kind);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundError('Resource not found');
    if (kind === 'documents' && value.categoryId && !this.state.resourceCategories.some((category) => category.id === value.categoryId)) throw new NotFoundError('Resource category not found');
    const current = items[index]!;
    items[index] = { ...current, ...value, id, lifecycle: current.lifecycle };
    this.audit(`${kind}.updated`, actor);
    return items[index]!;
  }

  async deleteResource(kind: ResourceKind, id: string, actor: string) {
    const items = this.list(kind);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundError('Resource not found');
    items.splice(index, 1);
    this.audit(`${kind}.deleted`, actor);
  }

  async getResource(kind: ResourceKind, id: string) {
    return this.list(kind).find((entry) => entry.id === id) ?? null;
  }

  queueEmail(email: OutgoingEmail) {
    this.outbox.push({ ...email, id: `email-${this.outbox.length + 1}`, attempts: 0, status: 'pending' });
  }

  private applyNotification(notify: UpdateNotification) {
    for (const assignment of notify.unsubscribeTokens) {
      const subscriber = this.subscribers.find((entry) => entry.id === assignment.id);
      if (subscriber && !subscriber.unsubscribeToken) subscriber.unsubscribeToken = assignment.token;
    }
    for (const email of notify.emails) this.queueEmail(email);
    this.audit('update.notified');
    return notify.emails.length;
  }

  async setResourceLifecycle(kind: ResourceKind, id: string, lifecycle: LifecycleStatus, actor: string, notify?: UpdateNotification) {
    const item = this.list(kind).find((entry) => entry.id === id);
    if (!item) throw new NotFoundError('Resource not found');
    item.lifecycle = lifecycle;
    this.audit(`${kind}.lifecycle_changed`, actor);
    if (!notify || item.notifiedAt) return 0;
    item.notifiedAt = notify.notifiedAt;
    return this.applyNotification(notify);
  }

  async getDocument(id: string) { return this.state.documents.find((document) => document.id === id) ?? null; }

  async setCertificationBadge(id: string, badgeObjectKey: string | null, actor: string) {
    const item = this.state.certifications.find((entry) => entry.id === id);
    if (!item) throw new NotFoundError('Compliance framework not found');
    item.badgeObjectKey = badgeObjectKey;
    this.audit('certifications.badge_uploaded', actor);
  }

  async setVideos(videos: Video[], actor: string) {
    this.state.videos = videos;
    this.audit('videos.replaced', actor);
    return videos;
  }

  private categories(kind: CategoryKind): Array<Category | ControlCategory> {
    return kind === 'resource' ? this.state.resourceCategories : kind === 'faq' ? this.state.faqCategories : this.state.controlCategories;
  }

  async listCategories(kind: CategoryKind) {
    return [...this.categories(kind)].sort((a, b) => a.sortOrder - b.sortOrder) as Category[] | ControlCategory[];
  }

  async getCategory(kind: CategoryKind, id: string) { return this.categories(kind).find((category) => category.id === id) ?? null; }

  async createCategory(kind: CategoryKind, category: Category | ControlCategory, actor: string) {
    const list = this.categories(kind);
    const created = { ...category, sortOrder: list.length ? Math.max(...list.map((entry) => entry.sortOrder)) + 1 : 0 };
    list.push(created as ControlCategory);
    this.audit(`${kind}_category.created`, actor);
    return created;
  }

  async updateCategory(kind: CategoryKind, id: string, patch: Partial<ControlCategory>, actor: string) {
    const category = this.categories(kind).find((entry) => entry.id === id);
    if (!category) throw new NotFoundError('Category not found');
    Object.assign(category, patch);
    this.audit(`${kind}_category.updated`, actor);
    return category;
  }

  async deleteCategory(kind: CategoryKind, id: string, actor: string) {
    const list = this.categories(kind);
    const index = list.findIndex((entry) => entry.id === id);
    if (index < 0) throw new NotFoundError('Category not found');
    list.splice(index, 1);
    if (kind === 'resource') for (const document of this.state.documents) if (document.categoryId === id) document.categoryId = null;
    if (kind === 'faq') for (const faq of this.state.faqs) if (faq.categoryId === id) faq.categoryId = null;
    if (kind === 'control') {
      const members = this.state.controls.filter((control) => control.memberships.some((membership) => membership.categoryId === id));
      this.state.controls = this.state.controls.filter((control) => !members.includes(control));
    }
    this.audit(`${kind}_category.deleted`, actor);
  }

  async reorderCategories(kind: CategoryKind, orderedIds: string[], actor: string) {
    const list = this.categories(kind);
    if (orderedIds.length !== list.length || orderedIds.some((id) => !list.some((entry) => entry.id === id))) {
      throw new ConflictError('The request must contain the complete set of category IDs in the desired order');
    }
    for (const category of list) category.sortOrder = orderedIds.indexOf(category.id);
    this.audit(`${kind}_category.reordered`, actor);
    return this.listCategories(kind);
  }

  async listControls() { return this.state.controls; }
  async getControl(id: string) { return this.state.controls.find((control) => control.id === id) ?? null; }

  async createControl(control: Omit<ControlRecord, 'memberships'>, categoryIds: string[], actor: string) {
    for (const categoryId of categoryIds) if (!this.state.controlCategories.some((category) => category.id === categoryId)) throw new NotFoundError(`Control category not found: ${categoryId}`);
    const record: ControlRecord = {
      ...control,
      memberships: categoryIds.map((categoryId) => ({ categoryId, sortOrder: this.state.controls.filter((entry) => entry.memberships.some((m) => m.categoryId === categoryId)).length }))
    };
    this.state.controls.push(record);
    this.audit('controls.created', actor);
    return record;
  }

  async updateControl(id: string, patch: Partial<Omit<ControlRecord, 'id' | 'memberships' | 'createdAt'>>, actor: string) {
    const control = this.state.controls.find((entry) => entry.id === id);
    if (!control) throw new NotFoundError('Control not found');
    Object.assign(control, patch);
    this.audit('controls.updated', actor);
    return control;
  }

  async deleteControl(id: string, actor: string) {
    const index = this.state.controls.findIndex((entry) => entry.id === id);
    if (index < 0) throw new NotFoundError('Control not found');
    this.state.controls.splice(index, 1);
    this.audit('controls.deleted', actor);
  }

  async setControlCategoryMembers(categoryId: string, add: string[], remove: string[], actor: string) {
    const category = this.state.controlCategories.find((entry) => entry.id === categoryId);
    if (!category) throw new NotFoundError('Control category not found');
    for (const controlId of [...add, ...remove]) if (!this.state.controls.some((control) => control.id === controlId)) throw new NotFoundError(`Control not found: ${controlId}`);
    for (const controlId of add) {
      const control = this.state.controls.find((entry) => entry.id === controlId)!;
      if (!control.memberships.some((m) => m.categoryId === categoryId)) control.memberships.push({ categoryId, sortOrder: control.memberships.length });
    }
    for (const controlId of remove) {
      const control = this.state.controls.find((entry) => entry.id === controlId)!;
      control.memberships = control.memberships.filter((m) => m.categoryId !== categoryId);
    }
    this.audit('control_category.members_changed', actor);
    return category;
  }

  async reorderControlsInCategory(categoryId: string, orderedControlIds: string[], actor: string) {
    const category = this.state.controlCategories.find((entry) => entry.id === categoryId);
    if (!category) throw new NotFoundError('Control category not found');
    const members = this.state.controls.filter((control) => control.memberships.some((m) => m.categoryId === categoryId));
    if (orderedControlIds.length !== members.length || orderedControlIds.some((id) => !members.some((control) => control.id === id))) {
      throw new ConflictError('The request must contain the complete set of control IDs in the category in the desired order');
    }
    for (const control of members) {
      const membership = control.memberships.find((m) => m.categoryId === categoryId)!;
      membership.sortOrder = orderedControlIds.indexOf(control.id);
    }
    this.audit('control_category.reordered', actor);
    return category;
  }

  async tagControls(controlIds: string[], tagCategory: string, tags: string[], mode: 'add' | 'remove', actor: string) {
    const targets = controlIds.map((id) => {
      const control = this.state.controls.find((entry) => entry.id === id);
      if (!control) throw new NotFoundError(`Control not found: ${id}`);
      return control;
    });
    for (const control of targets) {
      const current = new Set(control.tags[tagCategory] ?? []);
      for (const tag of tags) mode === 'add' ? current.add(tag) : current.delete(tag);
      if (current.size) control.tags[tagCategory] = [...current];
      else delete control.tags[tagCategory];
    }
    this.audit(`controls.tags_${mode === 'add' ? 'added' : 'removed'}`, actor);
    return targets;
  }

  async listDataCollected() { return this.state.dataCollected; }
  async setDataCollected(items: DataCollectedItem[], heading: string | null | undefined, actor: string) {
    this.state.dataCollected = items;
    if (heading !== undefined) this.state.site.dataCollectedHeading = heading ?? '';
    this.audit('data_collected.replaced', actor);
    return items;
  }

  private publicSubscriber(subscriber: FakeSubscriber): SubscriberRecord {
    const { confirmTokenHash: _c, confirmExpiresAt: _e, unsubscribeToken: _u, ...record } = subscriber;
    return record;
  }

  async listSubscribers() { return this.subscribers.map((subscriber) => this.publicSubscriber(subscriber)); }
  async getSubscriber(id: string) {
    const subscriber = this.subscribers.find((entry) => entry.id === id);
    return subscriber ? this.publicSubscriber(subscriber) : null;
  }

  async createSubscriber(input: AdminSubscriberInput, confirmEmail: OutgoingEmail | null, actor: string) {
    const existing = this.subscribers.find((entry) => entry.email === input.email);
    if (existing?.status === 'active') throw new ConflictError('That address is already subscribed');
    const record: FakeSubscriber = {
      id: existing?.id ?? input.id,
      email: input.email,
      status: input.verified ? 'active' : 'pending',
      createdAt: existing?.createdAt ?? input.createdAt,
      confirmedAt: input.verified ? input.createdAt : null,
      confirmTokenHash: input.confirmTokenHash,
      confirmExpiresAt: input.confirmExpiresAt,
      unsubscribeToken: input.unsubscribeToken
    };
    if (existing) Object.assign(existing, record);
    else this.subscribers.push(record);
    if (confirmEmail) this.queueEmail(confirmEmail);
    this.audit('subscriber.added', actor);
    return this.publicSubscriber(record);
  }

  async deleteSubscriber(id: string, actor: string) {
    const index = this.subscribers.findIndex((entry) => entry.id === id);
    if (index < 0) throw new NotFoundError('Subscriber not found');
    this.subscribers.splice(index, 1);
    this.audit('subscriber.deleted', actor);
  }

  async listActiveSubscribers(): Promise<ActiveSubscriber[]> {
    return this.subscribers
      .filter((entry) => entry.status === 'active')
      .map((entry) => ({ id: entry.id, email: entry.email, unsubscribeToken: entry.unsubscribeToken }));
  }

  async requestSubscription(subscription: SubscriptionRequest, confirmEmail: OutgoingEmail, recentConfirmThreshold: string) {
    const existing = this.subscribers.find((entry) => entry.email === subscription.email);
    if (existing?.status === 'active') return 'active' as const;
    if (existing?.status === 'pending' && (existing.confirmExpiresAt ?? '') > recentConfirmThreshold) return 'throttled' as const;
    if (existing) {
      existing.status = 'pending';
      existing.confirmTokenHash = subscription.confirmTokenHash;
      existing.confirmExpiresAt = subscription.confirmExpiresAt;
      existing.unsubscribeToken = subscription.unsubscribeToken;
    } else {
      this.subscribers.push({
        id: `subscriber-${this.subscribers.length + 1}`,
        email: subscription.email,
        status: 'pending',
        createdAt: subscription.createdAt,
        confirmedAt: null,
        confirmTokenHash: subscription.confirmTokenHash,
        confirmExpiresAt: subscription.confirmExpiresAt,
        unsubscribeToken: subscription.unsubscribeToken
      });
      this.audit('subscriber.created', 'public');
    }
    this.queueEmail(confirmEmail);
    return 'pending' as const;
  }

  async confirmSubscription(confirmTokenHash: string, at: string) {
    const subscriber = this.subscribers.find((entry) => entry.confirmTokenHash === confirmTokenHash && entry.status === 'pending');
    if (!subscriber || !subscriber.confirmExpiresAt || subscriber.confirmExpiresAt < at) return false;
    subscriber.status = 'active';
    subscriber.confirmedAt = at;
    subscriber.confirmTokenHash = null;
    subscriber.confirmExpiresAt = null;
    this.audit('subscriber.confirmed', 'public');
    return true;
  }

  async unsubscribe(token: string) {
    const subscriber = this.subscribers.find((entry) => entry.unsubscribeToken === token);
    if (!subscriber) return false;
    if (subscriber.status !== 'unsubscribed') {
      subscriber.status = 'unsubscribed';
      this.audit('subscriber.unsubscribed', 'public');
    }
    return true;
  }

  async listAccessRequests() {
    return [...this.accessRequests].sort((a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending') || b.createdAt.localeCompare(a.createdAt));
  }
  async getAccessRequest(id: string) { return this.accessRequests.find((request) => request.id === id) ?? null; }
  async createAccessRequest(record: AccessRequestRecord, notification?: OutgoingEmail) {
    const existing = this.accessRequests.find((entry) => entry.email === record.email && entry.status === 'pending'
      && JSON.stringify(entry.requestedResources) === JSON.stringify(record.requestedResources));
    if (existing) return { id: existing.id, created: false };
    this.accessRequests.push(record);
    this.audit('access_request.created', 'public');
    if (notification) this.queueEmail(notification);
    return { id: record.id, created: true };
  }

  async retryEmail(id: string, actor: string) {
    const email = this.outbox.find((entry) => entry.id === id && entry.status === 'failed');
    if (!email) throw new NotFoundError('Only failed emails can be retried');
    email.status = 'pending';
    email.attempts = 0;
    delete email.lastError;
    this.audit('email.retried', actor);
  }

  private upsertViewer(viewer: ViewerRecord): ViewerRecord {
    const index = this.viewers.findIndex((entry) => entry.email === viewer.email);
    if (index >= 0) {
      this.viewers[index] = { ...viewer, id: this.viewers[index]!.id };
      return this.viewers[index]!;
    }
    this.viewers.push(viewer);
    return viewer;
  }

  async approveAccessRequest(id: string, viewer: ViewerRecord, email: OutgoingEmail, actor: string, at: string) {
    const request = this.accessRequests.find((entry) => entry.id === id);
    if (!request) throw new NotFoundError('Access request not found');
    if (request.status !== 'pending') throw new ConflictError('This access request has already been decided');
    request.status = 'approved';
    request.updatedAt = at;
    const saved = this.upsertViewer(viewer);
    this.queueEmail(email);
    this.audit('access_request.reviewed', actor, { id, status: 'approved' });
    this.audit('viewer.granted', actor);
    return saved;
  }

  async denyAccessRequest(id: string, reason: string | null, actor: string, at: string) {
    const request = this.accessRequests.find((entry) => entry.id === id);
    if (!request) throw new NotFoundError('Access request not found');
    if (request.status !== 'pending') throw new ConflictError('This access request has already been decided');
    request.status = 'denied';
    request.denialReason = reason;
    request.updatedAt = at;
    this.audit('access_request.reviewed', actor, { id, status: 'denied' });
  }

  async listViewers(includeRemoved: boolean) { return this.viewers.filter((viewer) => includeRemoved || !viewer.removedAt); }
  async getViewer(id: string) { return this.viewers.find((viewer) => viewer.id === id) ?? null; }
  async getViewerByEmail(email: string) { return this.viewers.find((viewer) => viewer.email === email) ?? null; }
  async getViewerByTokenHash(tokenHash: string) { return this.viewers.find((viewer) => viewer.tokenHash === tokenHash) ?? null; }
  async saveViewer(viewer: ViewerRecord, email: OutgoingEmail | null, actor: string, action: string) {
    const saved = this.upsertViewer(viewer);
    if (email) this.queueEmail(email);
    this.audit(action, actor);
    return saved;
  }
  async removeViewer(id: string, actor: string, at: string) {
    const viewer = this.viewers.find((entry) => entry.id === id);
    if (!viewer || viewer.removedAt) throw new NotFoundError('Viewer not found or already removed');
    viewer.removedAt = at;
    viewer.tokenHash = null;
    viewer.updatedAt = at;
    this.audit('viewer.removed', actor);
  }
  async acceptViewerNda(id: string, at: string) {
    const viewer = this.viewers.find((entry) => entry.id === id);
    if (viewer) {
      viewer.ndaAcceptedAt = viewer.ndaAcceptedAt ?? at;
      this.audit('viewer.nda_accepted', 'viewer');
    }
  }

  async listChatbotConversations(search: string | null) {
    return this.conversations.filter((conversation) => !search || conversation.firstMessage.includes(search) || (conversation.userEmail ?? '').includes(search));
  }
  async getChatbotConversation(id: string) {
    const conversation = this.conversations.find((entry) => entry.id === id);
    if (!conversation) return null;
    return { conversation, messages: this.messages.filter((message) => message.conversationId === id) };
  }
  async appendChatbotMessages(conversation: ChatbotConversation, messages: ChatbotMessage[]) {
    const index = this.conversations.findIndex((entry) => entry.id === conversation.id);
    if (index >= 0) this.conversations[index] = conversation;
    else this.conversations.unshift(conversation);
    this.messages.push(...messages);
  }

  async applyImport(bundle: ImportBundle, actor: string) {
    this.imported = bundle;
    const timestamp = new Date().toISOString();
    this.state.site = validateSite({ ...this.state.site, ...bundle.site }, timestamp);
    for (const kind of ['certifications', 'documents', 'faqs', 'subprocessors', 'updates'] as ResourceKind[]) {
      const imported = bundle[kind] as Array<Record<string, unknown>> | undefined;
      if (!imported) continue;
      (this.state[kind] as unknown[]) = imported.map((item) => ({
        ...normalizeResource(kind, item, uid(), timestamp),
        lifecycle: item.visible === false ? 'draft' : 'published',
        ...(kind === 'updates' ? { notifiedAt: null } : {})
      }));
    }
    this.audit('import.applied', actor);
  }

  async log(action: string, detail: Record<string, unknown> = {}, actor = 'admin') { this.audit(action, actor, detail); }

  async listSendableEmails(limit: number) {
    return this.outbox.filter((row) => row.status === 'pending' && row.attempts < 5).slice(0, limit);
  }
  async claimEmail(id: string, expectedAttempts: number) {
    const row = this.outbox.find((entry) => entry.id === id);
    if (!row || row.status !== 'pending' || row.attempts !== expectedAttempts) return false;
    row.status = 'sending';
    row.attempts += 1;
    return true;
  }
  async markEmailSent(id: string) {
    const row = this.outbox.find((entry) => entry.id === id);
    if (row) row.status = 'sent';
  }
  async markEmailFailed(id: string, error: string, exhausted: boolean) {
    const row = this.outbox.find((entry) => entry.id === id);
    if (row) { row.status = exhausted ? 'failed' : 'pending'; row.lastError = error; }
  }

  updates(): UpdateRecord[] { return this.state.updates; }
}

export function setup(overrides: Partial<AppServices> = {}) {
  const repository = new MemoryRepository();
  const documents = new MemoryDocuments();
  const emailSender = new FakeEmailSender();
  const clock = { now: new Date('2026-08-30T12:00:00.000Z') };
  let ids = 0;
  let tokens = 0;
  const services: AppServices = {
    repository,
    documents,
    adminToken: 'test-admin-token',
    emailSender,
    now: () => clock.now,
    randomId: () => `generated-id-${(ids += 1)}`,
    randomToken: () => `test-token-${(tokens += 1)}`,
    ...overrides
  };
  const handler = createHandler(services);
  return { handler, repository, documents, emailSender, services, clock };
}

export function jsonRequest(path: string, body: unknown, method = 'POST', headers: Record<string, string> = {}) {
  return new Request(`https://trust.example${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

export function adminRequest(path: string, body?: unknown, method = 'POST') {
  return new Request(`https://trust.example${path}`, {
    method,
    headers: { authorization: 'Bearer test-admin-token', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function pngBytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(TINY_PNG), (char) => char.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}
