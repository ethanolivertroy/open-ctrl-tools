import { describe, expect, it } from 'vitest';
import {
  canTransitionLifecycle,
  controlIsVisible,
  mergeSiteUpdate,
  normalizeControl,
  normalizeDataCollected,
  normalizeVideos,
  normalizeEmail,
  normalizeImportBundle,
  normalizeResource,
  parseLifecycleStatus,
  publicSnapshot,
  safeDocumentUrl,
  safePublicUrl,
  storedLogoKeyToDelete,
  validateSite,
  type SiteConfig,
  type TrustCenterState
} from '../src/domain';
import { fixtureSite, fixtureState, gatedDocument } from './support/memory-repository';

const state: TrustCenterState = {
  ...fixtureState(),
  certifications: [
    { id: 'visible', name: 'SOC 2 Type II', status: 'Current', description: 'Annual examination', standard: 'soc2', badgeObjectKey: 'badges/soc2.png', lifecycle: 'published', sortOrder: 1 },
    { id: 'hidden', name: 'Internal review', status: 'Draft', description: 'Not public', standard: null, badgeObjectKey: null, lifecycle: 'draft', sortOrder: 2 }
  ],
  documents: [
    gatedDocument({ id: 'public-doc', title: 'Security overview', description: 'Public summary', category: 'Security', visibility: 'public', url: 'https://example.com/security.pdf', version: '1.0' }),
    gatedDocument({ id: 'hidden-doc', title: 'Draft report', description: 'Private draft', sourceType: 'r2', url: null, objectKey: 'private/secret.pdf', version: 'draft', publishedAt: null, reviewAt: null, lifecycle: 'draft' })
  ],
  faqs: [
    { id: 'faq-1', question: 'Where is data hosted?', answer: 'In the United States.', categoryId: null, lifecycle: 'published', sortOrder: 1 },
    { id: 'faq-2', question: 'Awaiting review?', answer: 'Not yet public.', categoryId: null, lifecycle: 'review', sortOrder: 2 },
    { id: 'faq-3', question: 'Retired answer?', answer: 'No longer public.', categoryId: null, lifecycle: 'archived', sortOrder: 3 }
  ],
  updates: [
    { id: 'update-1', title: 'Annual review', body: 'Materials refreshed.', category: 'GENERAL', visibilityType: 'PUBLIC', publishedAt: '2026-08-30T00:00:00.000Z', lifecycle: 'published', notifiedAt: '2026-08-30T01:00:00.000Z' },
    { id: 'update-2', title: 'Private note', body: 'Viewers only.', category: 'INCIDENT', visibilityType: 'PRIVATE', publishedAt: '2026-08-31T00:00:00.000Z', lifecycle: 'published', notifiedAt: null }
  ]
};

describe('publicSnapshot', () => {
  it('removes unpublished records, private object keys, and gated external URLs', () => {
    const gatedExternal = gatedDocument({ id: 'gated-external', description: 'Available under NDA', url: 'https://documents.example.com/private/soc2.pdf' });
    const result = publicSnapshot({ ...state, documents: [...state.documents, gatedExternal] });

    expect(result.certifications.map((item) => item.id)).toEqual(['visible']);
    expect(result.documents.map((item) => item.id)).toEqual(['public-doc', 'gated-external']);
    expect(result.faqs.map((item) => item.id)).toEqual(['faq-1']);
    expect(result.documents[0]).not.toHaveProperty('objectKey');
    expect(result.documents[0]).not.toHaveProperty('lifecycle');
    expect(result.documents.find((item) => item.id === 'gated-external')).not.toHaveProperty('url');
    expect(result.documents.find((item) => item.id === 'gated-external')).toMatchObject({ accessible: false });
    expect(result.updates.map((item) => item.id)).toEqual(['update-1']);
    expect(result.updates[0]).not.toHaveProperty('notifiedAt');
    expect(result.updates[0]).not.toHaveProperty('notifiedAt');
    expect(result.site).not.toHaveProperty('logoObjectKey');
    expect(result.site).not.toHaveProperty('bannerObjectKey');
    expect(result.certifications[0]).toMatchObject({ standard: 'soc2', badgeUrl: '/api/certifications/visible/badge' });
    expect(result.certifications[0]).not.toHaveProperty('badgeObjectKey');
  });

  it('shows private updates and marks accessible documents for viewers', () => {
    const gatedExternal = gatedDocument({ id: 'gated-external', url: 'https://documents.example.com/private/soc2.pdf' });
    const full = publicSnapshot({ ...state, documents: [...state.documents, gatedExternal] }, { viewer: { accessLevel: 'FULL_ACCESS', resourceIds: null, ndaSatisfied: true } });
    expect(full.updates.map((item) => item.id)).toEqual(['update-2', 'update-1']);
    expect(full.documents.find((item) => item.id === 'gated-external')).toMatchObject({ accessible: true });
    expect(full.documents.find((item) => item.id === 'gated-external')).not.toHaveProperty('url');

    const partial = publicSnapshot({ ...state, documents: [...state.documents, gatedExternal] }, { viewer: { accessLevel: 'PARTIAL_ACCESS', resourceIds: ['other'], ndaSatisfied: true } });
    expect(partial.documents.find((item) => item.id === 'gated-external')).toMatchObject({ accessible: false });
    const nda = publicSnapshot({ ...state, documents: [...state.documents, gatedExternal] }, { viewer: { accessLevel: 'FULL_ACCESS', resourceIds: null, ndaSatisfied: false } });
    expect(nda.documents.find((item) => item.id === 'gated-external')).toMatchObject({ accessible: false });
  });
});

describe('control visibility', () => {
  it('applies each control visibility mode', () => {
    expect(controlIsVisible('NEEDS_ATTENTION', 'SHOW_OK_ONLY')).toBe(false);
    expect(controlIsVisible('UNMAPPED', 'SHOW_OK_ONLY')).toBe(false);
    expect(controlIsVisible('UNMAPPED', 'SHOW_OK_AND_UNMAPPED')).toBe(true);
    expect(controlIsVisible('NEEDS_ATTENTION', 'SHOW_OK_AND_UNMAPPED')).toBe(false);
    expect(controlIsVisible('NEEDS_ATTENTION', 'SHOW_ALL_WITHOUT_STATUS')).toBe(true);
    expect(controlIsVisible('NEEDS_ATTENTION', 'SHOW_ALL_WITH_STATUS')).toBe(true);
  });
});

describe('new record validators', () => {
  it('normalizes controls, videos, and data collected disclosures', () => {
    const control = normalizeControl({ name: 'MFA', status: 'OK', tags: { domain: ['identity', 'identity'] }, controlId: 'ext-123' }, 'c1', '2026-08-30T00:00:00.000Z');
    expect(control).toMatchObject({ externalId: 'ext-123', tags: { domain: ['identity'] }, status: 'OK' });
    expect(() => normalizeControl({ name: 'MFA', status: 'GREEN' }, 'c1', 'now')).toThrow('Control status');

    let next = 0;
    const videos = normalizeVideos([{ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Overview' }], () => `v${(next += 1)}`);
    expect(videos[0]).toMatchObject({ id: 'v1', sortOrder: 0 });
    expect(() => normalizeVideos([{ url: 'http://youtu.be/x', title: 'x' }], () => 'v')).toThrow('HTTPS');

    expect(() => normalizeDataCollected([{ dataCollected: 'Email', status: 'COLLECTED' }, { dataCollected: 'email', status: 'HIDDEN' }], () => 'd')).toThrow('Duplicate');
  });

  it('normalizes update category and visibility and rejects unknown categories', () => {
    const update = normalizeResource('updates', { title: 'T', body: 'B', category: 'SECURITY', visibilityType: 'PRIVATE' }, 'u1', '2026-08-30T00:00:00.000Z');
    expect(update).toMatchObject({ category: 'SECURITY', visibilityType: 'PRIVATE' });
    expect(update).not.toHaveProperty('notificationTarget');
    expect(() => normalizeResource('updates', { title: 'T', body: 'B', category: 'NEWS' }, 'u1', 'now')).toThrow('Update category');
  });
});

describe('validateSite', () => {
  const base: SiteConfig = {
    ...fixtureSite(),
    companyName: 'Acme',
    headline: 'Trust Acme',
    summary: 'Reviewed before publishing',
    securityEmail: 'security@acme.example'
  };

  it('validates privacy, banner, theme, and control visibility fields', () => {
    const site = validateSite({ ...base, isPublic: 'false', bannerSetting: 'GRADIENT', bannerStartColor: '#000000', secondaryColor: '#FFFFFF', controlVisibilityMode: 'SHOW_OK_ONLY', privacyPolicyUrl: 'https://acme.example/privacy' }, '2026-08-30T00:00:00.000Z');
    expect(site).toMatchObject({ isPublic: false, bannerSetting: 'GRADIENT', bannerStartColor: '#000000', secondaryColor: '#ffffff', controlVisibilityMode: 'SHOW_OK_ONLY' });
    expect(() => validateSite({ ...base, controlVisibilityMode: 'SHOW_NONE' }, 'now')).toThrow('Control visibility mode');
    expect(() => validateSite({ ...base, privacyPolicyUrl: 'ftp://x' }, 'now')).toThrow('HTTPS');
    expect(() => validateSite({ ...base, secondaryColor: 'red' }, 'now')).toThrow('Secondary color');
  });

  it('accepts an uploaded logo path or a public HTTPS image URL', () => {
    expect(validateSite({ ...base, logoUrl: '/api/logo', logoObjectKey: 'branding/logo.png' }, '2026-08-30T00:00:00.000Z').logoUrl).toBe('/api/logo');
    expect(validateSite({ ...base, logoUrl: 'https://cdn.example.com/logo.png' }, '2026-08-30T00:00:00.000Z').logoUrl).toBe('https://cdn.example.com/logo.png');
  });

  it('rejects a non-HTTPS logo URL', () => {
    expect(() => validateSite({ ...base, logoUrl: 'javascript:alert(1)' }, '2026-08-30T00:00:00.000Z')).toThrow('HTTPS URL');
  });

  it('keeps an uploaded logo when a profile patch sends an empty logoUrl', () => {
    const current: SiteConfig = {
      ...base,
      logoUrl: '/api/logo',
      logoObjectKey: 'branding/logo.png',
      updatedAt: '2026-08-30T00:00:00.000Z'
    };
    const merged = mergeSiteUpdate(current, { companyName: 'Harbor', logoUrl: '' });
    const site = validateSite(merged, '2026-09-01T00:00:00.000Z');
    expect(site.logoUrl).toBe('/api/logo');
    expect(site.logoObjectKey).toBe('branding/logo.png');
    expect(storedLogoKeyToDelete(current, site)).toBeNull();
  });

  it('clears a remote logo URL when logoUrl is empty', () => {
    const current: SiteConfig = {
      ...base,
      logoUrl: 'https://cdn.example.com/logo.png',
      logoObjectKey: null,
      updatedAt: '2026-08-30T00:00:00.000Z'
    };
    const site = validateSite(mergeSiteUpdate(current, { logoUrl: '' }), '2026-09-01T00:00:00.000Z');
    expect(site.logoUrl).toBe('');
    expect(site.logoObjectKey).toBeNull();
  });

  it('deletes the stored object only when the logo key actually changes', () => {
    const current: SiteConfig = {
      ...base,
      logoUrl: '/api/logo',
      logoObjectKey: 'branding/logo.png',
      updatedAt: '2026-08-30T00:00:00.000Z'
    };
    const remote = validateSite(mergeSiteUpdate(current, { logoUrl: 'https://cdn.example.com/logo.png' }), '2026-09-01T00:00:00.000Z');
    expect(remote.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(remote.logoObjectKey).toBeNull();
    expect(storedLogoKeyToDelete(current, remote)).toBe('branding/logo.png');
  });
});

describe('lifecycle transitions', () => {
  it('allows only the documented state machine moves', () => {
    expect(canTransitionLifecycle('draft', 'review')).toBe(true);
    expect(canTransitionLifecycle('review', 'published')).toBe(true);
    expect(canTransitionLifecycle('review', 'draft')).toBe(true);
    expect(canTransitionLifecycle('published', 'archived')).toBe(true);
    expect(canTransitionLifecycle('archived', 'draft')).toBe(true);
    expect(canTransitionLifecycle('draft', 'published')).toBe(false);
    expect(canTransitionLifecycle('published', 'draft')).toBe(false);
    expect(canTransitionLifecycle('archived', 'published')).toBe(false);
  });

  it('parses only known lifecycle values', () => {
    expect(parseLifecycleStatus('published')).toBe('published');
    expect(() => parseLifecycleStatus('visible')).toThrow('Lifecycle');
  });
});

describe('normalizeEmail', () => {
  it('normalizes a valid subscription email', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('rejects malformed email addresses', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow('valid email');
  });
});

describe('safePublicUrl', () => {
  it('allows public HTTPS URLs', () => {
    expect(safePublicUrl('https://docs.example.com/report.pdf')).toBe('https://docs.example.com/report.pdf');
  });

  it.each(['http://example.com', 'https://localhost/report', 'https://127.0.0.1/report', 'javascript:alert(1)'])(
    'rejects unsafe URL %s',
    (url) => expect(() => safePublicUrl(url)).toThrow('public HTTPS')
  );
});

describe('safeDocumentUrl', () => {
  it('allows a same-origin static asset path for bundled public documents', () => {
    expect(safeDocumentUrl('/demo/security-overview.txt')).toBe('/demo/security-overview.txt');
  });

  it.each(['//evil.example/report.pdf', '/../secret', '/api/admin/state'])(
    'rejects unsafe same-origin document path %s',
    (url) => expect(() => safeDocumentUrl(url)).toThrow('document URL')
  );
});

describe('normalizeImportBundle', () => {
  it('allows request-only external document records without a public URL', () => {
    const record = normalizeResource('documents', {
      title: 'SOC 2 report',
      description: 'Controlled report',
      category: 'Audit',
      visibility: 'request',
      sourceType: 'external',
      url: null,
      version: '2026',
      visible: true
    }, 'soc2', '2026-08-30T00:00:00Z');
    expect(record.url).toBeNull();
  });

  it('requires a URL for public external document records', () => {
    expect(() => normalizeResource('documents', {
      title: 'Public overview', visibility: 'public', sourceType: 'external', url: null
    }, 'overview', '2026-08-30T00:00:00Z')).toThrow('document URL');
  });

  it('requires review and strips unknown fields from a demonstration content bundle', () => {
    const result = normalizeImportBundle({
      source: 'manual',
      site: { companyName: 'Acme', headline: 'Trust Acme', summary: 'Reviewed before publishing', injected: 'drop me' },
      faqs: [{ question: 'Encrypted?', answer: 'Yes', visible: true, injected: 'drop me' }]
    });

    expect(result.requiresReview).toBe(true);
    expect(result.bundle.site.companyName).toBe('Acme');
    expect(result.bundle.site).not.toHaveProperty('injected');
    expect(result.bundle.faqs?.[0]).not.toHaveProperty('injected');
    expect(result.bundle.documents).toBeUndefined();
  });

  it('rejects imported public external documents without a safe URL', () => {
    expect(() => normalizeImportBundle({
      source: 'manual',
      site: { companyName: 'Acme', headline: 'Trust Acme', summary: 'Reviewed before publishing' },
      documents: [{ title: 'Public overview', visibility: 'public', url: null }]
    })).toThrow('document URL');
  });

  it('rejects invalid sort orders in a demonstration content bundle', () => {
    expect(() => normalizeImportBundle({
      source: 'manual',
      site: { companyName: 'Acme', headline: 'Trust Acme', summary: 'Reviewed before publishing' },
      certifications: [{ name: 'SOC 2', sortOrder: 1.5 }]
    })).toThrow('Sort order');
  });

  it('caps a demonstration content bundle so one reset cannot create an unbounded D1 batch', () => {
    const faqs = Array.from({ length: 201 }, (_, index) => ({
      question: `Question ${index}`,
      answer: `Answer ${index}`,
      visible: true,
      sortOrder: index
    }));
    expect(() => normalizeImportBundle({
      source: 'manual',
      site: { companyName: 'Acme', headline: 'Trust Acme', summary: 'Reviewed before publishing' },
      faqs
    })).toThrow(/200 records/);
  });

  it('accepts its reviewed preview for the explicit apply step', () => {
    const first = normalizeImportBundle({
      source: 'manual',
      site: { companyName: 'Acme', headline: 'Trust Acme', summary: 'Reviewed before publishing' },
      documents: [
        { title: 'Public overview', url: '/demo/security-overview.txt', visibility: 'public' },
        { title: 'SOC 2 report', url: null, visibility: 'request' }
      ]
    });
    expect(() => normalizeImportBundle(first.bundle)).not.toThrow();
  });
});
