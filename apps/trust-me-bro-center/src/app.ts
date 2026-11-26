import {
  cleanText,
  ConflictError,
  ID_PATTERN,
  LOCAL_BANNER_PATH,
  LOCAL_FAVICON_PATH,
  LOCAL_LOGO_PATH,
  NotFoundError,
  normalizeEmail,
  ValidationError,
  type ResourceKind
} from './domain';
import { subscriptionConfirmEmail } from './email';
import { arrayResponse, json, noContent, pageFromUrl, parseJson } from './http';
import * as svc from './services';
import type { AdminIdentity, AppServices, ServiceContext } from './services';

export type { AdminIdentity, AppServices, DocumentStore, StoredDocument } from './services';
export type { ActiveSubscriber, Repository, SubscriptionRequest, UpdateNotification } from './repository';
export { RateLimitedError, clientIp, sha256Hex } from './services';
export type { PublicRateLimiter, TurnstileVerifier } from './services';

const PUBLIC_SITE_CACHE = 'public, max-age=30';
const RESOURCE_KINDS = new Set<ResourceKind>(['certifications', 'documents', 'faqs', 'subprocessors', 'updates']);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

async function tokensMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const providedDigest = await crypto.subtle.digest('SHA-256', encoder.encode(provided));
  const expectedDigest = await crypto.subtle.digest('SHA-256', encoder.encode(expected));
  const left = new Uint8Array(providedDigest);
  const right = new Uint8Array(expectedDigest);
  let different = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    different |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return different === 0;
}

async function isAdmin(request: Request, expected: string): Promise<boolean> {
  if (!expected) return false;
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return false;
  return tokensMatch(authorization.slice(7), expected);
}

export async function resolveAdmin(request: Request, services: AppServices): Promise<AdminIdentity | null> {
  if (services.authenticate) {
    const identity = await services.authenticate(request);
    if (identity) return identity;
  }
  return (await isAdmin(request, services.adminToken)) ? { actor: 'admin' } : null;
}

type Params = Record<string, string>;

function match(pattern: string, pathname: string): Params | null {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) return null;
  const params: Params = {};
  for (let index = 0; index < expected.length; index += 1) {
    const part = expected[index]!;
    const value = actual[index]!;
    if (part.startsWith(':')) {
      const name = part.slice(1);
      const pattern = name === 'token' ? TOKEN_PATTERN : ID_PATTERN;
      if (!pattern.test(value)) return null;
      params[name] = value;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function kindParam(value: string | undefined): ResourceKind {
  if (value && RESOURCE_KINDS.has(value as ResourceKind)) return value as ResourceKind;
  throw new NotFoundError('Not found.');
}

function formText(form: FormData, name: string, max: number, required = true): string {
  return cleanText(form.get(name), name, max, required);
}

async function formFile(request: Request): Promise<{ form: FormData; file: File }> {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('Choose a file to upload');
  return { form, file };
}

function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /access',
    'Disallow: /confirm',
    'Disallow: /unsubscribe',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    ''
  ].join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char);
}

function sitemapXml(origin: string, lastModified: string): string {
  const lastmod = /^\d{4}-\d{2}-\d{2}/.test(lastModified) ? `<lastmod>${escapeXml(lastModified.slice(0, 10))}</lastmod>` : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${escapeXml(origin)}/</loc>${lastmod}</url>`,
    '</urlset>',
    ''
  ].join('\n');
}

async function serveStoredImage(services: AppServices, objectKey: string | null, missing: string): Promise<Response> {
  if (!objectKey || !services.documents) return json({ error: missing }, 404);
  const stored = await services.documents.get(objectKey);
  if (!stored) return json({ error: missing }, 404);
  return new Response(stored.bytes as BodyInit, {
    status: 200,
    headers: {
      'content-type': stored.contentType,
      'cache-control': 'public, max-age=300',
      'content-security-policy': "default-src 'none'",
      'x-content-type-options': 'nosniff'
    }
  });
}

export function createHandler(services: AppServices): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    const ctx: ServiceContext = { services, actor: 'admin', origin: url.origin };

    try {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

      const publicResponse = await publicRoutes(request, url, ctx);
      if (publicResponse) return publicResponse;

      if (!pathname.startsWith('/api/admin/')) return json({ error: 'Not found.' }, 404);
      const admin = await resolveAdmin(request, services);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401, { 'www-authenticate': 'Bearer' });
      ctx.actor = admin.actor;

      const adminResponse = await adminRoutes(request, url, ctx);
      return adminResponse ?? json({ error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof NotFoundError) return json({ error: error.message }, 404);
      if (error instanceof svc.RateLimitedError) return json({ error: error.message }, 429, { 'retry-after': '60' });
      if (error instanceof ValidationError) return json({ error: error.message }, 400);
      if (error instanceof ConflictError) return json({ error: error.message }, 409);
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ requestId, error: error instanceof Error ? error.name : 'UnknownError' }));
      return json({ error: 'The request could not be completed.', requestId }, 500, { 'x-request-id': requestId });
    }
  };
}

async function publicRoutes(request: Request, url: URL, ctx: ServiceContext): Promise<Response | null> {
  const { pathname } = url;
  const method = request.method;
  const services = ctx.services;
  let params: Params | null;

  if (method === 'GET' && pathname === '/api/site') {
    return json(await svc.getPublicSnapshot(ctx), 200, { 'cache-control': PUBLIC_SITE_CACHE });
  }

  if (method === 'GET' && pathname === '/robots.txt') {
    return new Response(robotsTxt(svc.baseUrl(ctx)), {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' }
    });
  }

  if (method === 'GET' && pathname === '/sitemap.xml') {
    const site = await services.repository.getSiteConfig();
    return new Response(sitemapXml(svc.baseUrl(ctx), site.updatedAt), {
      status: 200,
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' }
    });
  }

  if (method === 'GET' && (pathname === LOCAL_LOGO_PATH || pathname === LOCAL_FAVICON_PATH || pathname === LOCAL_BANNER_PATH)) {
    const site = await services.repository.getSiteConfig();
    const key = pathname === LOCAL_LOGO_PATH ? site.logoObjectKey : pathname === LOCAL_FAVICON_PATH ? site.faviconObjectKey : site.bannerObjectKey;
    return serveStoredImage(services, key, 'No image is published.');
  }

  if (method === 'GET' && (params = match('/api/certifications/:id/badge', pathname))) {
    const framework = await services.repository.getResource('certifications', params.id!);
    if (!framework || framework.lifecycle !== 'published') return json({ error: 'No badge is published.' }, 404);
    return serveStoredImage(services, (framework.badgeObjectKey as string | null) ?? null, 'No badge is published.');
  }

  if (method === 'POST' && pathname === '/api/subscribe') {
    const body = await parseJson(request, 8 * 1024);
    const email = normalizeEmail(body.email);
    await svc.guardPublicForm(services, request, 'subscribe', body);
    const timestamp = svc.now(services);
    const origin = svc.baseUrl(ctx);
    const confirmToken = svc.nextToken(services);
    const unsubscribeToken = svc.nextToken(services);
    const site = await services.repository.getSiteConfig();
    // A pending confirmation younger than the cooldown is not re-sent, so one
    // address cannot be flooded by repeated subscribe calls.
    const recentConfirmThreshold = new Date(timestamp.getTime() + svc.CONFIRM_WINDOW_MS - svc.CONFIRM_RESEND_COOLDOWN_MS).toISOString();
    const outcome = await services.repository.requestSubscription({
      email,
      confirmTokenHash: await svc.sha256Hex(confirmToken),
      confirmExpiresAt: new Date(timestamp.getTime() + svc.CONFIRM_WINDOW_MS).toISOString(),
      unsubscribeToken,
      createdAt: timestamp.toISOString()
    }, subscriptionConfirmEmail({
      to: email,
      companyName: site.companyName,
      confirmUrl: `${origin}/confirm?token=${confirmToken}`,
      unsubscribeUrl: `${origin}/unsubscribe?token=${unsubscribeToken}`
    }), recentConfirmThreshold);
    if (outcome === 'pending') await svc.deliverQueuedEmail(services);
    return json({ ok: true, message: 'If this address is eligible, a confirmation email is on its way. Confirm it to start receiving updates.' }, 202);
  }

  if (method === 'POST' && pathname === '/api/subscribe/confirm') {
    const body = await parseJson(request, 8 * 1024);
    const token = typeof body.token === 'string' && TOKEN_PATTERN.test(body.token) ? body.token : null;
    const confirmed = token ? await services.repository.confirmSubscription(await svc.sha256Hex(token), svc.now(services).toISOString()) : false;
    if (!confirmed) return json({ error: 'This confirmation link is invalid or has expired. Subscribe again to receive a fresh email.' }, 400);
    return json({ ok: true, message: 'Subscription confirmed. You will receive trust center updates at this address.' });
  }

  if (method === 'POST' && pathname === '/api/unsubscribe') {
    const body = await parseJson(request, 8 * 1024);
    const token = typeof body.token === 'string' && TOKEN_PATTERN.test(body.token) ? body.token : null;
    const unsubscribed = token ? await services.repository.unsubscribe(token, svc.now(services).toISOString()) : false;
    if (!unsubscribed) return json({ error: 'This unsubscribe link is not valid.' }, 400);
    return json({ ok: true, message: 'You are unsubscribed from trust center updates.' });
  }

  if (method === 'POST' && pathname === '/api/access-requests') {
    const body = await parseJson(request, 16 * 1024);
    await svc.guardPublicForm(services, request, 'access-request', body);
    const result = await svc.submitAccessRequest({ ...ctx, actor: 'public' }, body);
    return json({ ok: true, message: result.message }, 202);
  }

  if (method === 'GET' && (params = match('/api/documents/:id', pathname))) {
    const site = await services.repository.getSiteConfig();
    if (!site.isPublic) return json({ error: 'This trust center is private.' }, 404);
    const document = await services.repository.getDocument(params.id!);
    if (!document || document.lifecycle !== 'published') return json({ error: 'Document not found.' }, 404);
    if (document.visibility === 'request') return json({ error: 'Request access to this document.', documentId: document.id }, 403);
    return svc.serveDocumentFile(document, services.documents);
  }

  if (pathname.startsWith('/api/viewer/')) {
    const viewerParams = match('/api/viewer/:token', pathname) ?? match('/api/viewer/:token/nda', pathname) ?? match('/api/viewer/:token/documents/:id', pathname);
    if (!viewerParams) return json({ error: 'This access link is not valid.' }, 404);
    const viewer = await svc.resolveViewer(ctx, viewerParams.token!);
    if (!viewer) return json({ error: 'This access link is invalid, expired, or has been revoked. Ask the security team for a new one.' }, 410);
    if (method === 'GET' && !viewerParams.id && !pathname.endsWith('/nda')) return json(await svc.viewerSnapshot(ctx, viewer));
    if (method === 'POST' && pathname.endsWith('/nda')) return json(await svc.acceptViewerNda(ctx, viewer));
    if (method === 'GET' && viewerParams.id) return svc.viewerDocument(ctx, viewer, viewerParams.id);
    return json({ error: 'Not found.' }, 404);
  }

  if (method === 'POST' && pathname === '/api/chat') {
    const body = await parseJson(request, 8 * 1024);
    return json(await svc.chat(ctx, body));
  }

  return null;
}

async function adminRoutes(request: Request, url: URL, ctx: ServiceContext): Promise<Response | null> {
  const { pathname } = url;
  const method = request.method;
  const services = ctx.services;
  let params: Params | null;

  if (method === 'GET' && pathname === '/api/admin/state') return json(await svc.getAdminState(ctx));

  if (method === 'GET' && pathname === '/api/admin/site') return json({ site: await services.repository.getSiteConfig() });
  if ((method === 'PUT' || method === 'PATCH') && pathname === '/api/admin/site') {
    return json(await svc.updateSite(ctx, await parseJson(request)));
  }

  for (const asset of ['logo', 'favicon', 'banner'] as const) {
    if (pathname !== `/api/admin/${asset}`) continue;
    if (method === 'DELETE') return json(await svc.removeBrandingAsset(ctx, asset));
    if (method === 'POST') {
      const { file } = await formFile(request);
      const bytes = new Uint8Array(await file.arrayBuffer());
      return json(await svc.uploadBrandingAsset(ctx, asset, bytes, file.type), 201);
    }
  }

  if (method === 'POST' && pathname === '/api/admin/documents/upload') {
    const { form, file } = await formFile(request);
    const result = await svc.uploadDocument(ctx, {
      title: formText(form, 'title', 160),
      description: formText(form, 'description', 800, false),
      category: formText(form, 'category', 80, false),
      categoryId: formText(form, 'categoryId', 80, false) || null,
      visibility: form.get('visibility') === 'request' || form.get('isPublic') === 'false' ? 'request' : 'public',
      version: formText(form, 'version', 40, false) || '1.0',
      reviewAt: formText(form, 'reviewAt', 32, false) || null,
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      filename: file.name
    });
    return json(result, 201);
  }

  if ((params = match('/api/admin/resources/:kind/:id/lifecycle', pathname)) && method === 'POST') {
    const body = await parseJson(request, 8 * 1024);
    return json(await svc.setLifecycle(ctx, kindParam(params.kind), params.id!, String(body.lifecycle)));
  }

  if ((params = match('/api/admin/resources/certifications/:id/badge', pathname))) {
    if (method === 'POST') {
      const { file } = await formFile(request);
      return json(await svc.uploadFrameworkBadge(ctx, params.id!, new Uint8Array(await file.arrayBuffer()), file.type));
    }
    if (method === 'DELETE') return json(await svc.removeFrameworkBadge(ctx, params.id!));
  }

  if ((params = match('/api/admin/resources/documents/:id/media', pathname)) && method === 'GET') {
    const document = await services.repository.getDocument(params.id!);
    if (!document) throw new NotFoundError('Document not found.');
    return svc.serveDocumentFile(document, services.documents);
  }

  if ((params = match('/api/admin/resources/:kind', pathname))) {
    const kind = kindParam(params.kind);
    if (method === 'GET') return json(arrayResponse(await svc.listRecords(ctx, kind)));
    if (method === 'POST') return json(await svc.createRecord(ctx, kind, await parseJson(request)), 201);
  }
  if ((params = match('/api/admin/resources/:kind/:id', pathname))) {
    const kind = kindParam(params.kind);
    if (method === 'GET') return json(await svc.getRecord(ctx, kind, params.id!));
    if (method === 'PUT' || method === 'PATCH') return json(await svc.updateRecord(ctx, kind, params.id!, await parseJson(request)));
    if (method === 'DELETE') {
      await svc.deleteRecord(ctx, kind, params.id!);
      return noContent();
    }
  }

  if (pathname === '/api/admin/videos') {
    if (method === 'GET') return json(arrayResponse((await services.repository.getPublicState()).videos.map(({ sortOrder: _o, ...video }) => video)));
    if (method === 'PUT') return json(await svc.setVideos(ctx, (await parseJson(request, 32 * 1024)).videos));
  }

  for (const [segment, kind] of [['resource-categories', 'resource'], ['faq-categories', 'faq'], ['control-categories', 'control']] as const) {
    const base = `/api/admin/${segment}`;
    if (pathname === base) {
      if (method === 'GET') return json(arrayResponse(await svc.listCategories(ctx, kind)));
      if (method === 'POST') return json(await svc.createCategory(ctx, kind, await parseJson(request, 8 * 1024)), 201);
    }
    if (pathname === `${base}/order` && method === 'PUT') {
      const body = await parseJson(request, 32 * 1024);
      return json(await svc.reorderCategories(ctx, kind, body.orderedCategoryIds ?? body.categoryIds));
    }
    if ((params = match(`${base}/:id`, pathname))) {
      if (method === 'GET') {
        const category = await services.repository.getCategory(kind, params.id!);
        if (!category) throw new NotFoundError('Category not found.');
        return json(category);
      }
      if (method === 'PATCH' || method === 'PUT') return json(await svc.updateCategory(ctx, kind, params.id!, await parseJson(request, 8 * 1024)));
      if (method === 'DELETE') {
        await svc.deleteCategory(ctx, kind, params.id!);
        return noContent();
      }
    }
    if (kind === 'control') {
      if ((params = match(`${base}/:id/controls`, pathname)) && method === 'PATCH') {
        return json(await svc.editControlsInCategory(ctx, params.id!, await parseJson(request, 32 * 1024)));
      }
      if ((params = match(`${base}/:id/controls/order`, pathname)) && method === 'PUT') {
        return json(await svc.reorderControlsInCategory(ctx, params.id!, (await parseJson(request, 32 * 1024)).orderedControlIds));
      }
    }
  }

  if (pathname === '/api/admin/controls') {
    if (method === 'GET') return json(pageFromUrl(await svc.listControls(ctx), url));
    if (method === 'POST') return json(await svc.createControl(ctx, await parseJson(request, 16 * 1024)), 201);
  }
  if (pathname === '/api/admin/controls/tags') {
    if (method === 'POST') return json(await svc.tagControls(ctx, await parseJson(request, 32 * 1024), 'add'));
    if (method === 'DELETE') return json(await svc.tagControls(ctx, await parseJson(request, 32 * 1024), 'remove'));
  }
  if ((params = match('/api/admin/controls/:id', pathname))) {
    if (method === 'GET') return json(await svc.getControl(ctx, params.id!));
    if (method === 'PATCH' || method === 'PUT') return json(await svc.updateControl(ctx, params.id!, await parseJson(request, 16 * 1024)));
    if (method === 'DELETE') {
      await svc.deleteControl(ctx, params.id!);
      return noContent();
    }
  }

  if (pathname === '/api/admin/data-collected') {
    if (method === 'GET') return json(await svc.listDataCollected(ctx));
    if (method === 'PUT') return json(await svc.setDataCollected(ctx, await parseJson(request, 64 * 1024)));
  }

  if (pathname === '/api/admin/subscribers') {
    if (method === 'GET') return json(pageFromUrl(await svc.listSubscribers(ctx), url));
    if (method === 'POST') return json(await svc.createSubscriber(ctx, await parseJson(request, 8 * 1024)), 201);
  }
  if (method === 'GET' && pathname === '/api/admin/subscribers/export') {
    const exported = await svc.exportSubscribersCsv(ctx);
    return new Response(exported.body, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${exported.filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
  if ((params = match('/api/admin/emails/:id/retry', pathname)) && method === 'POST') {
    return json(await svc.retryEmail(ctx, params.id!));
  }
  if ((params = match('/api/admin/subscribers/:id', pathname))) {
    if (method === 'GET') return json(await svc.getSubscriber(ctx, params.id!));
    if (method === 'DELETE') {
      await svc.deleteSubscriber(ctx, params.id!);
      return noContent();
    }
  }
  if (method === 'GET' && pathname === '/api/admin/access-requests') return json(pageFromUrl(await svc.listAccessRequests(ctx), url));
  if ((params = match('/api/admin/access-requests/:id', pathname)) && method === 'GET') return json(await svc.getAccessRequest(ctx, params.id!));
  if ((params = match('/api/admin/access-requests/:id/approve', pathname)) && method === 'POST') {
    return json(await svc.approveAccessRequest(ctx, params.id!, await parseJson(request, 16 * 1024, true)));
  }
  if ((params = match('/api/admin/access-requests/:id/deny', pathname)) && method === 'POST') {
    return json(await svc.denyAccessRequest(ctx, params.id!, await parseJson(request, 8 * 1024, true)));
  }

  if (pathname === '/api/admin/viewers') {
    if (method === 'GET') return json(pageFromUrl(await svc.listViewers(ctx, url.searchParams.get('includeRemoved') === 'true'), url));
    if (method === 'POST') return json(await svc.addViewer(ctx, await parseJson(request, 16 * 1024)), 201);
  }
  if ((params = match('/api/admin/viewers/:id', pathname))) {
    if (method === 'GET') return json(await svc.getViewer(ctx, params.id!));
    if (method === 'PATCH' || method === 'PUT') return json(await svc.updateViewer(ctx, params.id!, await parseJson(request, 16 * 1024)));
    if (method === 'DELETE') {
      await svc.removeViewer(ctx, params.id!);
      return noContent();
    }
  }
  if (method === 'GET' && pathname === '/api/admin/chatbot/conversations') {
    return json(pageFromUrl(await svc.listChatbotConversations(ctx, url.searchParams.get('searchString')), url));
  }
  if ((params = match('/api/admin/chatbot/conversations/:id', pathname)) && method === 'GET') {
    return json(await svc.getChatbotConversation(ctx, params.id!));
  }

  if (method === 'POST' && pathname === '/api/admin/reset') {
    const body = await parseJson(request, 8 * 1024);
    return json(await svc.resetDemoContent(ctx, body.confirm === true));
  }

  return null;
}
