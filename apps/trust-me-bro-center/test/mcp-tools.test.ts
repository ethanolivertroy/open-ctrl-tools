import { describe, expect, it } from 'vitest';
import { createRecord, getAdminState, getPublicSnapshot, isMcpPath, removeLogo, resetDemoContent, setLifecycle, updateSite, uploadLogo, type ToolContext } from '../src/mcp-tools';
import * as svc from '../src/services';
import { adminRequest, MemoryRepository, setup, TINY_PNG } from './support/memory-repository';

function context() {
  const { repository, documents, services } = setup();
  repository.state.faqs.push({ id: 'hosting', question: 'Where is customer data hosted?', answer: 'United States.', categoryId: null, lifecycle: 'published', sortOrder: 1 });
  const ctx: ToolContext = { services, actor: 'admin', origin: 'https://trust.example' };
  return { repository, documents, ctx };
}

describe('trust center MCP tools', () => {
  it('returns the published public snapshot', async () => {
    const { ctx } = context();
    const snapshot = await getPublicSnapshot(ctx);
    expect(snapshot.site.companyName).toBe('Northstar Labs');
    if ('private' in snapshot) throw new Error('expected a public snapshot');
    expect(snapshot.faqs).toHaveLength(1);
  });

  it('filters admin state to requested sections', async () => {
    const { ctx } = context();
    const state = await getAdminState(ctx, ['faqs', 'site', 'totals']);
    expect(state).toMatchObject({ actor: 'admin', site: { companyName: 'Northstar Labs' }, totals: { subscribers: 0, pendingAccessRequests: 0 } });
    expect(state).not.toHaveProperty('documents');
    await expect(getAdminState(ctx, ['grants'])).rejects.toThrow(/Unknown section/);
  });

  it('removes subscribers and requeues failed emails through the repository', async () => {
    const { ctx, repository } = context();
    repository.subscribers.push({
      id: 'subscriber-9', email: 'gone@example.com', status: 'active', confirmedAt: null,
      confirmTokenHash: null, confirmExpiresAt: null, unsubscribeToken: null, createdAt: '2026-08-01T00:00:00.000Z'
    });
    expect(await svc.deleteSubscriber(ctx, 'subscriber-9')).toEqual({ ok: true, id: 'subscriber-9', deleted: true });
    expect(repository.subscribers).toEqual([]);

    repository.queueEmail({ to: 'x@example.com', subject: 'Hi', bodyText: 'Body', template: 'test' });
    await expect(svc.retryEmail(ctx, 'email-1')).rejects.toThrow(/Only failed emails/);
    repository.outbox[0]!.status = 'failed';
    expect(await svc.retryEmail(ctx, 'email-1')).toEqual({ ok: true, id: 'email-1', status: 'pending' });
    expect(repository.outbox[0]?.status).toBe('sent');
    expect(repository.audits).toEqual(['subscriber.deleted', 'email.retried']);
  });

  it('updates the public profile including visibility, banner, and privacy fields', async () => {
    const { ctx, repository } = context();
    const result = await updateSite(ctx, {
      companyName: 'Harbor Security',
      headline: 'Inspectable by default.',
      isPublic: false,
      bannerSetting: 'GRADIENT',
      bannerStartColor: '#112233',
      privacyPolicyUrl: 'https://harbor.example/privacy',
      controlVisibilityMode: 'SHOW_OK_ONLY'
    });
    expect(result.site).toMatchObject({ companyName: 'Harbor Security', isPublic: false, bannerSetting: 'GRADIENT', bannerStartColor: '#112233', controlVisibilityMode: 'SHOW_OK_ONLY' });
    expect(repository.state.site.headline).toBe('Inspectable by default.');
    await expect(updateSite(ctx, { bannerSetting: 'SPARKLES' })).rejects.toThrow(/Banner setting/);
    await expect(updateSite(ctx, { privacyPolicyUrl: 'http://insecure.example' })).rejects.toThrow(/HTTPS/);
  });

  it('keeps an uploaded logo when update_site sends an empty logoUrl', async () => {
    const { ctx, repository, documents } = context();
    await uploadLogo(ctx, { bytesBase64: TINY_PNG, contentType: 'image/png' });
    const objectKey = repository.state.site.logoObjectKey as string;
    expect(objectKey).toBeTruthy();

    const result = await updateSite(ctx, { companyName: 'Harbor Security', logoUrl: '' });
    expect(result.site.companyName).toBe('Harbor Security');
    expect(result.site.logoUrl).toBe('/api/logo');
    expect(result.site.logoObjectKey).toBe(objectKey);
    expect(documents.objects.has(objectKey)).toBe(true);
  });

  it('keeps the current logo when upload_logo fails to commit the new key', async () => {
    const { ctx, repository, documents } = context();
    await uploadLogo(ctx, { bytesBase64: TINY_PNG, contentType: 'image/png' });
    const originalKey = repository.state.site.logoObjectKey as string;

    repository.failNextSiteUpdate = true;
    await expect(uploadLogo(ctx, { bytesBase64: TINY_PNG, contentType: 'image/png' })).rejects.toThrow('D1 write failed');
    expect(repository.state.site.logoObjectKey).toBe(originalKey);
    expect([...documents.objects.keys()]).toEqual([originalKey]);
  });

  it('clears a remote logo URL and removes an uploaded logo only through remove_logo', async () => {
    const { ctx, repository, documents } = context();
    await updateSite(ctx, { logoUrl: 'https://cdn.example.com/logo.png' });
    expect(repository.state.site.logoUrl).toBe('https://cdn.example.com/logo.png');

    await updateSite(ctx, { logoUrl: '' });
    expect(repository.state.site.logoUrl).toBe('');

    await uploadLogo(ctx, { bytesBase64: TINY_PNG, contentType: 'image/png' });
    const objectKey = repository.state.site.logoObjectKey as string;
    await removeLogo(ctx);
    expect(repository.state.site.logoUrl).toBe('');
    expect(repository.state.site.logoObjectKey).toBeNull();
    expect(documents.objects.has(objectKey)).toBe(false);
  });

  it('creates a draft FAQ and publishes it', async () => {
    const { ctx, repository } = context();
    const created = await createRecord(ctx, 'faqs', { question: 'Who is the security contact?', answer: 'Email security@harbor.example.', sortOrder: 5 });
    expect(created.resource).toMatchObject({ id: 'generated-id-1', lifecycle: 'draft' });
    await setLifecycle(ctx, 'faqs', 'generated-id-1', 'review');
    await setLifecycle(ctx, 'faqs', 'generated-id-1', 'published');
    expect(repository.state.faqs.at(-1)?.lifecycle).toBe('published');
  });

  it('refuses a demo reset without confirm', async () => {
    const { ctx } = context();
    await expect(resetDemoContent(ctx, false)).rejects.toThrow(/confirm=true/);
  });

  it('applies the demonstration bundle when reset is confirmed', async () => {
    const { ctx, repository } = context();
    const result = await resetDemoContent(ctx, true);
    expect(result.reset).toBe('demo');
    expect(result.counts).toMatchObject({ faqs: 4, controlCategories: 3, controls: 5, dataCollected: 4 });
    expect(repository.imported?.site.companyName).toBe('Northstar Labs');
    expect(repository.imported?.controlCategories?.[2]).toMatchObject({ name: 'Internal audit evidence', visibility: 'SHAREABLE' });
  });
});

describe('MCP path helper', () => {
  it('accepts /mcp and nested protocol routes', () => {
    expect(isMcpPath('/mcp')).toBe(true);
    expect(isMcpPath('/mcp/')).toBe(true);
    expect(isMcpPath('/mcp/sse')).toBe(true);
    expect(isMcpPath('/api/admin/state')).toBe(false);
  });
});

describe('admin reset route', () => {
  it('restores demonstration content when confirmed', async () => {
    const { handler, repository } = setup();
    const denied = await handler(adminRequest('/api/admin/reset', { confirm: false }));
    expect(denied.status).toBe(400);

    const allowed = await handler(adminRequest('/api/admin/reset', { confirm: true }));
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ ok: true, reset: 'demo' });
    expect((repository as MemoryRepository).imported?.source).toBe('manual');
  });
});
