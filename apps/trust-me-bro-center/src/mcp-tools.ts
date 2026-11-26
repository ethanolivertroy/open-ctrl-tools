import { cleanText } from './domain';
import * as svc from './services';
import type { ServiceContext } from './services';

export type ToolContext = ServiceContext;

export {
  ADMIN_SECTIONS,
  RESOURCE_KINDS,
  asToolError,
  bytesFromBase64,
  createRecord,
  deleteRecord,
  getAdminState,
  getPublicSnapshot,
  requireKind,
  resetDemoContent,
  setLifecycle,
  updateRecord,
  updateSite
} from './services';
export type { AdminSection } from './services';

export function isMcpPath(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

export function requireId(value: string): string {
  return cleanText(value, 'id', 80);
}

export async function uploadLogo(ctx: ToolContext, input: { bytesBase64: string; contentType: string }) {
  return svc.uploadBrandingAsset(ctx, 'logo', svc.bytesFromBase64(input.bytesBase64), input.contentType);
}

export async function removeLogo(ctx: ToolContext) {
  return svc.removeBrandingAsset(ctx, 'logo');
}

export async function uploadDocument(ctx: ToolContext, input: {
  title: string;
  description?: string;
  category?: string;
  categoryId?: string;
  visibility?: 'public' | 'request';
  version?: string;
  reviewAt?: string;
  bytesBase64: string;
  contentType: string;
  filename?: string;
}) {
  return svc.uploadDocument(ctx, {
    title: input.title,
    description: input.description,
    category: input.category,
    categoryId: input.categoryId ?? null,
    visibility: input.visibility,
    version: input.version,
    reviewAt: input.reviewAt ?? null,
    bytes: svc.bytesFromBase64(input.bytesBase64),
    contentType: input.contentType,
    filename: input.filename
  });
}

export async function decideAccessRequest(ctx: ToolContext, input: {
  id: string;
  status: 'approved' | 'denied';
  expirationDate?: string;
  isNdaRequired?: boolean;
  resourceIds?: string[];
  accessLevel?: 'FULL_ACCESS' | 'PARTIAL_ACCESS';
  reason?: string;
}) {
  if (input.status === 'denied') return svc.denyAccessRequest(ctx, input.id, { reason: input.reason });
  return svc.approveAccessRequest(ctx, input.id, {
    expirationDate: input.expirationDate,
    isNdaRequired: input.isNdaRequired,
    resourceIds: input.resourceIds,
    accessLevel: input.accessLevel
  });
}

export const TRUST_CENTER_GUIDE = `This MCP server manages the customer-facing trust center. Cursor and Grok Bot can fill out, edit, publish, and reset every public surface without using the admin UI. It covers the profile and theme, compliance frameworks with badges, control categories and controls, resource and FAQ categories, data-collected disclosures, videos, subscribers, access requests, viewers with expiring access links, and a chatbot grounded on published content.

Rules:
- New records start as drafts. Publish with set_lifecycle.
- Lifecycle: draft -> review -> published -> archived -> draft. Review can return to draft.
- Only published records appear on the public site, accept access requests, or notify subscribers.
- Updates email every confirmed subscriber once, the first time they are published.
- Approving an access request creates or updates a viewer and emails them a personal access link. Viewers can be FULL_ACCESS or PARTIAL_ACCESS to specific resource IDs, can expire, and can require a click-through NDA.
- Control categories can be PUBLIC or SHAREABLE (viewers only). Control status display follows controlVisibilityMode unless a category overrides it.
- Set isPublic=false on the profile to make the whole trust center private; only viewers with an access link can see content.
- Do not invent commercial certifications, customers, controls, or claims.
- Demonstration Northstar Labs content must stay labeled until real content replaces it.
- Prefer get_admin_state with a sections filter when you only need one list. The totals section carries full-table counts because the lists are capped.
- New access requests queue one alert email to the site security contact. A repeat while the first request is pending is absorbed silently.
- manage_subscriber with action=delete removes an address permanently. retry_email requeues an outbox row only when its status is failed.
- If content already lives in another trust center or compliance platform, read that system through its API, MCP, or an export you own. Then write records here. This server does not ingest vendor dumps.
- reset_demo_content requires confirm=true. Uploaded R2 documents are kept when you reset demonstration content.`;
