import { describe, expect, it } from 'vitest';
import { resolveSafeBaseUrl } from '../base-url-guard';
import { getDefaultBaseUrl } from '../providers';

describe('resolveSafeBaseUrl', () => {
  it('rejects custom endpoints when no user API key is supplied', () => {
    for (const provider of ['openrouter', 'grok', 'anthropic'] as const) {
      const result = resolveSafeBaseUrl(provider, undefined, 'https://evil.example/v1');
      expect(result.ok).toBe(false);
    }
  });

  it('rejects custom endpoints when user API key is whitespace-only', () => {
    const result = resolveSafeBaseUrl('openrouter', '   ', 'https://evil.example/v1');
    expect(result.ok).toBe(false);
  });

  it('rejects URL credential, query, hash, and path spoofing with server credentials', () => {
    const openrouterDefault = getDefaultBaseUrl('openrouter') ?? 'https://openrouter.ai/api/v1';
    const parsed = new URL(openrouterDefault);
    const withUserinfo = `${parsed.protocol}//user@${parsed.host}${parsed.pathname}`;

    for (const candidate of [
      withUserinfo,
      `${openrouterDefault}?foo=bar`,
      `${openrouterDefault}#fragment`,
      `${openrouterDefault}/extra`,
    ]) {
      const result = resolveSafeBaseUrl('openrouter', undefined, candidate);
      expect(result.ok).toBe(false);
    }
  });

  it('allows matching default baseUrl and normalizes it to undefined for server credentials', () => {
    const openrouterDefault = getDefaultBaseUrl('openrouter') ?? 'https://openrouter.ai/api/v1';
    expect(resolveSafeBaseUrl('openrouter', undefined, openrouterDefault)).toEqual({
      ok: true,
      baseUrl: undefined,
    });
    expect(resolveSafeBaseUrl('openrouter', undefined, `${openrouterDefault}/`)).toEqual({
      ok: true,
      baseUrl: undefined,
    });
  });

  it('allows omitted baseUrl without user API key', () => {
    expect(resolveSafeBaseUrl('grok', undefined, undefined)).toEqual({
      ok: true,
      baseUrl: undefined,
    });
  });

  it('allows custom baseUrl when a user-supplied BYOK key is provided', () => {
    const customUrl = 'https://proxy.corp.example/v1';
    expect(resolveSafeBaseUrl('openrouter', 'sk-or-user-key', customUrl)).toEqual({
      ok: true,
      baseUrl: customUrl,
    });
  });
});
