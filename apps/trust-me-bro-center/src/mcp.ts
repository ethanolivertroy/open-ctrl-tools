import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  BANNER_SETTINGS,
  CONTROL_CATEGORY_VISIBILITIES,
  CONTROL_STATUSES,
  CONTROL_VISIBILITY_MODES,
  DATA_COLLECTED_STATUSES,
  FRAMEWORK_STANDARDS,
  UPDATE_CATEGORIES,
  UPDATE_VISIBILITY_TYPES,
  VIEWER_ACCESS_LEVELS
} from './domain';
import {
  ADMIN_SECTIONS,
  asToolError,
  createRecord,
  decideAccessRequest,
  deleteRecord,
  getAdminState,
  getPublicSnapshot,
  removeLogo,
  requireId,
  requireKind,
  resetDemoContent,
  setLifecycle,
  TRUST_CENTER_GUIDE,
  updateRecord,
  updateSite,
  uploadDocument,
  uploadLogo,
  type ToolContext
} from './mcp-tools';
import * as svc from './services';
import { createWorkerServices, type WorkerEnv } from './worker-services';

type McpProps = {
  actor?: string;
  origin?: string;
};

function mcpText(result: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
  };
}

function mcpResult(result: unknown) {
  if (result && typeof result === 'object' && 'error' in result) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      isError: true as const
    };
  }
  return mcpText(result);
}

const kindField = z.enum(['certifications', 'documents', 'faqs', 'subprocessors', 'updates'])
  .describe('Trust-center record type');

const fieldsField = z.record(z.string(), z.unknown())
  .describe('Record fields for that kind. Lifecycle is not set here.');

const categoryKindField = z.enum(['resource', 'faq', 'control']).describe('Which category list: resource (documents), faq, or control');
const imageTypeField = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export class TrustCenterMCP extends McpAgent<WorkerEnv, unknown, McpProps> {
  server = new McpServer(
    { name: 'trust-me-bro-center', version: '0.2.0' },
    { instructions: TRUST_CENTER_GUIDE }
  );

  private context(): ToolContext {
    return {
      services: createWorkerServices(this.env),
      actor: this.props?.actor ?? 'admin',
      origin: this.props?.origin ?? this.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:8787'
    };
  }

  async init() {
    const run = async (work: (ctx: ToolContext) => Promise<unknown>) => {
      try {
        return mcpResult(await work(this.context()));
      } catch (error) {
        return mcpResult(asToolError(error));
      }
    };

    this.server.tool('trust_center_guide', 'Read the publishing rules, lifecycle, and how Cursor or Grok Bot should edit this trust center.', {}, async () => mcpText({ guide: TRUST_CENTER_GUIDE }));

    this.server.tool('get_public_snapshot', 'What visitors currently see: profile, theme, frameworks, resources, FAQ, controls, data collected, subprocessors, videos, and updates.', {}, async () => run((ctx) => getPublicSnapshot(ctx)));

    this.server.tool(
      'get_admin_state',
      'Full admin workspace, including drafts, requests, viewers, subscribers, chatbot conversations, outbox, and audit. Filter with sections to keep the payload small.',
      { sections: z.array(z.enum(ADMIN_SECTIONS)).optional().describe('Optional lists to return. Omit for everything.') },
      async ({ sections }) => run((ctx) => getAdminState(ctx, sections))
    );

    this.server.tool(
      'update_site',
      'Update the trust center profile and theme. Omitted fields stay as they are. Fields: companyName, title, headline, summary, securityEmail, location, privacyPolicyUrl, isPublic, bannerSetting, accent, secondaryColor, controlVisibilityMode, dataCollectedHeading.',
      {
        companyName: z.string().optional(),
        title: z.string().optional(),
        headline: z.string().optional(),
        summary: z.string().optional(),
        securityEmail: z.string().optional(),
        location: z.string().optional(),
        accent: z.string().optional().describe('Primary theme color, six-digit hex'),
        secondaryColor: z.string().optional().describe('Secondary theme color, six-digit hex, or empty to reset'),
        logoUrl: z.string().optional(),
        privacyPolicyUrl: z.string().optional(),
        isPublic: z.boolean().optional(),
        bannerSetting: z.enum(BANNER_SETTINGS).optional(),
        bannerStartColor: z.string().optional(),
        bannerEndColor: z.string().optional(),
        controlVisibilityMode: z.enum(CONTROL_VISIBILITY_MODES).optional(),
        dataCollectedHeading: z.string().optional()
      },
      async (patch) => run((ctx) => updateSite(ctx, patch))
    );

    this.server.tool('upload_logo', 'Replace the header mark with a company logo. PNG, JPEG, WebP, or SVG up to 1 MB.', { bytesBase64: z.string(), contentType: imageTypeField }, async (input) => run((ctx) => uploadLogo(ctx, input)));
    this.server.tool('remove_logo', 'Remove the uploaded company logo and restore the default mark.', {}, async () => run((ctx) => removeLogo(ctx)));
    this.server.tool('upload_favicon', 'Upload the browser favicon. PNG, SVG, WebP, JPEG, or ICO up to 256 KB.', { bytesBase64: z.string(), contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']) }, async (input) => run((ctx) => svc.uploadBrandingAsset(ctx, 'favicon', svc.bytesFromBase64(input.bytesBase64), input.contentType)));
    this.server.tool('upload_banner_image', 'Upload a custom banner image and switch bannerSetting to CUSTOM_IMAGE. PNG, JPEG, or WebP up to 4 MB.', { bytesBase64: z.string(), contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']) }, async (input) => run((ctx) => svc.uploadBrandingAsset(ctx, 'banner', svc.bytesFromBase64(input.bytesBase64), input.contentType)));
    this.server.tool('remove_branding_asset', 'Remove the uploaded favicon or banner image.', { asset: z.enum(['favicon', 'banner']) }, async ({ asset }) => run((ctx) => svc.removeBrandingAsset(ctx, asset)));

    this.server.tool(
      'list_records',
      'List every record of one kind, including drafts. Use get_admin_state for several lists at once.',
      { kind: kindField },
      async ({ kind }) => run((ctx) => svc.listRecords(ctx, requireKind(kind)))
    );

    this.server.tool(
      'create_record',
      `Create a draft record. certifications: name, status, description, standard (${FRAMEWORK_STANDARDS.slice(0, 6).join(', ')}, ...), sortOrder. documents: title, description, categoryId or category, visibility, url or upload_document. faqs: question, answer, categoryId, sortOrder. subprocessors: name, description, purpose, location, url, sortOrder. updates: title, body, category (${UPDATE_CATEGORIES.join('/')}), visibilityType (${UPDATE_VISIBILITY_TYPES.join('/')}), publishedAt.`,
      { kind: kindField, fields: fieldsField },
      async ({ kind, fields }) => run((ctx) => createRecord(ctx, requireKind(kind), fields))
    );

    this.server.tool('update_record', 'Edit an existing record. Omitted fields keep their current value. Does not change lifecycle.', { kind: kindField, id: z.string(), fields: fieldsField }, async ({ kind, id, fields }) => run((ctx) => updateRecord(ctx, requireKind(kind), requireId(id), fields)));
    this.server.tool('delete_record', 'Delete a record. For uploaded documents this also removes the R2 object; for frameworks it removes the badge.', { kind: kindField, id: z.string() }, async ({ kind, id }) => run((ctx) => deleteRecord(ctx, requireKind(kind), requireId(id))));

    this.server.tool(
      'set_lifecycle',
      'Move a record through draft, review, published, or archived. Publishing an update emails every confirmed subscriber once.',
      { kind: kindField, id: z.string(), lifecycle: z.enum(['draft', 'review', 'published', 'archived']) },
      async ({ kind, id, lifecycle }) => run((ctx) => setLifecycle(ctx, requireKind(kind), requireId(id), lifecycle))
    );

    this.server.tool(
      'upload_document',
      'Upload a PDF, Markdown, or plain-text document as a draft. Publish it with set_lifecycle afterward.',
      {
        title: z.string(),
        description: z.string().optional(),
        category: z.string().optional().describe('Legacy category label; prefer categoryId'),
        categoryId: z.string().optional().describe('Resource category id from list_categories'),
        visibility: z.enum(['public', 'request']).optional(),
        version: z.string().optional(),
        reviewAt: z.string().optional(),
        bytesBase64: z.string(),
        contentType: z.enum(['application/pdf', 'text/plain', 'text/markdown']),
        filename: z.string().optional()
      },
      async (input) => run((ctx) => uploadDocument(ctx, input))
    );

    this.server.tool(
      'upload_framework_badge',
      'Upload a badge image for a compliance framework (certifications record). PNG, JPEG, WebP, or SVG up to 512 KB.',
      { id: z.string(), bytesBase64: z.string(), contentType: imageTypeField },
      async ({ id, bytesBase64, contentType }) => run((ctx) => svc.uploadFrameworkBadge(ctx, requireId(id), svc.bytesFromBase64(bytesBase64), contentType))
    );

    this.server.tool('set_videos', 'Replace the videos shown on the Media tab. Each video needs a public HTTPS url and title.', {
      videos: z.array(z.object({ url: z.string(), title: z.string(), description: z.string().optional() })).max(50)
    }, async ({ videos }) => run((ctx) => svc.setVideos(ctx, videos)));

    this.server.tool('list_categories', 'List resource, FAQ, or control categories in display order.', { kind: categoryKindField }, async ({ kind }) => run((ctx) => svc.listCategories(ctx, svc.categoryKind(kind))));
    this.server.tool(
      'manage_category',
      'Create, update, delete, or reorder a resource, FAQ, or control category. Deleting a resource or FAQ category uncategorizes its items; deleting a control category deletes its controls. reorder needs the complete list of ids.',
      {
        kind: categoryKindField,
        action: z.enum(['create', 'update', 'delete', 'reorder']),
        id: z.string().optional(),
        name: z.string().optional(),
        visibility: z.enum(CONTROL_CATEGORY_VISIBILITIES).optional().describe('Control categories only'),
        statusVisibilityOverride: z.enum(CONTROL_VISIBILITY_MODES).nullable().optional().describe('Control categories only; null clears the override'),
        orderedIds: z.array(z.string()).optional()
      },
      async (input) => run(async (ctx) => {
        const kind = svc.categoryKind(input.kind);
        if (input.action === 'create') return svc.createCategory(ctx, kind, input);
        if (input.action === 'reorder') return svc.reorderCategories(ctx, kind, input.orderedIds);
        const id = requireId(input.id ?? '');
        if (input.action === 'update') {
          const patch: Record<string, unknown> = {};
          if (input.name !== undefined) patch.name = input.name;
          if (input.visibility !== undefined) patch.visibility = input.visibility;
          if (input.statusVisibilityOverride !== undefined) patch.statusVisibilityOverride = input.statusVisibilityOverride;
          return svc.updateCategory(ctx, kind, id, patch);
        }
        return svc.deleteCategory(ctx, kind, id);
      })
    );

    this.server.tool('list_controls', 'List controls with their categories, status, and tags.', {}, async () => run((ctx) => svc.listControls(ctx)));
    this.server.tool(
      'manage_control',
      'Create, update, or delete a control; add or remove controls in a category; reorder controls in a category; bulk add or remove tags.',
      {
        action: z.enum(['create', 'update', 'delete', 'set_category_members', 'reorder_in_category', 'add_tags', 'remove_tags']),
        id: z.string().optional().describe('Control id for update or delete'),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(CONTROL_STATUSES).optional(),
        externalId: z.string().optional().describe('Identifier from the compliance platform, if any'),
        tags: z.record(z.string(), z.array(z.string())).optional().describe('Full tag map for create or update'),
        categoryIds: z.array(z.string()).optional().describe('Categories for create (at least one)'),
        categoryId: z.string().optional().describe('Category for set_category_members or reorder_in_category'),
        controlsToAdd: z.array(z.string()).optional(),
        controlsToRemove: z.array(z.string()).optional(),
        orderedControlIds: z.array(z.string()).optional(),
        controlIds: z.array(z.string()).optional().describe('Controls for add_tags or remove_tags (max 100)'),
        tagCategory: z.string().optional(),
        tagValues: z.array(z.string()).optional()
      },
      async (input) => run(async (ctx) => {
        switch (input.action) {
          case 'create': return svc.createControl(ctx, input);
          case 'update': return svc.updateControl(ctx, requireId(input.id ?? ''), input);
          case 'delete': return svc.deleteControl(ctx, requireId(input.id ?? ''));
          case 'set_category_members': return svc.editControlsInCategory(ctx, requireId(input.categoryId ?? ''), { controlsToAdd: input.controlsToAdd ?? [], controlsToRemove: input.controlsToRemove ?? [] });
          case 'reorder_in_category': return svc.reorderControlsInCategory(ctx, requireId(input.categoryId ?? ''), input.orderedControlIds);
          case 'add_tags': return svc.tagControls(ctx, { controlIds: input.controlIds, tagCategory: input.tagCategory, tags: input.tagValues }, 'add');
          case 'remove_tags': return svc.tagControls(ctx, { controlIds: input.controlIds, tagCategory: input.tagCategory, tags: input.tagValues }, 'remove');
        }
      })
    );

    this.server.tool('get_data_collected', 'List the data-collected disclosures and heading.', {}, async () => run((ctx) => svc.listDataCollected(ctx)));
    this.server.tool(
      'set_data_collected',
      'Replace all data-collected disclosures. This is a full replacement. HIDDEN entries stay in admin but never render publicly.',
      {
        dataCollected: z.array(z.object({ dataCollected: z.string(), status: z.enum(DATA_COLLECTED_STATUSES) })).max(200),
        dataCollectedHeading: z.string().nullable().optional()
      },
      async (input) => run((ctx) => svc.setDataCollected(ctx, input))
    );

    this.server.tool('list_subscribers', 'List subscribers with verification state.', {}, async () => run((ctx) => svc.listSubscribers(ctx)));
    this.server.tool(
      'manage_subscriber',
      'Add a subscriber (optionally already verified) or delete one.',
      {
        action: z.enum(['create', 'delete']),
        id: z.string().optional(),
        email: z.string().optional(),
        shouldSkipEmailVerification: z.boolean().optional()
      },
      async (input) => run(async (ctx) => {
        if (input.action === 'create') return svc.createSubscriber(ctx, input);
        return svc.deleteSubscriber(ctx, requireId(input.id ?? ''));
      })
    );

    this.server.tool('list_access_requests', 'List access requests. Pending requests come first, then approved and denied ones.', {}, async () => run((ctx) => svc.listAccessRequests(ctx)));
    this.server.tool(
      'decide_access_request',
      'Approve or deny an access request. Approval creates or updates a viewer and emails a personal access link. Optional expirationDate (ISO), isNdaRequired, resourceIds, accessLevel. Denials can carry a reason.',
      {
        id: z.string(),
        status: z.enum(['approved', 'denied']),
        expirationDate: z.string().optional(),
        isNdaRequired: z.boolean().optional(),
        resourceIds: z.array(z.string()).optional(),
        accessLevel: z.enum(VIEWER_ACCESS_LEVELS).optional(),
        reason: z.string().optional()
      },
      async (input) => run((ctx) => decideAccessRequest(ctx, input))
    );

    this.server.tool('list_viewers', 'List viewers who hold access links. includeRemoved shows revoked viewers too.', { includeRemoved: z.boolean().optional() }, async ({ includeRemoved }) => run((ctx) => svc.listViewers(ctx, includeRemoved ?? false)));
    this.server.tool(
      'manage_viewer',
      'Add a viewer and email them an access link, update their access, or remove (revoke) them.',
      {
        action: z.enum(['add', 'update', 'remove']),
        id: z.string().optional(),
        email: z.string().optional(),
        name: z.string().optional(),
        companyName: z.string().optional(),
        accessLevel: z.enum(VIEWER_ACCESS_LEVELS).optional(),
        resourceIds: z.array(z.string()).optional(),
        expirationDate: z.string().nullable().optional(),
        isNdaRequired: z.boolean().optional()
      },
      async (input) => run(async (ctx) => {
        if (input.action === 'add') return svc.addViewer(ctx, input);
        const id = requireId(input.id ?? '');
        if (input.action === 'update') {
          const patch: Record<string, unknown> = {};
          for (const key of ['name', 'companyName', 'accessLevel', 'resourceIds', 'isNdaRequired'] as const) if (input[key] !== undefined) patch[key] = input[key];
          if (input.expirationDate !== undefined) patch.expirationDate = input.expirationDate;
          return svc.updateViewer(ctx, id, patch);
        }
        return svc.removeViewer(ctx, id);
      })
    );

    this.server.tool(
      'retry_email',
      'Requeue an outbox email that exhausted its send attempts. Only failed emails can be retried.',
      { id: z.string() },
      async ({ id }) => run((ctx) => svc.retryEmail(ctx, requireId(id)))
    );

    this.server.tool('list_chatbot_conversations', 'List visitor chatbot conversations, optionally filtered by search string.', { searchString: z.string().optional() }, async ({ searchString }) => run((ctx) => svc.listChatbotConversations(ctx, searchString ?? null)));
    this.server.tool('get_chatbot_conversation', 'Read the messages of one chatbot conversation.', { id: z.string() }, async ({ id }) => run((ctx) => svc.getChatbotConversation(ctx, requireId(id))));

    this.server.tool('reset_demo_content', 'Restore the Northstar Labs demonstration records. Requires confirm=true. Uploaded R2 documents are kept.', { confirm: z.boolean() }, async ({ confirm }) => run((ctx) => resetDemoContent(ctx, confirm)));
  }
}
