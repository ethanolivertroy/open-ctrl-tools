import type {
  AccessRequestRecord,
  AdminState,
  Category,
  CategoryKind,
  ChatbotConversation,
  ChatbotMessage,
  ControlCategory,
  ControlRecord,
  DataCollectedItem,
  DocumentRecord,
  ImportBundle,
  LifecycleStatus,
  ResourceKind,
  SiteConfig,
  SubscriberRecord,
  TrustCenterState,
  Video,
  ViewerRecord
} from './domain';
import type { OutboxRepository, OutgoingEmail } from './email';

export interface ActiveSubscriber {
  id: string;
  email: string;
  unsubscribeToken: string | null;
}

export interface UpdateNotification {
  emails: OutgoingEmail[];
  notifiedAt: string;
  unsubscribeTokens: Array<{ id: string; token: string }>;
}

export interface SubscriptionRequest {
  email: string;
  confirmTokenHash: string;
  confirmExpiresAt: string;
  unsubscribeToken: string;
  createdAt: string;
}

export interface AdminSubscriberInput {
  id: string;
  email: string;
  verified: boolean;
  confirmTokenHash: string | null;
  confirmExpiresAt: string | null;
  unsubscribeToken: string;
  createdAt: string;
}

export interface AccessRequestCreation {
  id: string;
  created: boolean;
}

export type StoredDocumentReference = Pick<DocumentRecord, 'id' | 'title' | 'lifecycle' | 'visibility' | 'sourceType' | 'url' | 'objectKey' | 'fileName' | 'mimeType'>;

export interface Repository extends OutboxRepository {
  getPublicState(): Promise<TrustCenterState>;
  getAdminState(): Promise<AdminState>;
  getSiteConfig(): Promise<SiteConfig>;
  updateSite(site: SiteConfig, actor: string): Promise<void>;

  listResources(kind: ResourceKind): Promise<Record<string, unknown>[]>;
  createResource(kind: ResourceKind, value: Record<string, unknown>, actor: string): Promise<Record<string, unknown>>;
  updateResource(kind: ResourceKind, id: string, value: Record<string, unknown>, actor: string): Promise<Record<string, unknown>>;
  deleteResource(kind: ResourceKind, id: string, actor: string): Promise<void>;
  getResource(kind: ResourceKind, id: string): Promise<Record<string, unknown> | null>;
  setResourceLifecycle(kind: ResourceKind, id: string, lifecycle: LifecycleStatus, actor: string, notify?: UpdateNotification): Promise<number>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  setCertificationBadge(id: string, badgeObjectKey: string | null, actor: string): Promise<void>;

  setVideos(videos: Video[], actor: string): Promise<Video[]>;

  listCategories(kind: CategoryKind): Promise<Category[] | ControlCategory[]>;
  getCategory(kind: CategoryKind, id: string): Promise<Category | ControlCategory | null>;
  createCategory(kind: CategoryKind, category: Category | ControlCategory, actor: string): Promise<Category | ControlCategory>;
  updateCategory(kind: CategoryKind, id: string, patch: Partial<ControlCategory>, actor: string): Promise<Category | ControlCategory>;
  deleteCategory(kind: CategoryKind, id: string, actor: string): Promise<void>;
  reorderCategories(kind: CategoryKind, orderedIds: string[], actor: string): Promise<Category[] | ControlCategory[]>;

  listControls(): Promise<ControlRecord[]>;
  getControl(id: string): Promise<ControlRecord | null>;
  createControl(control: Omit<ControlRecord, 'memberships'>, categoryIds: string[], actor: string): Promise<ControlRecord>;
  updateControl(id: string, patch: Partial<Omit<ControlRecord, 'id' | 'memberships' | 'createdAt'>>, actor: string): Promise<ControlRecord>;
  deleteControl(id: string, actor: string): Promise<void>;
  setControlCategoryMembers(categoryId: string, add: string[], remove: string[], actor: string): Promise<ControlCategory>;
  reorderControlsInCategory(categoryId: string, orderedControlIds: string[], actor: string): Promise<ControlCategory>;
  tagControls(controlIds: string[], tagCategory: string, tags: string[], mode: 'add' | 'remove', actor: string): Promise<ControlRecord[]>;

  listDataCollected(): Promise<DataCollectedItem[]>;
  setDataCollected(items: DataCollectedItem[], heading: string | null | undefined, actor: string): Promise<DataCollectedItem[]>;

  listSubscribers(): Promise<SubscriberRecord[]>;
  getSubscriber(id: string): Promise<SubscriberRecord | null>;
  createSubscriber(input: AdminSubscriberInput, confirmEmail: OutgoingEmail | null, actor: string): Promise<SubscriberRecord>;
  deleteSubscriber(id: string, actor: string): Promise<void>;
  listActiveSubscribers(): Promise<ActiveSubscriber[]>;
  /**
   * `throttled` means a pending confirmation for this address expires later than
   * `recentConfirmThreshold`, so it was issued inside the resend cooldown and no
   * new email is queued. The caller still answers 202.
   */
  requestSubscription(subscription: SubscriptionRequest, confirmEmail: OutgoingEmail, recentConfirmThreshold: string): Promise<'pending' | 'active' | 'throttled'>;
  confirmSubscription(confirmTokenHash: string, at: string): Promise<boolean>;
  unsubscribe(unsubscribeToken: string, at: string): Promise<boolean>;
  /** Resets a `failed` outbox row so the next drain sends it again. */
  retryEmail(id: string, actor: string): Promise<void>;

  listAccessRequests(): Promise<AccessRequestRecord[]>;
  getAccessRequest(id: string): Promise<AccessRequestRecord | null>;
  /**
   * A pending request from the same email for the same resources is reused
   * instead of inserted again; `created` is false and no alert is queued.
   */
  createAccessRequest(record: AccessRequestRecord, notification?: OutgoingEmail): Promise<AccessRequestCreation>;
  approveAccessRequest(id: string, viewer: ViewerRecord, email: OutgoingEmail, actor: string, at: string): Promise<ViewerRecord>;
  denyAccessRequest(id: string, reason: string | null, actor: string, at: string): Promise<void>;

  listViewers(includeRemoved: boolean): Promise<ViewerRecord[]>;
  getViewer(id: string): Promise<ViewerRecord | null>;
  getViewerByEmail(email: string): Promise<ViewerRecord | null>;
  getViewerByTokenHash(tokenHash: string): Promise<ViewerRecord | null>;
  saveViewer(viewer: ViewerRecord, email: OutgoingEmail | null, actor: string, action: string): Promise<ViewerRecord>;
  removeViewer(id: string, actor: string, at: string): Promise<void>;
  acceptViewerNda(id: string, at: string): Promise<void>;

  listChatbotConversations(search: string | null): Promise<ChatbotConversation[]>;
  getChatbotConversation(id: string): Promise<{ conversation: ChatbotConversation; messages: ChatbotMessage[] } | null>;
  appendChatbotMessages(conversation: ChatbotConversation, messages: ChatbotMessage[]): Promise<void>;

  applyImport(bundle: ImportBundle, actor: string): Promise<void>;
  log(action: string, detail?: Record<string, unknown>, actor?: string): Promise<void>;
}
