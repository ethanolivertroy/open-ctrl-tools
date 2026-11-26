import { describe, expect, it, vi } from 'vitest';
import { createHandler, sha256Hex } from '../src/app';
import { NotFoundError } from '../src/domain';
import { adminRequest, FakeEmailSender, jsonRequest, MemoryRepository, pngBytes, setup, type FakeSubscriber } from './support/memory-repository';

const SITE = {
  companyName: 'Acme Security',
  headline: 'Trust, without the suite.',
  summary: 'A focused trust center.',
  securityEmail: 'security@acme.example',
  location: 'United States',
  accent: '#8a4d2f'
};

function logoUpload(): FormData {
  const form = new FormData();
  form.set('file', new File([pngBytes()], 'logo.png', { type: 'image/png' }));
  return form;
}

function subscriber(overrides: Partial<FakeSubscriber>): FakeSubscriber {
  return {
    id: 'sub', email: 'sub@example.com', status: 'active', confirmTokenHash: null, confirmedAt: null,
    confirmExpiresAt: null, unsubscribeToken: null, createdAt: '2026-08-01T00:00:00.000Z', ...overrides
  };
}

describe('trust center API', () => {
  it('serves a public snapshot without authentication', async () => {
    const { handler } = setup();
    const response = await handler(new Request('https://trust.example/api/site'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    const body = await response.json() as { site: Record<string, unknown>; controlCategories: unknown[]; dataCollected: { items: unknown[] } };
    expect(body).toMatchObject({ site: { companyName: 'Northstar Labs', isPublic: true } });
    expect(body.site).not.toHaveProperty('logoObjectKey');
    expect(body.site).not.toHaveProperty('faviconObjectKey');
    expect(body.controlCategories).toEqual([]);
    expect(body.dataCollected.items).toEqual([]);
  });

  it('rejects unauthenticated admin requests', async () => {
    const { handler } = setup();
    expect((await handler(new Request('https://trust.example/api/admin/state'))).status).toBe(401);
  });

  it('attributes admin mutations to the verified Access identity when present', async () => {
    const repository = new MemoryRepository();
    const handler = createHandler({
      repository,
      adminToken: 'test-admin-token',
      authenticate: async (request) =>
        request.headers.get('cf-access-jwt-assertion') === 'stub-assertion' ? { actor: 'casey@example.com' } : null,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
      randomId: () => 'generated-id'
    });
    const site = JSON.stringify(SITE);

    expect((await handler(new Request('https://trust.example/api/admin/state'))).status).toBe(401);

    const viaAccess = await handler(new Request('https://trust.example/api/admin/site', {
      method: 'PUT', headers: { 'cf-access-jwt-assertion': 'stub-assertion', 'content-type': 'application/json' }, body: site
    }));
    expect(viaAccess.status).toBe(200);
    expect(repository.actors).toEqual(['casey@example.com']);

    const state = await handler(new Request('https://trust.example/api/admin/state', { headers: { 'cf-access-jwt-assertion': 'stub-assertion' } }));
    expect(await state.json()).toMatchObject({ actor: 'casey@example.com' });

    const viaToken = await handler(new Request('https://trust.example/api/admin/site', {
      method: 'PUT', headers: { authorization: 'Bearer test-admin-token', 'content-type': 'application/json' }, body: site
    }));
    expect(viaToken.status).toBe(200);
    expect(repository.actors).toEqual(['casey@example.com', 'admin']);
  });

  it('returns a request ID without exposing unexpected backend errors', async () => {
    const { handler, repository } = setup();
    repository.getPublicState = async () => { throw new Error('D1 internal table detail'); };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await handler(new Request('https://trust.example/api/site'));
    const body = await response.json() as { error: string; requestId: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('The request could not be completed.');
    expect(body.requestId).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain('D1 internal');
    consoleSpy.mockRestore();
  });

  it('allows an authenticated admin to update the site', async () => {
    const { handler, repository } = setup();
    const response = await handler(adminRequest('/api/admin/site', SITE, 'PUT'));

    expect(response.status).toBe(200);
    expect(repository.state.site.companyName).toBe('Acme Security');
    expect(repository.audits).toContain('site.updated');
  });

  it('stores subscriptions as pending with a hashed confirmation token and a confirmation email', async () => {
    const { handler, repository, emailSender, clock } = setup();
    const request = () => jsonRequest('/api/subscribe', { email: ' Person@Example.COM ' });

    const first = await handler(request());
    const duplicate = await handler(request());
    expect(first.status).toBe(202);
    expect(duplicate.status).toBe(202);
    expect(await first.json()).toEqual(await duplicate.json());
    expect(repository.subscribers).toHaveLength(1);
    expect(repository.subscribers[0]).toMatchObject({ email: 'person@example.com', status: 'pending' });
    // The repeat inside the cooldown is throttled: the original token stays valid and no second email goes out.
    expect(repository.subscribers[0]?.confirmTokenHash).toBe(await sha256Hex('test-token-1'));
    expect(repository.audits.filter((action) => action === 'subscriber.created')).toHaveLength(1);

    let confirmations = emailSender.sent.filter((email) => email.template === 'subscription-confirm');
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]?.to).toBe('person@example.com');
    expect(confirmations[0]?.bodyText).toContain('https://trust.example/confirm?token=test-token-1');
    expect(confirmations[0]?.bodyText).toContain('https://trust.example/unsubscribe?token=test-token-2');
    expect(confirmations[0]?.headers?.['List-Unsubscribe']).toBe('<https://trust.example/unsubscribe?token=test-token-2>');

    // Once the cooldown has passed the confirmation is re-issued with a fresh token.
    clock.now = new Date('2026-08-30T12:11:00.000Z');
    expect((await handler(request())).status).toBe(202);
    confirmations = emailSender.sent.filter((email) => email.template === 'subscription-confirm');
    expect(confirmations).toHaveLength(2);
    expect(repository.subscribers[0]?.confirmTokenHash).toBe(await sha256Hex('test-token-5'));
  });

  it('rate limits public forms per client and rejects missing Turnstile tokens when configured', async () => {
    const seen: string[] = [];
    const verified: Array<[string, string | null]> = [];
    const { handler, repository, emailSender } = setup({
      rateLimiter: { allow: async (key) => { seen.push(key); return seen.filter((entry) => entry === key).length <= 2; } },
      verifyTurnstile: async (token, ip) => { verified.push([token, ip]); return token === 'good-token'; },
      turnstileSiteKey: '1x00000000000000000000AA'
    });
    const post = (path: string, body: Record<string, unknown>, ip = '203.0.113.9') => handler(jsonRequest(path, body, 'POST', { 'cf-connecting-ip': ip }));

    const site = await handler(new Request('https://trust.example/api/site'));
    expect(await site.json()).toMatchObject({ protection: { turnstileSiteKey: '1x00000000000000000000AA' } });
    expect(site.headers.get('cache-control')).toBe('public, max-age=30');

    const missing = await post('/api/subscribe', { email: 'person@example.com' });
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: string }).error).toContain('verification challenge');

    const bad = await post('/api/subscribe', { email: 'person@example.com', turnstileToken: 'bad-token' });
    expect(bad.status).toBe(400);
    expect(verified).toEqual([['bad-token', '203.0.113.9']]);
    expect(repository.subscribers).toHaveLength(0);
    expect(emailSender.sent).toHaveLength(0);

    // Third request from the same network is over budget, regardless of its token.
    const limited = await post('/api/subscribe', { email: 'person@example.com', turnstileToken: 'good-token' });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(seen).toEqual(['subscribe:203.0.113.9', 'subscribe:203.0.113.9', 'subscribe:203.0.113.9']);

    // A different network with a valid token gets through, and access requests use their own bucket.
    const ok = await post('/api/subscribe', { email: 'person@example.com', turnstileToken: 'good-token' }, '198.51.100.4');
    expect(ok.status).toBe(202);
    expect(repository.subscribers).toHaveLength(1);
    const request = await post('/api/access-requests', { documentId: 'gated', name: 'Sam', email: 'sam@example.com', company: 'Acme', turnstileToken: 'good-token' }, '203.0.113.9');
    expect(request.status).toBe(202);
    expect(seen.at(-1)).toBe('access-request:203.0.113.9');
  });

  it('serves robots.txt and a sitemap that point at the public origin', async () => {
    const { handler } = setup({ baseUrl: 'https://trust.example.com/' });
    const robots = await handler(new Request('https://trust.example/robots.txt'));
    expect(robots.status).toBe(200);
    expect(robots.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const robotsText = await robots.text();
    expect(robotsText).toContain('Disallow: /admin/');
    expect(robotsText).toContain('Disallow: /access');
    expect(robotsText).toContain('Sitemap: https://trust.example.com/sitemap.xml');

    const sitemap = await handler(new Request('https://trust.example/sitemap.xml'));
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(await sitemap.text()).toContain('<url><loc>https://trust.example.com/</loc><lastmod>2026-08-30</lastmod></url>');
  });

  it('lets admins export subscribers as CSV and retry failed emails', async () => {
    const { handler, repository, emailSender } = setup();
    await handler(jsonRequest('/api/subscribe', { email: 'quote"me@example.com' }));
    await handler(jsonRequest('/api/subscribe', { email: 'other@example.com' }));

    expect((await handler(new Request('https://trust.example/api/admin/subscribers/export'))).status).toBe(401);
    const exported = await handler(adminRequest('/api/admin/subscribers/export', undefined, 'GET'));
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(exported.headers.get('content-disposition')).toBe('attachment; filename="subscribers-2026-08-30.csv"');
    expect((await exported.text()).split('\r\n')).toEqual([
      'email,status,subscribed_at,confirmed_at',
      '"quote""me@example.com",pending,2026-08-30T12:00:00.000Z,',
      'other@example.com,pending,2026-08-30T12:00:00.000Z,',
      ''
    ]);
    expect(repository.audits).toContain('subscribers.exported');

    const failed = repository.outbox[0];
    if (!failed) throw new Error('outbox fixture missing');
    expect((await handler(adminRequest(`/api/admin/emails/${failed.id}/retry`))).status).toBe(404);
    failed.status = 'failed';
    failed.attempts = 5;
    failed.lastError = 'provider unavailable';
    const sentBefore = emailSender.sent.length;
    const retried = await handler(adminRequest(`/api/admin/emails/${failed.id}/retry`));
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ ok: true, id: failed.id, status: 'pending' });
    expect(failed.status).toBe('sent');
    expect(failed.lastError).toBeUndefined();
    expect(emailSender.sent).toHaveLength(sentBefore + 1);
    expect(repository.audits).toContain('email.retried');
  });

  it('confirms subscriptions by token, unsubscribes idempotently, and rejects stale links', async () => {
    const { handler, repository } = setup();
    await handler(jsonRequest('/api/subscribe', { email: 'person@example.com' }));

    expect((await handler(jsonRequest('/api/subscribe/confirm', { token: 'test-token-unknown' }))).status).toBe(400);

    const confirmed = await handler(jsonRequest('/api/subscribe/confirm', { token: 'test-token-1' }));
    expect(confirmed.status).toBe(200);
    expect(repository.subscribers[0]?.status).toBe('active');
    expect(repository.audits).toContain('subscriber.confirmed');

    expect((await handler(jsonRequest('/api/subscribe/confirm', { token: 'test-token-1' }))).status).toBe(400);

    const resubscribed = await handler(jsonRequest('/api/subscribe', { email: 'person@example.com' }));
    expect(resubscribed.status).toBe(202);
    expect(repository.outbox).toHaveLength(1);

    expect((await handler(jsonRequest('/api/unsubscribe', { token: 'test-token-2' }))).status).toBe(200);
    expect(repository.subscribers[0]?.status).toBe('unsubscribed');

    expect((await handler(jsonRequest('/api/unsubscribe', { token: 'test-token-2' }))).status).toBe(200);
    expect(repository.audits.filter((action) => action === 'subscriber.unsubscribed')).toHaveLength(1);
    expect((await handler(jsonRequest('/api/unsubscribe', { token: 'test-token-unknown' }))).status).toBe(400);
  });

  it('emails active subscribers exactly once when an update is published', async () => {
    const { handler, repository, emailSender } = setup();
    repository.subscribers.push(
      subscriber({ id: 'sub-1', email: 'active@example.com', unsubscribeToken: 'known-unsubscribe-token' }),
      subscriber({ id: 'sub-2', email: 'legacy@example.com' }),
      subscriber({ id: 'sub-3', email: 'pending@example.com', status: 'pending' }),
      subscriber({ id: 'sub-4', email: 'gone@example.com', status: 'unsubscribed' })
    );
    repository.state.updates.push({
      id: 'update-1', title: 'New SOC 2 report', body: 'The 2026 SOC 2 Type II report is available on request.',
      category: 'COMPLIANCE', visibilityType: 'PUBLIC',
      publishedAt: '2026-08-30T00:00:00.000Z', lifecycle: 'review', notifiedAt: null
    });
    const move = (lifecycle: string) => handler(adminRequest('/api/admin/resources/updates/update-1/lifecycle', { lifecycle }));

    const published = await move('published');
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ lifecycle: 'published', notified: 2 });

    const notifications = emailSender.sent.filter((email) => email.template === 'update-published');
    expect(notifications.map((email) => email.to)).toEqual(['active@example.com', 'legacy@example.com']);
    expect(notifications[0]?.subject).toBe('Northstar Labs trust center update: New SOC 2 report');
    expect(notifications[0]?.bodyText).toContain('https://trust.example/unsubscribe?token=known-unsubscribe-token');
    expect(repository.subscribers[1]?.unsubscribeToken).toBe('test-token-1');
    expect(notifications[1]?.bodyText).toContain('https://trust.example/unsubscribe?token=test-token-1');
    expect(repository.state.updates[0]?.notifiedAt).toBe('2026-08-30T12:00:00.000Z');
    expect(repository.audits).toContain('update.notified');

    for (const step of ['archived', 'draft', 'review', 'published']) {
      expect((await move(step)).status).toBe(200);
    }
    expect(emailSender.sent.filter((email) => email.template === 'update-published')).toHaveLength(2);
  });

  it('publishes an update without notifications when nobody is subscribed', async () => {
    const { handler, repository, emailSender } = setup();
    repository.state.updates.push({
      id: 'update-1', title: 'Quiet update', body: 'No audience yet.', category: 'GENERAL', visibilityType: 'PUBLIC',
      publishedAt: '2026-08-30T00:00:00.000Z', lifecycle: 'review', notifiedAt: null
    });
    const response = await handler(adminRequest('/api/admin/resources/updates/update-1/lifecycle', { lifecycle: 'published' }));

    expect(await response.json()).toMatchObject({ notified: 0 });
    expect(emailSender.sent).toHaveLength(0);
    expect(repository.state.updates[0]?.notifiedAt).toBeNull();
  });

  it('rejects confirmation tokens after the 48 hour window', async () => {
    const { handler, repository } = setup();
    await handler(jsonRequest('/api/subscribe', { email: 'person@example.com' }));
    const pending = repository.subscribers[0];
    if (!pending) throw new Error('fixture missing');
    pending.confirmExpiresAt = '2026-08-29T12:00:00.000Z';

    expect((await handler(jsonRequest('/api/subscribe/confirm', { token: 'test-token-1' }))).status).toBe(400);
    expect(repository.subscribers[0]?.status).toBe('pending');
  });

  it('records access requests only for visible gated documents and alerts the security contact once', async () => {
    const { handler, repository, emailSender } = setup();
    const submit = () => handler(jsonRequest('/api/access-requests', { documentId: 'gated', name: 'Avery', email: 'avery@example.com', company: 'Buyer Co', reason: 'Security review' }));

    const response = await submit();
    expect(response.status).toBe(202);
    expect(await response.json()).not.toHaveProperty('id');
    expect(repository.accessRequests).toHaveLength(1);
    expect(repository.accessRequests[0]).toMatchObject({ requestedResources: ['gated'], accessLevel: 'PARTIAL_ACCESS', status: 'pending' });

    const alerts = emailSender.sent.filter((email) => email.template === 'access-request-notification');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.to).toBe('security@northstar.example');
    expect(alerts[0]?.subject).toBe('[Northstar Labs trust center] Access request: SOC 2 report');
    expect(alerts[0]?.bodyText).toContain('Email: avery@example.com');
    expect(alerts[0]?.bodyText).toContain('Reason: Security review');
    expect(alerts[0]?.bodyText).toContain('https://trust.example/admin/#requests');

    // A repeat while the first request is still pending is absorbed silently.
    const repeat = await submit();
    expect(repeat.status).toBe(202);
    expect(await repeat.json()).toEqual(await (await submit()).json());
    expect(repository.accessRequests).toHaveLength(1);
    expect(emailSender.sent.filter((email) => email.template === 'access-request-notification')).toHaveLength(1);

    // A full-access request from the same person is a different ask.
    expect((await handler(jsonRequest('/api/access-requests', { name: 'Avery', email: 'avery@example.com', company: 'Buyer Co' }))).status).toBe(202);
    expect(repository.accessRequests).toHaveLength(2);
    const alert = emailSender.sent.filter((email) => email.template === 'access-request-notification').at(-1);
    expect(alert?.subject).toBe('[Northstar Labs trust center] Access request: full access');
    expect(alert?.bodyText).not.toContain('Reason:');
  });

  it('sends access-request alerts to the configured override address', async () => {
    const { handler, emailSender } = setup({ notifyEmail: 'trust-alerts@northstar.example' });
    await handler(jsonRequest('/api/access-requests', { documentId: 'gated', name: 'Avery', email: 'avery@example.com', company: 'Buyer Co' }));
    const alert = emailSender.sent.find((email) => email.template === 'access-request-notification');
    expect(alert?.to).toBe('trust-alerts@northstar.example');
  });

  it('creates, updates, and deletes structured FAQ records through an allowlisted route', async () => {
    const { handler, repository } = setup();
    const created = await handler(adminRequest('/api/admin/resources/faqs', { question: 'Do you encrypt data?', answer: 'Yes, in transit and at rest.', sortOrder: 1 }));
    expect(created.status).toBe(201);
    expect(repository.state.faqs[0]).toMatchObject({ id: 'generated-id-1', lifecycle: 'draft', categoryId: null });

    const listed = await handler(adminRequest('/api/admin/resources/faqs', undefined, 'GET'));
    expect(await listed.json()).toMatchObject({ results: [{ id: 'generated-id-1' }] });

    const updated = await handler(adminRequest('/api/admin/resources/faqs/generated-id-1', { question: 'Is data encrypted?' }, 'PATCH'));
    expect(updated.status).toBe(200);
    expect(repository.state.faqs[0]).toMatchObject({ question: 'Is data encrypted?', answer: 'Yes, in transit and at rest.' });

    const deleted = await handler(adminRequest('/api/admin/resources/faqs/generated-id-1', undefined, 'DELETE'));
    expect(deleted.status).toBe(204);
    expect(repository.state.faqs).toHaveLength(0);
    expect(repository.audits).toEqual(expect.arrayContaining(['faqs.created', 'faqs.updated', 'faqs.deleted']));
  });

  it('moves resources through the lifecycle state machine and rejects invalid transitions', async () => {
    const { handler, repository } = setup();
    repository.state.faqs.push({ id: 'faq-1', question: 'Encrypted?', answer: 'Yes.', categoryId: null, lifecycle: 'draft', sortOrder: 1 });
    const move = (lifecycle: string, id = 'faq-1') => handler(adminRequest(`/api/admin/resources/faqs/${id}/lifecycle`, { lifecycle }));

    const skipped = await move('published');
    expect(skipped.status).toBe(400);
    expect(await skipped.json()).toEqual({ error: 'A draft record cannot move to published.' });

    expect((await move('review')).status).toBe(200);
    expect((await move('published')).status).toBe(200);
    expect(repository.state.faqs[0]?.lifecycle).toBe('published');
    expect(repository.audits.filter((action) => action === 'faqs.lifecycle_changed')).toHaveLength(2);

    expect((await move('published')).status).toBe(200);
    expect(repository.audits.filter((action) => action === 'faqs.lifecycle_changed')).toHaveLength(2);

    expect((await move('review', 'missing')).status).toBe(404);
    expect((await move('visible')).status).toBe(400);
  });

  it('keeps unpublished documents out of the public request and download routes', async () => {
    const { handler, repository } = setup();
    const gated = repository.state.documents[0];
    if (!gated) throw new Error('fixture missing');
    gated.lifecycle = 'draft';

    expect((await handler(jsonRequest('/api/access-requests', { documentId: 'gated', name: 'Avery', email: 'avery@example.com', company: 'Buyer Co' }))).status).toBe(404);
    expect((await handler(new Request('https://trust.example/api/documents/gated'))).status).toBe(404);
    expect(repository.accessRequests).toHaveLength(0);
  });

  it('returns 404 when an admin mutation targets a missing record', async () => {
    const { handler, repository } = setup();
    repository.updateResource = async () => { throw new NotFoundError('Resource not found'); };
    const response = await handler(adminRequest('/api/admin/resources/faqs/missing', { question: 'Question?', answer: 'Answer.', sortOrder: 1 }, 'PUT'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Resource not found.' });
  });

  it('stores an uploaded PDF privately and streams it only through the public document route', async () => {
    const { handler, repository, documents } = setup();
    const form = new FormData();
    form.set('title', 'Security overview');
    form.set('description', 'Our security program summary.');
    form.set('category', 'Security');
    form.set('visibility', 'public');
    form.set('version', '1.0');
    form.set('file', new File([new TextEncoder().encode('%PDF-1.7\nverified')], 'security-overview.pdf', { type: 'application/pdf' }));

    const upload = await handler(new Request('https://trust.example/api/admin/documents/upload', {
      method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: form
    }));
    expect(upload.status).toBe(201);
    const stored = repository.state.documents.find((document) => document.sourceType === 'r2');
    if (!stored) throw new Error('document missing');
    expect(stored.objectKey).toMatch(/^documents\/generated-id-/);
    expect(stored).toMatchObject({ lifecycle: 'draft', fileName: 'security-overview.pdf', mimeType: 'application/pdf' });
    expect(documents.objects.has(stored.objectKey as string)).toBe(true);

    stored.lifecycle = 'published';
    const download = await handler(new Request(`https://trust.example/api/documents/${stored.id}`));
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('application/pdf');
    expect(download.headers.get('content-disposition')).toContain('security-overview.pdf');
    expect(await download.text()).toContain('%PDF-1.7');

    const media = await handler(adminRequest(`/api/admin/resources/documents/${stored.id}/media`, undefined, 'GET'));
    expect(media.status).toBe(200);
    expect(await media.text()).toContain('verified');
  });

  it('stores a company logo and serves it on the public logo route', async () => {
    const { handler, repository, documents } = setup();
    const upload = await handler(new Request('https://trust.example/api/admin/logo', {
      method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload()
    }));
    expect(upload.status).toBe(201);
    const body = await upload.json() as { site: { logoUrl: string; logoObjectKey: string } };
    expect(body.site.logoUrl).toBe('/api/logo');
    expect(repository.state.site.logoObjectKey).toMatch(/^branding\/logo-generated-id-/);
    expect(documents.objects.has(repository.state.site.logoObjectKey as string)).toBe(true);

    const snapshot = await (await handler(new Request('https://trust.example/api/site'))).json() as { site: Record<string, unknown> };
    expect(snapshot.site.logoUrl).toBe('/api/logo');
    expect(snapshot.site).not.toHaveProperty('logoObjectKey');

    const image = await handler(new Request('https://trust.example/api/logo'));
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');

    const removed = await handler(adminRequest('/api/admin/logo', undefined, 'DELETE'));
    expect(removed.status).toBe(200);
    expect(repository.state.site.logoUrl).toBe('');
    expect((await handler(new Request('https://trust.example/api/logo'))).status).toBe(404);
  });

  it('keeps an uploaded logo when the public profile is saved with an empty logoUrl', async () => {
    const { handler, repository, documents } = setup();
    const upload = await handler(new Request('https://trust.example/api/admin/logo', { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload() }));
    expect(upload.status).toBe(201);
    const objectKey = repository.state.site.logoObjectKey as string;

    const saved = await handler(adminRequest('/api/admin/site', { ...SITE, companyName: 'Harbor Security', logoUrl: '' }, 'PUT'));
    expect(saved.status).toBe(200);
    expect(repository.state.site.companyName).toBe('Harbor Security');
    expect(repository.state.site.logoUrl).toBe('/api/logo');
    expect(repository.state.site.logoObjectKey).toBe(objectKey);
    expect(documents.objects.has(objectKey)).toBe(true);
    expect((await handler(new Request('https://trust.example/api/logo'))).status).toBe(200);
  });

  it('keeps the current logo object when the D1 write fails during a replacement upload', async () => {
    const { handler, repository, documents } = setup();
    const first = await handler(new Request('https://trust.example/api/admin/logo', { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload() }));
    expect(first.status).toBe(201);
    const originalKey = repository.state.site.logoObjectKey as string;

    repository.failNextSiteUpdate = true;
    const second = await handler(new Request('https://trust.example/api/admin/logo', { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload() }));
    expect(second.status).toBe(500);
    expect(repository.state.site.logoObjectKey).toBe(originalKey);
    expect([...documents.objects.keys()]).toEqual([originalKey]);
    expect((await handler(new Request('https://trust.example/api/logo'))).status).toBe(200);
  });

  it('keeps the logo object when the D1 write fails during removal', async () => {
    const { handler, repository, documents } = setup();
    await handler(new Request('https://trust.example/api/admin/logo', { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload() }));
    const objectKey = repository.state.site.logoObjectKey as string;

    repository.failNextSiteUpdate = true;
    const removed = await handler(adminRequest('/api/admin/logo', undefined, 'DELETE'));
    expect(removed.status).toBe(500);
    expect(repository.state.site.logoUrl).toBe('/api/logo');
    expect(documents.objects.has(objectKey)).toBe(true);
  });

  it('commits the site change and records an orphan when the old logo cannot be deleted', async () => {
    const { handler, repository, documents } = setup();
    await handler(new Request('https://trust.example/api/admin/logo', { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload() }));
    const objectKey = repository.state.site.logoObjectKey as string;

    documents.failDelete = true;
    const removed = await handler(adminRequest('/api/admin/logo', undefined, 'DELETE'));
    expect(removed.status).toBe(200);
    expect(repository.state.site.logoUrl).toBe('');
    expect(repository.state.site.logoObjectKey).toBeNull();
    expect(documents.objects.has(objectKey)).toBe(true);
    expect(repository.audits).toContain('branding.storage_orphaned');
  });

  it('replaces an uploaded logo with a remote URL and deletes the stored object', async () => {
    const { handler, repository, documents } = setup();
    await handler(new Request('https://trust.example/api/admin/logo', { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: logoUpload() }));
    const objectKey = repository.state.site.logoObjectKey as string;

    const saved = await handler(adminRequest('/api/admin/site', { ...SITE, logoUrl: 'https://cdn.example.com/logo.png' }, 'PUT'));
    expect(saved.status).toBe(200);
    expect(repository.state.site.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(repository.state.site.logoObjectKey).toBeNull();
    expect(documents.objects.has(objectKey)).toBe(false);
  });

  async function submitAccessRequest(handler: (request: Request) => Promise<Response>) {
    const response = await handler(jsonRequest('/api/access-requests', {
      documentId: 'gated', name: 'Avery', email: 'avery@example.com', company: 'Buyer Co', reason: 'Security review'
    }));
    expect(response.status).toBe(202);
    return 'generated-id-1';
  }

  it('approving a request creates a viewer, emails an access link, and serves the document through it', async () => {
    const { handler, repository, emailSender } = setup();
    const requestId = await submitAccessRequest(handler);

    const approved = await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, { expirationDate: '2026-09-06T12:00:00.000Z' }));
    expect(approved.status).toBe(200);
    const body = await approved.json() as { viewer: { id: string; accessUrl: string; accessLevel: string; resourceIds: string[]; expirationDate: string } };
    expect(body.viewer.accessUrl).toBe('https://trust.example/access?token=test-token-1');
    expect(body.viewer).toMatchObject({ accessLevel: 'PARTIAL_ACCESS', resourceIds: ['gated'], expirationDate: '2026-09-06T12:00:00.000Z' });

    expect(repository.viewers).toHaveLength(1);
    expect(repository.viewers[0]).toMatchObject({ email: 'avery@example.com', name: 'Avery', companyName: 'Buyer Co', tokenHash: await sha256Hex('test-token-1'), accessRequestId: requestId });
    expect(repository.accessRequests[0]?.status).toBe('approved');
    expect(repository.audits).toContain('viewer.granted');

    const delivery = emailSender.sent.find((email) => email.template === 'viewer-access');
    expect(delivery?.to).toBe('avery@example.com');
    expect(delivery?.subject).toBe('Northstar Labs: your trust center access link');
    expect(delivery?.bodyText).toContain('https://trust.example/access?token=test-token-1');
    expect(delivery?.bodyText).toContain('expires on 2026-09-06');

    const snapshot = await handler(new Request('https://trust.example/api/viewer/test-token-1'));
    expect(snapshot.status).toBe(200);
    const view = await snapshot.json() as { viewer: { email: string }; documents: Array<{ id: string; accessible: boolean }> };
    expect(view.viewer.email).toBe('avery@example.com');
    expect(view.documents).toEqual([expect.objectContaining({ id: 'gated', accessible: true })]);

    const download = await handler(new Request('https://trust.example/api/viewer/test-token-1/documents/gated'));
    expect(download.status).toBe(302);
    expect(download.headers.get('location')).toBe('https://example.com/report.pdf');

    expect((await handler(new Request('https://trust.example/api/viewer/test-token-unknown'))).status).toBe(410);
    expect((await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, {}))).status).toBe(409);
  });

  it('validates expiration dates before approving a request', async () => {
    const { handler, repository } = setup();
    const requestId = await submitAccessRequest(handler);

    expect((await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, { expirationDate: 'not-a-date' }))).status).toBe(400);
    expect((await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, { expirationDate: '2026-08-01T00:00:00.000Z' }))).status).toBe(400);
    expect(repository.viewers).toHaveLength(0);

    const approved = await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, { expirationDate: '2026-08-31T12:00:00.000Z' }));
    expect(approved.status).toBe(200);
    const first = await approved.json() as { viewer: { id: string; accessUrl: string } };
    expect((await handler(new Request(first.viewer.accessUrl.replace('/access?token=', '/api/viewer/')))).status).toBe(200);
    expect(repository.viewers).toHaveLength(1);
  });

  it('stops viewer downloads once expired, removed, or the document is unpublished', async () => {
    const { handler, repository } = setup();
    const requestId = await submitAccessRequest(handler);
    await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, {}));
    const viewer = repository.viewers[0];
    if (!viewer) throw new Error('viewer missing');
    const downloadUrl = 'https://trust.example/api/viewer/test-token-1/documents/gated';

    viewer.expiresAt = '2026-08-30T11:59:59.000Z';
    expect((await handler(new Request(downloadUrl))).status).toBe(410);

    viewer.expiresAt = null;
    const document = repository.state.documents[0];
    if (!document) throw new Error('fixture missing');
    document.lifecycle = 'archived';
    expect((await handler(new Request(downloadUrl))).status).toBe(404);
    document.lifecycle = 'published';

    const removed = await handler(adminRequest(`/api/admin/viewers/${viewer.id}`, undefined, 'DELETE'));
    expect(removed.status).toBe(204);
    expect(repository.audits).toContain('viewer.removed');
    expect((await handler(new Request(downloadUrl))).status).toBe(410);

    expect((await handler(adminRequest(`/api/admin/viewers/${viewer.id}`, undefined, 'DELETE'))).status).toBe(404);
  });

  it('refuses to approve a request once the document is no longer published', async () => {
    const { handler, repository, emailSender } = setup();
    const requestId = await submitAccessRequest(handler);
    const document = repository.state.documents[0];
    if (!document) throw new Error('fixture missing');
    document.lifecycle = 'archived';

    const approved = await handler(adminRequest(`/api/admin/access-requests/${requestId}/approve`, {}));
    expect(approved.status).toBe(409);
    expect(((await approved.json()) as { error: string }).error).toContain('no longer published');
    expect(repository.viewers).toHaveLength(0);
    expect(repository.accessRequests[0]?.status).toBe('pending');
    expect(emailSender.sent.filter((email) => email.template !== 'access-request-notification')).toHaveLength(0);
  });

  it('records denials with an optional reason and lists them after pending requests', async () => {
    const { handler, repository } = setup();
    const requestId = await submitAccessRequest(handler);

    const denied = await handler(adminRequest(`/api/admin/access-requests/${requestId}/deny`, { reason: 'Not an active evaluation' }));
    expect(denied.status).toBe(200);
    expect(await denied.json()).toEqual({ ok: true, id: requestId, status: 'denied', reason: 'Not an active evaluation' });
    expect(repository.accessRequests[0]).toMatchObject({ status: 'denied', denialReason: 'Not an active evaluation' });
    expect(repository.viewers).toHaveLength(0);

    await submitAccessRequest(handler);
    const listed = await (await handler(adminRequest('/api/admin/access-requests', undefined, 'GET'))).json() as { results: { data: Array<Record<string, unknown>> } };
    expect(listed.results.data.map((request) => request.id)).toEqual(['generated-id-2', requestId]);
    expect(listed.results.data[1]).toMatchObject({ id: requestId, outcome: 'DENIED', manualDenialReason: 'Not an active evaluation' });
  });

  it('drains the outbox with retries and never sends the same letter twice', async () => {
    const emailSender = new FakeEmailSender();
    const { handler, repository } = setup({ emailSender });
    emailSender.failNext = true;
    await handler(jsonRequest('/api/subscribe', { email: 'person@example.com' }));
    expect(repository.outbox[0]).toMatchObject({ status: 'pending', attempts: 1, lastError: 'SMTP unavailable' });

    await handler(jsonRequest('/api/subscribe', { email: 'second@example.com' }));
    expect(repository.outbox.filter((row) => row.status === 'sent')).toHaveLength(2);
    expect(emailSender.sent).toHaveLength(2);
  });
});
