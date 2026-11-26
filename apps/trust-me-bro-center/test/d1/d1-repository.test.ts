import { beforeEach, describe, expect, it } from 'vitest';
import { bindings } from './bindings';
import { D1Repository } from '../../src/d1-repository';
import { ConflictError, NotFoundError, type AccessRequestRecord, type ViewerRecord } from '../../src/domain';
import { MAX_EMAIL_ATTEMPTS, type OutgoingEmail } from '../../src/email';

const NOW = '2026-08-30T12:00:00.000Z';
const CONFIRM_EXPIRES = '2026-09-01T12:00:00.000Z';

function repo() {
  return new D1Repository(bindings.DB);
}

function letter(to: string, template = 'test-letter'): OutgoingEmail {
  return { to, subject: `Subject for ${to}`, bodyText: 'Body', template, headers: { 'List-Unsubscribe': '<https://trust.example/unsubscribe?token=x>' } };
}

function accessRequest(overrides: Partial<AccessRequestRecord> = {}): AccessRequestRecord {
  return {
    id: 'request-1', name: 'Avery', email: 'avery@example.com', company: 'Buyer Co', reason: 'Review',
    requestedResources: ['soc2-report'], accessLevel: 'PARTIAL_ACCESS', status: 'pending', denialReason: null,
    createdAt: NOW, updatedAt: NOW, ...overrides
  };
}

function viewer(overrides: Partial<ViewerRecord> = {}): ViewerRecord {
  return {
    id: 'viewer-1', email: 'avery@example.com', name: 'Avery', companyName: 'Buyer Co', accessLevel: 'PARTIAL_ACCESS',
    resourceIds: ['soc2-report'], ndaRequired: false, ndaAcceptedAt: null, expiresAt: '2026-09-06T12:00:00.000Z',
    tokenHash: 'token-hash', addedBy: 'casey@example.com', accessRequestId: 'request-1', inviteSentAt: NOW,
    createdAt: NOW, updatedAt: NOW, removedAt: null, ...overrides
  };
}

async function subscribeActive(repository: D1Repository, email: string, id: string) {
  const outcome = await repository.requestSubscription({
    email,
    confirmTokenHash: `hash-${id}`,
    confirmExpiresAt: CONFIRM_EXPIRES,
    unsubscribeToken: `unsub-${id}`,
    createdAt: NOW
  }, letter(email, 'subscription-confirm'), '2026-09-01T11:50:00.000Z');
  expect(outcome).toBe('pending');
  expect(await repository.confirmSubscription(`hash-${id}`, NOW)).toBe(true);
}

describe('D1Repository against local D1', () => {
  // The whole file shares one migrated database, so each test starts from empty
  // operational tables while the seeded demo content stays in place.
  beforeEach(async () => {
    await bindings.DB.batch([
      bindings.DB.prepare('DELETE FROM viewers'),
      bindings.DB.prepare('DELETE FROM access_requests'),
      bindings.DB.prepare('DELETE FROM subscribers'),
      bindings.DB.prepare('DELETE FROM email_outbox'),
      bindings.DB.prepare('DELETE FROM audit_log'),
      bindings.DB.prepare("DELETE FROM updates WHERE id = 'update-1'")
    ]);
  });

  it('serves the migrated demo dataset with published-only public state and admin totals', async () => {
    const repository = repo();
    const publicState = await repository.getPublicState();
    expect(publicState.site.companyName).toBe('Northstar Labs');
    expect(publicState.documents.length).toBeGreaterThan(0);
    expect(publicState.documents.every((document) => document.lifecycle === 'published')).toBe(true);
    expect(publicState.documents.every((document) => !('objectKey' in document) || document.objectKey === null)).toBe(true);
    // Migrations seed no controls; those only arrive through the demo import.
    expect(publicState.controlCategories).toEqual([]);

    const adminState = await repository.getAdminState();
    expect(adminState.totals).toEqual({ subscribers: 0, activeSubscribers: 0, accessRequests: 0, pendingAccessRequests: 0 });
    expect(adminState.emailOutbox).toEqual([]);
    expect(adminState.viewers).toEqual([]);
  });

  it('runs the subscription lifecycle: pending, throttled resend, confirm, list, delete', async () => {
    const repository = repo();
    const request = (hash: string, unsub: string) => ({
      email: 'person@example.com',
      confirmTokenHash: hash,
      confirmExpiresAt: CONFIRM_EXPIRES,
      unsubscribeToken: unsub,
      createdAt: NOW
    });

    expect(await repository.requestSubscription(request('hash-1', 'unsub-1'), letter('person@example.com'), '2026-09-01T11:50:00.000Z')).toBe('pending');
    // Same address inside the cooldown: the existing confirmation is newer than the threshold.
    expect(await repository.requestSubscription(request('hash-2', 'unsub-2'), letter('person@example.com'), '2026-09-01T11:50:00.000Z')).toBe('throttled');
    // Outside the cooldown a fresh token replaces the old one and a second letter is queued.
    expect(await repository.requestSubscription(request('hash-3', 'unsub-3'), letter('person@example.com'), '2026-09-01T12:00:01.000Z')).toBe('pending');

    const queued = await repository.listSendableEmails(10);
    expect(queued).toHaveLength(2);
    expect(queued[0]?.headers).toEqual({ 'List-Unsubscribe': '<https://trust.example/unsubscribe?token=x>' });

    expect(await repository.confirmSubscription('hash-1', NOW)).toBe(false);
    expect(await repository.confirmSubscription('hash-3', '2026-09-02T00:00:00.000Z')).toBe(false);
    expect(await repository.confirmSubscription('hash-3', NOW)).toBe(true);
    expect(await repository.confirmSubscription('hash-3', NOW)).toBe(false);
    expect(await repository.requestSubscription(request('hash-4', 'unsub-4'), letter('person@example.com'), '2026-09-01T11:50:00.000Z')).toBe('active');

    const active = await repository.listActiveSubscribers();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ email: 'person@example.com', unsubscribeToken: 'unsub-3' });

    const all = await repository.listSubscribers();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ email: 'person@example.com', status: 'active', createdAt: NOW, confirmedAt: NOW });

    expect(await repository.unsubscribe('unsub-3', NOW)).toBe(true);
    expect(await repository.unsubscribe('unsub-3', NOW)).toBe(true);
    expect(await repository.unsubscribe('unknown', NOW)).toBe(false);
    expect((await repository.listSubscribers())[0]?.status).toBe('unsubscribed');

    const subscriberId = all[0]?.id ?? '';
    await repository.deleteSubscriber(subscriberId, 'admin');
    expect(await repository.listSubscribers()).toEqual([]);
    await expect(repository.deleteSubscriber(subscriberId, 'admin')).rejects.toBeInstanceOf(NotFoundError);

    const audit = (await repository.getAdminState()).auditLog.map((row) => row.action);
    expect(audit).toEqual(expect.arrayContaining(['subscriber.confirmed', 'subscriber.unsubscribed', 'subscriber.deleted']));
  });

  it('lets admins add subscribers as pending or already verified and lists active ones first', async () => {
    const repository = repo();
    const pending = await repository.createSubscriber({
      id: 'sub-pending', email: 'pending@example.com', verified: false, confirmTokenHash: 'hash-p', confirmExpiresAt: CONFIRM_EXPIRES,
      unsubscribeToken: 'unsub-p', createdAt: NOW
    }, letter('pending@example.com', 'subscription-confirm'), 'admin');
    expect(pending).toMatchObject({ email: 'pending@example.com', status: 'pending', confirmedAt: null });

    const verified = await repository.createSubscriber({
      id: 'sub-verified', email: 'verified@example.com', verified: true, confirmTokenHash: null, confirmExpiresAt: null,
      unsubscribeToken: 'unsub-v', createdAt: '2026-08-31T00:00:00.000Z'
    }, null, 'admin');
    expect(verified).toMatchObject({ email: 'verified@example.com', status: 'active', confirmedAt: '2026-08-31T00:00:00.000Z' });
    await expect(repository.createSubscriber({
      id: 'sub-dup', email: 'verified@example.com', verified: true, confirmTokenHash: null, confirmExpiresAt: null, unsubscribeToken: 'unsub-d', createdAt: NOW
    }, null, 'admin')).rejects.toBeInstanceOf(ConflictError);

    expect((await repository.listSubscribers()).map((row) => row.email)).toEqual(['verified@example.com', 'pending@example.com']);
    expect((await repository.getAdminState()).emailOutbox.map((row) => row.template)).toEqual(['subscription-confirm']);
    expect(await repository.getSubscriber('sub-verified')).toMatchObject({ email: 'verified@example.com' });
    expect(await repository.getSubscriber('missing')).toBeNull();
  });

  it('deduplicates pending access requests and queues the security alert atomically', async () => {
    const repository = repo();
    const alert = letter('security@northstar.example', 'access-request-notification');
    expect(await repository.createAccessRequest(accessRequest(), alert)).toEqual({ id: 'request-1', created: true });
    expect(await repository.createAccessRequest(accessRequest({ id: 'request-2' }), alert)).toEqual({ id: 'request-1', created: false });
    // A different set of resources from the same person is a separate request.
    expect(await repository.createAccessRequest(accessRequest({ id: 'request-3', requestedResources: ['penetration-test'] }))).toEqual({ id: 'request-3', created: true });
    expect(await repository.createAccessRequest(accessRequest({ id: 'request-4', requestedResources: null, accessLevel: 'FULL_ACCESS' }), alert)).toEqual({ id: 'request-4', created: true });

    const state = await repository.getAdminState();
    expect(state.totals).toMatchObject({ accessRequests: 3, pendingAccessRequests: 3 });
    expect(state.emailOutbox.filter((row) => row.template === 'access-request-notification')).toHaveLength(2);

    expect(await repository.getAccessRequest('request-1')).toMatchObject({ id: 'request-1', requestedResources: ['soc2-report'], email: 'avery@example.com', status: 'pending' });
    expect(await repository.getAccessRequest('request-4')).toMatchObject({ requestedResources: null, accessLevel: 'FULL_ACCESS' });
    expect(await repository.getAccessRequest('missing')).toBeNull();
  });

  it('orders pending access requests ahead of decided ones in admin state', async () => {
    const repository = repo();
    for (let index = 0; index < 5; index += 1) {
      await repository.createAccessRequest(accessRequest({
        id: `request-${index}`, email: `person${index}@example.com`, reason: '', createdAt: `2026-08-3${index}T00:00:00.000Z`, updatedAt: `2026-08-3${index}T00:00:00.000Z`
      }));
    }
    await repository.denyAccessRequest('request-4', 'Not an active evaluation', 'admin', NOW);
    await repository.denyAccessRequest('request-3', null, 'admin', NOW);
    await expect(repository.denyAccessRequest('request-3', null, 'admin', NOW)).rejects.toBeInstanceOf(ConflictError);
    await expect(repository.denyAccessRequest('missing', null, 'admin', NOW)).rejects.toBeInstanceOf(NotFoundError);

    const state = await repository.getAdminState();
    expect(state.accessRequests.map((row) => row.id)).toEqual(['request-2', 'request-1', 'request-0', 'request-4', 'request-3']);
    expect(state.accessRequests[3]).toMatchObject({ status: 'denied', denialReason: 'Not an active evaluation' });
    expect(state.totals).toMatchObject({ accessRequests: 5, pendingAccessRequests: 3 });
    expect((await repository.listAccessRequests()).map((row) => row.id)).toEqual(['request-2', 'request-1', 'request-0', 'request-4', 'request-3']);
  });

  it('approves with a viewer, resolves the viewer by token, and refuses to remove twice', async () => {
    const repository = repo();
    await repository.createAccessRequest(accessRequest());
    const granted = await repository.approveAccessRequest('request-1', viewer(), letter('avery@example.com', 'viewer-access'), 'casey@example.com', NOW);
    expect(granted).toMatchObject({ id: 'viewer-1', email: 'avery@example.com', resourceIds: ['soc2-report'], tokenHash: 'token-hash' });

    expect((await repository.getAccessRequest('request-1'))?.status).toBe('approved');
    await expect(repository.approveAccessRequest('request-1', viewer(), letter('avery@example.com'), 'admin', NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(await repository.getViewerByTokenHash('token-hash')).toMatchObject({ id: 'viewer-1', removedAt: null });
    expect(await repository.getViewerByTokenHash('other')).toBeNull();
    expect(await repository.getViewerByEmail('avery@example.com')).toMatchObject({ id: 'viewer-1' });

    // Re-adding the same email updates the viewer in place instead of creating a second row.
    const widened = await repository.saveViewer(viewer({ id: 'viewer-2', accessLevel: 'FULL_ACCESS', resourceIds: null, tokenHash: 'rotated-hash', ndaRequired: true }), letter('avery@example.com', 'viewer-access'), 'admin', 'viewer.updated');
    expect(widened).toMatchObject({ id: 'viewer-1', accessLevel: 'FULL_ACCESS', resourceIds: null, ndaRequired: true });
    expect(await repository.listViewers(false)).toHaveLength(1);

    await repository.acceptViewerNda('viewer-1', '2026-08-31T00:00:00.000Z');
    await repository.acceptViewerNda('viewer-1', '2026-09-01T00:00:00.000Z');
    expect((await repository.getViewer('viewer-1'))?.ndaAcceptedAt).toBe('2026-08-31T00:00:00.000Z');

    await repository.removeViewer('viewer-1', 'casey@example.com', '2026-08-31T01:00:00.000Z');
    expect(await repository.getViewerByTokenHash('rotated-hash')).toBeNull();
    expect((await repository.getViewer('viewer-1'))?.removedAt).toBe('2026-08-31T01:00:00.000Z');
    expect(await repository.listViewers(false)).toEqual([]);
    expect(await repository.listViewers(true)).toHaveLength(1);
    await expect(repository.removeViewer('viewer-1', 'casey@example.com', NOW)).rejects.toBeInstanceOf(NotFoundError);

    const state = await repository.getAdminState();
    expect(state.emailOutbox.map((row) => row.template)).toEqual(['viewer-access', 'viewer-access']);
    const actors = state.auditLog.filter((row) => ['viewer.granted', 'viewer.removed'].includes(String(row.action))).map((row) => row.actor);
    expect(actors).toEqual(['casey@example.com', 'casey@example.com']);
  });

  it('notifies active subscribers once when an update is first published', async () => {
    const repository = repo();
    await subscribeActive(repository, 'one@example.com', 'one');
    await subscribeActive(repository, 'two@example.com', 'two');
    const subscribers = await repository.listActiveSubscribers();

    await repository.createResource('updates', { id: 'update-1', title: 'New pen test', body: 'Summary.', category: 'SECURITY', visibilityType: 'PUBLIC', publishedAt: NOW }, 'admin');
    expect((await repository.getResource('updates', 'update-1'))?.lifecycle).toBe('draft');
    expect(await repository.setResourceLifecycle('updates', 'update-1', 'review', 'admin')).toBe(0);

    const notify = {
      emails: subscribers.map((subscriber) => letter(subscriber.email, 'update-published')),
      notifiedAt: NOW,
      unsubscribeTokens: subscribers.map((subscriber) => ({ id: subscriber.id, token: `rotated-${subscriber.id}` }))
    };
    expect(await repository.setResourceLifecycle('updates', 'update-1', 'published', 'admin', notify)).toBe(2);
    expect(await repository.setResourceLifecycle('updates', 'update-1', 'published', 'admin', notify)).toBe(0);
    await expect(repository.setResourceLifecycle('updates', 'missing', 'published', 'admin')).rejects.toBeInstanceOf(NotFoundError);

    const state = await repository.getAdminState();
    expect(state.emailOutbox.filter((row) => row.template === 'update-published')).toHaveLength(2);
    expect(state.updates.find((update) => update.id === 'update-1')).toMatchObject({ lifecycle: 'published', notifiedAt: NOW });
    expect(state.auditLog.filter((row) => row.action === 'update.notified')).toHaveLength(1);
    // Existing unsubscribe tokens are kept; the rotation only fills empty ones.
    expect((await repository.listActiveSubscribers()).map((subscriber) => subscriber.unsubscribeToken).sort()).toEqual(['unsub-one', 'unsub-two']);
    expect((await repository.getPublicState()).updates.some((update) => update.id === 'update-1')).toBe(true);
  });

  it('claims outbox rows exactly once, marks exhausted rows failed, and lets an admin retry them', async () => {
    const repository = repo();
    await repository.createAccessRequest(accessRequest({ reason: '' }), letter('security@northstar.example', 'access-request-notification'));
    const [pending] = await repository.listSendableEmails(10);
    if (!pending) throw new Error('expected a queued email');

    expect(await repository.claimEmail(pending.id, 0)).toBe(true);
    expect(await repository.claimEmail(pending.id, 0)).toBe(false);
    expect(await repository.listSendableEmails(10)).toEqual([]);
    await repository.markEmailFailed(pending.id, 'provider down', false);
    expect((await repository.listSendableEmails(10))[0]).toMatchObject({ id: pending.id, attempts: 1 });

    for (let attempt = 1; attempt < MAX_EMAIL_ATTEMPTS; attempt += 1) {
      expect(await repository.claimEmail(pending.id, attempt)).toBe(true);
      await repository.markEmailFailed(pending.id, 'provider down', attempt + 1 >= MAX_EMAIL_ATTEMPTS);
    }
    expect(await repository.listSendableEmails(10)).toEqual([]);
    let row = (await repository.getAdminState()).emailOutbox[0];
    expect(row).toMatchObject({ status: 'failed', attempts: MAX_EMAIL_ATTEMPTS, last_error: 'provider down' });

    await repository.retryEmail(pending.id, 'admin');
    row = (await repository.getAdminState()).emailOutbox[0];
    expect(row).toMatchObject({ status: 'pending', attempts: 0, last_error: null });
    expect((await repository.listSendableEmails(10)).map((email) => email.id)).toEqual([pending.id]);
    await expect(repository.retryEmail(pending.id, 'admin')).rejects.toBeInstanceOf(NotFoundError);
    // The rejected retry leaves no audit trace behind.
    expect((await repository.getAdminState()).auditLog.filter((row) => row.action === 'email.retried')).toHaveLength(1);

    expect(await repository.claimEmail(pending.id, 0)).toBe(true);
    await repository.markEmailSent(pending.id, NOW);
    expect((await repository.getAdminState()).emailOutbox[0]).toMatchObject({ status: 'sent', sent_at: NOW });
  });

  it('replaces content wholesale with applyImport and updates the public profile', async () => {
    const repository = repo();
    const current = await repository.getSiteConfig();
    await repository.updateSite({
      ...current, companyName: 'Acme Security', headline: 'Trust, without the suite.', summary: 'A focused trust center.',
      securityEmail: 'security@acme.example', location: 'Germany', updatedAt: NOW
    }, 'admin');
    expect(await repository.getSiteConfig()).toMatchObject({ companyName: 'Acme Security', location: 'Germany', updatedAt: NOW });

    await repository.applyImport({
      source: 'manual',
      site: { companyName: 'Imported Co', headline: 'Imported headline', summary: 'Imported summary.' },
      certifications: [{ id: 'iso', name: 'ISO 27001', status: 'Certified', description: '', sortOrder: 1 }],
      documents: [],
      faqs: [{ id: 'faq', question: 'Encrypted?', answer: 'Yes.', sortOrder: 1, visible: false }],
      subprocessors: [],
      updates: [],
      controlCategories: [{ name: 'Encryption', controls: [{ name: 'Data encrypted at rest', description: 'AES-256.', status: 'OK' }] }]
    }, 'admin');

    // Imports mint fresh ids; the content is what carries over.
    const publicState = await repository.getPublicState();
    expect(publicState.site).toMatchObject({ companyName: 'Imported Co', location: 'Germany', securityEmail: 'security@acme.example' });
    expect(publicState.certifications.map((item) => item.name)).toEqual(['ISO 27001']);
    expect(publicState.documents).toEqual([]);
    expect(publicState.faqs).toEqual([]);
    expect(publicState.controlCategories.map((category) => category.name)).toEqual(['Encryption']);
    const adminState = await repository.getAdminState();
    expect(adminState.faqs.map((item) => [item.question, item.lifecycle])).toEqual([['Encrypted?', 'draft']]);
    expect(adminState.auditLog.map((row) => row.action)).toContain('import.applied');
  });
});
