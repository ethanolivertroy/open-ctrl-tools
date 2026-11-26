import { describe, expect, it } from 'vitest';
import { paginate } from '../src/http';
import { answerQuestion } from '../src/chatbot';
import { publicSnapshot } from '../src/domain';
import { adminRequest, fixtureState, gatedDocument, jsonRequest, pngBytes, setup } from './support/memory-repository';

type Json = Record<string, unknown>;
const read = async <T = Json>(response: Response) => await response.json() as T;

describe('pagination', () => {
  it('walks a list with opaque cursors', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const first = paginate(items, 2, null);
    expect(first.results.data).toEqual(['a', 'b']);
    expect(first.results.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
    const second = paginate(items, 2, first.results.pageInfo.endCursor);
    expect(second.results.data).toEqual(['c', 'd']);
    expect(second.results.pageInfo.hasPreviousPage).toBe(true);
    const third = paginate(items, 2, second.results.pageInfo.endCursor);
    expect(third.results.data).toEqual(['e']);
    expect(third.results.pageInfo.hasNextPage).toBe(false);
    expect(() => paginate(items, 2, 'garbage')).toThrow(/pageCursor/);
  });

  it('applies pageSize and pageCursor from the query string', async () => {
    const { handler, repository } = setup();
    for (let index = 0; index < 3; index += 1) {
      repository.state.controlCategories.push({ id: `cat-${index}`, name: `Category ${index}`, visibility: 'PUBLIC', statusVisibilityOverride: null, sortOrder: index });
      repository.state.controls.push({ id: `control-${index}`, externalId: null, name: `Control ${index}`, description: '', status: 'OK', tags: {}, memberships: [{ categoryId: `cat-${index}`, sortOrder: 0 }], createdAt: '2026-08-30T00:00:00.000Z' });
    }
    const page = await read<{ results: { data: Json[]; pageInfo: { endCursor: string; hasNextPage: boolean } } }>(await handler(adminRequest('/api/admin/controls?pageSize=2', undefined, 'GET')));
    expect(page.results.data).toHaveLength(2);
    expect(page.results.data[0]).toMatchObject({ id: 'control-0', categories: [{ id: 'cat-0', name: 'Category 0' }] });
    const next = await read<{ results: { data: Json[] } }>(await handler(adminRequest(`/api/admin/controls?pageSize=2&pageCursor=${page.results.pageInfo.endCursor}`, undefined, 'GET')));
    expect(next.results.data.map((item) => item.id)).toEqual(['control-2']);
    expect((await handler(adminRequest('/api/admin/controls?pageSize=500', undefined, 'GET'))).status).toBe(400);
  });
});

describe('trust center profile', () => {
  it('exposes profile fields and derives the banner and theme', async () => {
    const { handler } = setup();
    await handler(adminRequest('/api/admin/site', {
      companyName: 'Northstar Labs', headline: 'Hi', summary: 'Summary', securityEmail: 'security@northstar.example', location: 'US',
      title: 'Northstar Trust', accent: '#1f6b52', secondaryColor: '#0f3d2e', bannerSetting: 'GRADIENT',
      privacyPolicyUrl: 'https://northstar.example/privacy'
    }, 'PATCH'));
    const body = await read<{ site: Json }>(await handler(new Request('https://trust.example/api/site')));
    expect(body.site).toMatchObject({
      title: 'Northstar Trust',
      privacyPolicyUrl: 'https://northstar.example/privacy',
      bannerSetting: { setting: 'GRADIENT', startColor: '#1f6b52', endColor: '#0f3d2e', imageUrl: null },
      customTheme: { primary: '#1f6b52', secondary: '#0f3d2e' },
      controlVisibilityMode: 'SHOW_ALL_WITH_STATUS',
      createdAt: '2026-08-30T00:00:00.000Z'
    });
  });

  it('hides content when the trust center is private and lets a viewer request full access', async () => {
    const { handler, repository } = setup();
    repository.state.site.isPublic = false;
    const body = await read(await handler(new Request('https://trust.example/api/site')));
    expect(body).toMatchObject({ private: true, site: { isPublic: false, companyName: 'Northstar Labs' } });
    expect(body).not.toHaveProperty('documents');
    expect((await handler(new Request('https://trust.example/api/documents/gated'))).status).toBe(404);

    const request = await handler(jsonRequest('/api/access-requests', { name: 'Avery', email: 'avery@example.com', company: 'Buyer Co' }));
    expect(request.status).toBe(202);
    expect(repository.accessRequests[0]).toMatchObject({ accessLevel: 'FULL_ACCESS', requestedResources: null });

    const approved = await read<{ viewer: { accessUrl: string; resourceIds: null } }>(await handler(adminRequest('/api/admin/access-requests/generated-id-1/approve', {})));
    expect(approved.viewer.resourceIds).toBeNull();
    const view = await read<{ documents: Array<{ accessible: boolean }>; viewer: Json }>(await handler(new Request(approved.viewer.accessUrl.replace('/access?token=', '/api/viewer/'))));
    expect(view.documents[0]?.accessible).toBe(true);
    expect(view.viewer).toMatchObject({ accessLevel: 'FULL_ACCESS' });
  });

  it('uploads and serves favicon and banner images and a framework badge', async () => {
    const { handler, repository } = setup();
    repository.state.certifications.push({ id: 'soc2', name: 'SOC 2', status: 'Current', description: '', standard: 'soc2', badgeObjectKey: null, lifecycle: 'published', sortOrder: 1 });
    const upload = (path: string) => {
      const form = new FormData();
      form.set('file', new File([pngBytes()], 'image.png', { type: 'image/png' }));
      return handler(new Request(`https://trust.example${path}`, { method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: form }));
    };
    expect((await upload('/api/admin/favicon')).status).toBe(201);
    expect((await upload('/api/admin/banner')).status).toBe(201);
    expect(repository.state.site.bannerSetting).toBe('CUSTOM_IMAGE');
    expect((await handler(new Request('https://trust.example/api/favicon'))).status).toBe(200);
    expect((await handler(new Request('https://trust.example/api/banner'))).status).toBe(200);

    const badge = await upload('/api/admin/resources/certifications/soc2/badge');
    expect(await read(badge)).toEqual({ isSuccessful: true, badgeUrl: '/api/certifications/soc2/badge' });
    expect((await handler(new Request('https://trust.example/api/certifications/soc2/badge'))).status).toBe(200);
    const snapshot = await read<{ site: Json; certifications: Json[] }>(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.site).toMatchObject({ faviconUrl: '/api/favicon', bannerSetting: { setting: 'CUSTOM_IMAGE', imageUrl: '/api/banner' } });
    expect(snapshot.certifications[0]).toMatchObject({ standard: 'soc2', badgeUrl: '/api/certifications/soc2/badge' });

    expect((await handler(adminRequest('/api/admin/banner', undefined, 'DELETE'))).status).toBe(200);
    expect(repository.state.site.bannerSetting).toBe('MINIMAL');
    expect((await handler(new Request('https://trust.example/api/banner'))).status).toBe(404);
  });
});

describe('videos, categories, controls, and data collected', () => {
  it('replaces videos as a set', async () => {
    const { handler } = setup();
    const response = await handler(adminRequest('/api/admin/videos', { videos: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Overview' }] }, 'PUT'));
    expect(response.status).toBe(200);
    expect(await read(response)).toEqual({ results: [{ id: 'generated-id-1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Overview', description: '' }] });
    expect((await handler(adminRequest('/api/admin/videos', { videos: [{ url: 'http://insecure', title: 'x' }] }, 'PUT'))).status).toBe(400);
    const snapshot = await read<{ videos: Json[] }>(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.videos).toHaveLength(1);
  });

  it('manages resource categories, orders resources by them, and uncategorizes on delete', async () => {
    const { handler, repository } = setup();
    const policies = await read<Json>(await handler(adminRequest('/api/admin/resource-categories', { name: 'Policies' })));
    const audit = await read<Json>(await handler(adminRequest('/api/admin/resource-categories', { name: 'Audit reports' })));
    expect(policies).toMatchObject({ name: 'Policies', sortOrder: 0 });

    const gated = repository.state.documents[0]!;
    gated.categoryId = audit.id as string;
    repository.state.documents.push(gatedDocument({ id: 'policy', title: 'Access policy', visibility: 'public', categoryId: policies.id as string }));

    let snapshot = await read<{ documents: Json[]; resourceCategories: Json[] }>(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.documents.map((document) => document.id)).toEqual(['policy', 'gated']);
    expect(snapshot.documents[1]).toMatchObject({ category: 'Audit reports', categoryId: audit.id });

    const reordered = await handler(adminRequest('/api/admin/resource-categories/order', { categoryIds: [audit.id, policies.id] }, 'PUT'));
    expect(reordered.status).toBe(200);
    snapshot = await read(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.documents.map((document) => document.id)).toEqual(['gated', 'policy']);
    expect((await handler(adminRequest('/api/admin/resource-categories/order', { categoryIds: [audit.id] }, 'PUT'))).status).toBe(409);

    expect((await handler(adminRequest(`/api/admin/resource-categories/${policies.id}`, { name: 'Security policies' }, 'PATCH'))).status).toBe(200);
    expect((await handler(adminRequest(`/api/admin/resource-categories/${policies.id}`, undefined, 'DELETE'))).status).toBe(204);
    expect(repository.state.documents.find((document) => document.id === 'policy')?.categoryId).toBeNull();
    expect((await handler(adminRequest('/api/admin/resources/documents', { title: 'Orphan', url: 'https://example.com/x.pdf', categoryId: 'missing' }))).status).toBe(404);
  });

  it('groups FAQs by category and supports categoryId on create', async () => {
    const { handler } = setup();
    const category = await read<Json>(await handler(adminRequest('/api/admin/faq-categories', { name: 'Security' })));
    const faq = await read<{ resource: Json }>(await handler(adminRequest('/api/admin/resources/faqs', { question: 'Encrypted?', answer: 'Yes.', categoryId: category.id })));
    expect(faq.resource.categoryId).toBe(category.id);
    await handler(adminRequest(`/api/admin/resources/faqs/${faq.resource.id}/lifecycle`, { lifecycle: 'review' }));
    await handler(adminRequest(`/api/admin/resources/faqs/${faq.resource.id}/lifecycle`, { lifecycle: 'published' }));
    const snapshot = await read<{ faqs: Json[]; faqCategories: Json[] }>(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.faqs[0]).toMatchObject({ category: 'Security' });
    expect(snapshot.faqCategories).toEqual([{ id: category.id, name: 'Security' }]);
  });

  it('runs the control lifecycle: categories, controls, membership, ordering, tags, visibility', async () => {
    const { handler, repository } = setup();
    const access = await read<Json>(await handler(adminRequest('/api/admin/control-categories', { name: 'Access control' })));
    const internal = await read<Json>(await handler(adminRequest('/api/admin/control-categories', { name: 'Internal', visibility: 'SHAREABLE', statusVisibilityOverride: 'SHOW_ALL_WITHOUT_STATUS' })));
    expect(internal).toMatchObject({ visibility: 'SHAREABLE', statusVisibilityOverride: 'SHOW_ALL_WITHOUT_STATUS' });

    expect((await handler(adminRequest('/api/admin/controls', { name: 'No categories' }))).status).toBe(400);
    const mfa = await read<Json>(await handler(adminRequest('/api/admin/controls', { name: 'MFA everywhere', description: 'SSO + MFA', status: 'OK', categoryIds: [access.id] })));
    const backups = await read<Json>(await handler(adminRequest('/api/admin/controls', { name: 'Backups', status: 'NEEDS_ATTENTION', categoryIds: [access.id] })));
    const unmapped = await read<Json>(await handler(adminRequest('/api/admin/controls', { name: 'Vendor reviews', status: 'UNMAPPED', categoryIds: [access.id, internal.id] })));
    expect(mfa).toMatchObject({ status: 'OK', categories: [{ id: access.id, name: 'Access control' }] });

    let snapshot = await read<{ controlCategories: Array<{ id: string; controls: Json[] }> }>(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.controlCategories).toHaveLength(1);
    expect(snapshot.controlCategories[0]?.controls.map((control) => [control.name, control.status])).toEqual([['MFA everywhere', 'OK'], ['Backups', 'NEEDS_ATTENTION'], ['Vendor reviews', 'UNMAPPED']]);

    repository.state.site.controlVisibilityMode = 'SHOW_OK_AND_UNMAPPED';
    snapshot = await read(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.controlCategories[0]?.controls.map((control) => control.name)).toEqual(['MFA everywhere', 'Vendor reviews']);

    repository.state.site.controlVisibilityMode = 'SHOW_ALL_WITHOUT_STATUS';
    snapshot = await read(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.controlCategories[0]?.controls[0]).not.toHaveProperty('status');

    const reordered = await handler(adminRequest(`/api/admin/control-categories/${access.id}/controls/order`, { orderedControlIds: [unmapped.id, mfa.id, backups.id] }, 'PUT'));
    expect(reordered.status).toBe(200);
    snapshot = await read(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.controlCategories[0]?.controls.map((control) => control.name)).toEqual(['Vendor reviews', 'MFA everywhere', 'Backups']);
    expect((await handler(adminRequest(`/api/admin/control-categories/${access.id}/controls/order`, { orderedControlIds: [mfa.id] }, 'PUT'))).status).toBe(409);

    const bulk = await handler(adminRequest(`/api/admin/control-categories/${access.id}/controls`, { controlsToAdd: [], controlsToRemove: [backups.id] }, 'PATCH'));
    expect(bulk.status).toBe(200);
    expect(repository.state.controls.find((control) => control.id === backups.id)?.memberships).toEqual([]);

    const tagged = await read<{ results: Json[] }>(await handler(adminRequest('/api/admin/controls/tags', { controlIds: [mfa.id, unmapped.id], tagCategory: 'domain', tags: ['identity'] })));
    expect(tagged.results[0]?.tags).toEqual({ domain: ['identity'] });
    await handler(adminRequest('/api/admin/controls/tags', { controlIds: [mfa.id], tagCategory: 'domain', tags: ['identity'] }, 'DELETE'));
    expect((await read<Json>(await handler(adminRequest(`/api/admin/controls/${mfa.id}`, undefined, 'GET')))).tags).toEqual({});

    const patched = await read<Json>(await handler(adminRequest(`/api/admin/control-categories/${internal.id}`, { statusVisibilityOverride: null, visibility: 'PUBLIC' }, 'PATCH')));
    expect(patched).toMatchObject({ visibility: 'PUBLIC', statusVisibilityOverride: null });

    expect((await handler(adminRequest(`/api/admin/control-categories/${internal.id}`, undefined, 'DELETE'))).status).toBe(204);
    expect(repository.state.controls.some((control) => control.id === unmapped.id)).toBe(false);
    expect((await handler(adminRequest(`/api/admin/controls/${mfa.id}`, undefined, 'DELETE'))).status).toBe(204);
    expect((await handler(adminRequest(`/api/admin/controls/${mfa.id}`, undefined, 'GET'))).status).toBe(404);
  });

  it('shows shareable control categories only to viewers', async () => {
    const { handler, repository } = setup();
    repository.state.controlCategories.push({ id: 'internal', name: 'Internal', visibility: 'SHAREABLE', statusVisibilityOverride: null, sortOrder: 0 });
    repository.state.controls.push({ id: 'c1', externalId: null, name: 'Pen test cadence', description: '', status: 'OK', tags: {}, memberships: [{ categoryId: 'internal', sortOrder: 0 }], createdAt: '2026-08-30T00:00:00.000Z' });
    const anonymous = await read<{ controlCategories: unknown[] }>(await handler(new Request('https://trust.example/api/site')));
    expect(anonymous.controlCategories).toEqual([]);

    await handler(adminRequest('/api/admin/viewers', { email: 'viewer@example.com', name: 'Viewer', companyName: 'Buyer', isNdaRequired: false, accessLevel: 'FULL_ACCESS' }));
    const view = await read<{ controlCategories: Array<{ name: string }> }>(await handler(new Request('https://trust.example/api/viewer/test-token-1')));
    expect(view.controlCategories.map((category) => category.name)).toEqual(['Internal']);
  });

  it('replaces data collected disclosures and hides HIDDEN entries publicly', async () => {
    const { handler } = setup();
    const response = await handler(adminRequest('/api/admin/data-collected', {
      dataCollectedHeading: 'What we collect',
      dataCollected: [
        { dataCollected: 'Business contact information', status: 'COLLECTED' },
        { dataCollected: 'Payment card numbers', status: 'NOT_COLLECTED' },
        { dataCollected: 'Internal notes', status: 'HIDDEN' }
      ]
    }, 'PUT'));
    expect(response.status).toBe(200);
    expect(await read(response)).toMatchObject({ heading: 'What we collect', results: [{ status: 'COLLECTED' }, { status: 'NOT_COLLECTED' }, { status: 'HIDDEN' }] });
    const snapshot = await read<{ dataCollected: { heading: string; items: Json[] } }>(await handler(new Request('https://trust.example/api/site')));
    expect(snapshot.dataCollected.heading).toBe('What we collect');
    expect(snapshot.dataCollected.items.map((item) => item.dataCollected)).toEqual(['Business contact information', 'Payment card numbers']);
    expect((await handler(adminRequest('/api/admin/data-collected', { dataCollected: [{ dataCollected: 'x', status: 'MAYBE' }] }, 'PUT'))).status).toBe(400);
  });
});

describe('subscribers', () => {
  it('adds subscribers with or without verification, lists them, and deletes them', async () => {
    const { handler, repository, emailSender } = setup();
    const verified = await read<Json>(await handler(adminRequest('/api/admin/subscribers', { email: 'ciso@buyer.example', shouldSkipEmailVerification: true })));
    expect(verified).toMatchObject({ isEmailVerified: true, status: 'active' });
    expect(verified).not.toHaveProperty('groups');
    expect(emailSender.sent).toHaveLength(0);

    const pending = await read<Json>(await handler(adminRequest('/api/admin/subscribers', { email: 'analyst@buyer.example' })));
    expect(pending.isEmailVerified).toBe(false);
    expect(emailSender.sent.map((email) => email.template)).toEqual(['subscription-confirm']);
    expect((await handler(adminRequest('/api/admin/subscribers', { email: 'ciso@buyer.example' }))).status).toBe(409);
    expect((await handler(adminRequest('/api/admin/subscriber-groups', { name: 'Anything' }))).status).toBe(404);

    const page = await read<{ results: { data: Json[] } }>(await handler(adminRequest('/api/admin/subscribers?pageSize=1', undefined, 'GET')));
    expect(page.results.data).toHaveLength(1);
    expect((await handler(adminRequest(`/api/admin/subscribers/${pending.id}`, undefined, 'DELETE'))).status).toBe(204);
    expect(repository.subscribers.map((entry) => entry.email)).toEqual(['ciso@buyer.example']);
  });

  it('emails every active subscriber once on first publish and keeps private updates off the public snapshot', async () => {
    const { handler, emailSender } = setup();
    await handler(adminRequest('/api/admin/subscribers', { email: 'customer@buyer.example', shouldSkipEmailVerification: true }));
    await handler(adminRequest('/api/admin/subscribers', { email: 'analyst@buyer.example' }));

    const update = await read<{ resource: Json }>(await handler(adminRequest('/api/admin/resources/updates', {
      title: 'Incident notice', body: 'Details.', category: 'INCIDENT', visibilityType: 'PRIVATE'
    })));
    expect(update.resource).toMatchObject({ category: 'INCIDENT', visibilityType: 'PRIVATE', lifecycle: 'draft' });
    expect(update.resource).not.toHaveProperty('notificationTarget');
    const id = update.resource.id as string;
    expect((await handler(adminRequest(`/api/admin/resources/updates/${id}/notify-all-subscribers`))).status).toBe(404);

    await handler(adminRequest(`/api/admin/resources/updates/${id}/lifecycle`, { lifecycle: 'review' }));
    const published = await read<{ notified: number }>(await handler(adminRequest(`/api/admin/resources/updates/${id}/lifecycle`, { lifecycle: 'published' })));
    expect(published.notified).toBe(1);
    const sent = emailSender.sent.filter((email) => email.template === 'update-published');
    expect(sent.map((email) => email.to)).toEqual(['customer@buyer.example']);
    expect(sent[0]?.bodyText).toContain('/unsubscribe?token=');

    const publicSnapshotBody = await read<{ updates: unknown[] }>(await handler(new Request('https://trust.example/api/site')));
    expect(publicSnapshotBody.updates).toEqual([]);
  });
});

describe('viewers', () => {
  it('adds, lists, updates, and enforces NDA acceptance for viewers', async () => {
    const { handler, repository, emailSender } = setup();
    expect((await handler(adminRequest('/api/admin/viewers', { email: 'v@example.com', name: 'V', companyName: 'Co', isNdaRequired: true, accessLevel: 'PARTIAL_ACCESS' }))).status).toBe(400);
    const added = await read<Json>(await handler(adminRequest('/api/admin/viewers', { email: 'v@example.com', name: 'V', companyName: 'Co', isNdaRequired: true, accessLevel: 'PARTIAL_ACCESS', resourceIds: ['gated'] })));
    expect(added).toMatchObject({ accessLevel: 'PARTIAL_ACCESS', resourceIds: ['gated'], ndaInfo: { provider: 'ONE_CLICK', satisfiedDate: null }, accessUrl: 'https://trust.example/access?token=test-token-1' });
    expect(emailSender.sent[0]?.bodyText).toContain('confidentiality agreement');
    expect((await handler(adminRequest('/api/admin/viewers', { email: 'v@example.com', name: 'V', companyName: 'Co', isNdaRequired: false, accessLevel: 'FULL_ACCESS' }))).status).toBe(409);

    const locked = await read<{ documents: Array<{ accessible: boolean }> }>(await handler(new Request('https://trust.example/api/viewer/test-token-1')));
    expect(locked.documents[0]?.accessible).toBe(false);
    const blocked = await handler(new Request('https://trust.example/api/viewer/test-token-1/documents/gated'));
    expect(blocked.status).toBe(403);
    expect(await read(blocked)).toMatchObject({ ndaRequired: true });

    const accepted = await handler(new Request('https://trust.example/api/viewer/test-token-1/nda', { method: 'POST' }));
    expect(await read(accepted)).toEqual({ ok: true, ndaAcceptedAt: '2026-08-30T12:00:00.000Z' });
    expect((await handler(new Request('https://trust.example/api/viewer/test-token-1/documents/gated'))).status).toBe(302);
    expect(repository.audits).toContain('viewer.nda_accepted');

    const listed = await read<{ results: { data: Json[] } }>(await handler(adminRequest('/api/admin/viewers', undefined, 'GET')));
    expect(listed.results.data[0]).toMatchObject({ email: 'v@example.com', ndaInfo: { satisfiedDate: '2026-08-30T12:00:00.000Z' } });

    const updated = await read<Json>(await handler(adminRequest(`/api/admin/viewers/${added.id}`, { accessLevel: 'FULL_ACCESS', expirationDate: '2027-01-01T00:00:00.000Z', isNdaRequired: false }, 'PATCH')));
    expect(updated).toMatchObject({ accessLevel: 'FULL_ACCESS', resourceIds: null, expirationDate: '2027-01-01T00:00:00.000Z', ndaInfo: null });
    expect((await handler(adminRequest(`/api/admin/viewers/${added.id}`, { expirationDate: '2020-01-01T00:00:00.000Z' }, 'PATCH'))).status).toBe(400);

    await handler(adminRequest(`/api/admin/viewers/${added.id}`, undefined, 'DELETE'));
    const active = await read<{ results: { data: Json[] } }>(await handler(adminRequest('/api/admin/viewers', undefined, 'GET')));
    expect(active.results.data).toEqual([]);
    const all = await read<{ results: { data: Json[] } }>(await handler(adminRequest('/api/admin/viewers?includeRemoved=true', undefined, 'GET')));
    expect(all.results.data).toHaveLength(1);
  });
});

describe('chatbot', () => {
  it('answers questions from published content without an AI binding and stores conversations', async () => {
    const { handler, repository } = setup();
    repository.state.faqs.push({ id: 'hosting', question: 'Where is customer data hosted?', answer: 'Production data is hosted on Cloudflare in the United States.', categoryId: null, lifecycle: 'published', sortOrder: 1 });
    repository.state.faqs.push({ id: 'draft', question: 'Secret draft?', answer: 'Not published.', categoryId: null, lifecycle: 'draft', sortOrder: 2 });

    const first = await read<{ conversationId: string; reply: string; references: string[]; mode: string }>(await handler(jsonRequest('/api/chat', { message: 'Where is customer data hosted?' })));
    expect(first.mode).toBe('retrieval');
    expect(first.reply).toContain('hosted on Cloudflare');
    expect(first.references).toContain('faq:hosting');

    const second = await read<{ conversationId: string; reply: string }>(await handler(jsonRequest('/api/chat', { conversationId: first.conversationId, message: 'Secret draft?' })));
    expect(second.conversationId).toBe(first.conversationId);
    expect(second.reply).not.toContain('Not published');
    expect(second.reply).toContain('security@northstar.example');

    const list = await read<{ results: { data: Json[] } }>(await handler(adminRequest('/api/admin/chatbot/conversations?searchString=hosted', undefined, 'GET')));
    expect(list.results.data[0]).toMatchObject({ id: first.conversationId, numMessages: 4, isPublicConversation: true, userEmail: null });
    const messages = await read<{ results: Json[] }>(await handler(adminRequest(`/api/admin/chatbot/conversations/${first.conversationId}`, undefined, 'GET')));
    expect(messages.results.map((message) => message.role)).toEqual(['USER', 'ASSISTANT', 'USER', 'ASSISTANT']);
    expect((await handler(jsonRequest('/api/chat', { conversationId: 'missing', message: 'hi' }))).status).toBe(404);
  });

  it('uses the AI binding when present and falls back to retrieval when it fails', async () => {
    const state = fixtureState();
    state.faqs.push({ id: 'hosting', question: 'Where is data hosted?', answer: 'Cloudflare, US.', categoryId: null, lifecycle: 'published', sortOrder: 1 });
    const snapshot = publicSnapshot(state);
    const calls: unknown[] = [];
    const ai = { run: async (_model: string, input: Record<string, unknown>) => { calls.push(input); return { response: 'Data is hosted on Cloudflare in the US.' }; } };
    const answer = await answerQuestion({ question: 'Where is data hosted?', history: [], snapshot, ai });
    expect(answer).toMatchObject({ mode: 'ai', reply: 'Data is hosted on Cloudflare in the US.' });
    expect(answer.references[0]).toBe('faq:hosting');
    expect(JSON.stringify(calls[0])).toContain('Cloudflare, US.');
    const broken = { run: async () => { throw new Error('quota'); } };
    expect((await answerQuestion({ question: 'Where is data hosted?', history: [], snapshot, ai: broken })).mode).toBe('retrieval');
  });
});
