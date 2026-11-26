import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccessJwksCache, createAccessAuthenticator, normalizeTeamDomain } from '../src/access';

function base64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSegment(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function createKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;
}

async function signToken(privateKey: CryptoKey, header: Record<string, unknown>, payload: Record<string, unknown>): Promise<string> {
  const unsigned = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

const TEAM = 'example-team';
const ISSUER = 'https://example-team.cloudflareaccess.com';
const AUD = 'aud-1234';

async function buildFixture() {
  const { privateKey, publicKey } = await createKeyPair();
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'test-key' };
  let certRequests = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    certRequests += 1;
    expect(String(input)).toBe(`${ISSUER}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const authenticate = createAccessAuthenticator({ teamDomain: TEAM, aud: AUD }, fetcher);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const claims = (overrides: Record<string, unknown> = {}) => ({
    iss: ISSUER,
    aud: [AUD],
    email: 'casey@example.com',
    sub: 'user-1',
    iat: nowSeconds,
    exp: nowSeconds + 300,
    ...overrides
  });
  return { privateKey, authenticate, claims, requestCount: () => certRequests };
}

function withAssertion(token: string): Request {
  return new Request('https://trust.example/api/admin/state', { headers: { 'cf-access-jwt-assertion': token } });
}

describe('createAccessAuthenticator', () => {
  beforeEach(() => clearAccessJwksCache());

  it('accepts a valid Access assertion and returns the email as actor', async () => {
    const { privateKey, authenticate, claims, requestCount } = await buildFixture();
    const token = await signToken(privateKey, { alg: 'RS256', kid: 'test-key' }, claims());

    expect(await authenticate(withAssertion(token))).toEqual({ actor: 'casey@example.com' });
    expect(await authenticate(withAssertion(token))).toEqual({ actor: 'casey@example.com' });
    expect(requestCount()).toBe(1);
  });

  it('falls back to the service token common name when no email claim exists', async () => {
    const { privateKey, authenticate, claims } = await buildFixture();
    const token = await signToken(privateKey, { alg: 'RS256', kid: 'test-key' }, claims({ email: undefined, common_name: 'ci-service-token' }));

    expect(await authenticate(withAssertion(token))).toEqual({ actor: 'ci-service-token' });
  });

  it.each([
    ['wrong audience', { aud: ['other-app'] }],
    ['wrong issuer', { iss: 'https://attacker.cloudflareaccess.com' }],
    ['expired token', { exp: Math.floor(Date.now() / 1000) - 3600 }]
  ])('rejects an assertion with %s', async (_label, overrides) => {
    const { privateKey, authenticate, claims } = await buildFixture();
    const token = await signToken(privateKey, { alg: 'RS256', kid: 'test-key' }, claims(overrides));

    expect(await authenticate(withAssertion(token))).toBeNull();
  });

  it('rejects tampered payloads and unknown signing keys', async () => {
    const { privateKey, authenticate, claims } = await buildFixture();
    const token = await signToken(privateKey, { alg: 'RS256', kid: 'test-key' }, claims());
    const [header, , signature] = token.split('.');
    const forged = `${header}.${encodeSegment(claims({ email: 'attacker@example.com' }))}.${signature}`;
    expect(await authenticate(withAssertion(forged))).toBeNull();

    const { privateKey: otherKey } = await createKeyPair();
    const unknownKid = await signToken(otherKey, { alg: 'RS256', kid: 'other-key' }, claims());
    expect(await authenticate(withAssertion(unknownKid))).toBeNull();

    expect(await authenticate(withAssertion('not-a-jwt'))).toBeNull();
    expect(await authenticate(new Request('https://trust.example/api/admin/state'))).toBeNull();
  });
});

describe('normalizeTeamDomain', () => {
  it('expands bare team names and strips protocols', () => {
    expect(normalizeTeamDomain('example-team')).toBe('https://example-team.cloudflareaccess.com');
    expect(normalizeTeamDomain('https://example-team.cloudflareaccess.com/')).toBe('https://example-team.cloudflareaccess.com');
    expect(normalizeTeamDomain('Example-Team.cloudflareaccess.com')).toBe('https://example-team.cloudflareaccess.com');
  });
});
