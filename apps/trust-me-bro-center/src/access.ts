export interface AccessConfig {
  teamDomain: string;
  aud: string;
}

interface AccessIdentity {
  actor: string;
}

interface AccessJwk extends JsonWebKey {
  kid?: string;
}

const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_RETRY_MS = 60 * 1000;

interface JwksCacheEntry {
  fetchedAt: number;
  keys: Map<string, CryptoKey>;
}

const jwksCache = new Map<string, JwksCacheEntry>();

export function clearAccessJwksCache(): void {
  jwksCache.clear();
}

export function normalizeTeamDomain(teamDomain: string): string {
  const trimmed = teamDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const host = trimmed.includes('.') ? trimmed : `${trimmed}.cloudflareaccess.com`;
  return `https://${host}`;
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function loadKeys(issuer: string, fetcher: typeof fetch, forceRefresh: boolean): Promise<Map<string, CryptoKey>> {
  const cached = jwksCache.get(issuer);
  const maxAge = forceRefresh ? JWKS_RETRY_MS : JWKS_TTL_MS;
  if (cached && Date.now() - cached.fetchedAt < maxAge) return cached.keys;
  const response = await fetcher(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certificate download failed (${response.status})`);
  const body = await response.json() as { keys?: AccessJwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue;
    try {
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      keys.set(jwk.kid, key);
    } catch {
    }
  }
  jwksCache.set(issuer, { fetchedAt: Date.now(), keys });
  return keys;
}

const CLOCK_SKEW_SECONDS = 30;

export function createAccessAuthenticator(
  config: AccessConfig,
  fetcher: typeof fetch = fetch
): (request: Request) => Promise<AccessIdentity | null> {
  const issuer = normalizeTeamDomain(config.teamDomain);
  return async (request: Request): Promise<AccessIdentity | null> => {
    const assertion = request.headers.get('cf-access-jwt-assertion');
    if (!assertion) return null;
    const segments = assertion.split('.');
    const [headerSegment, payloadSegment, signatureSegment] = segments;
    if (segments.length !== 3 || !headerSegment || !payloadSegment || !signatureSegment) return null;

    const header = decodeJsonSegment(headerSegment);
    const payload = decodeJsonSegment(payloadSegment);
    if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.iss !== issuer) return null;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(config.aud)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds - CLOCK_SKEW_SECONDS) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > nowSeconds + CLOCK_SKEW_SECONDS) return null;

    try {
      let keys = await loadKeys(issuer, fetcher, false);
      if (!keys.has(header.kid)) keys = await loadKeys(issuer, fetcher, true);
      const key = keys.get(header.kid);
      if (!key) return null;
      const signature = decodeBase64Url(signatureSegment);
      const data = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
      const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, data);
      if (!valid) return null;
    } catch {
      return null;
    }

    const email = typeof payload.email === 'string' && payload.email ? payload.email : null;
    const serviceName = typeof payload.common_name === 'string' && payload.common_name ? payload.common_name : null;
    const subject = typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
    const actor = email ?? serviceName ?? subject;
    return actor ? { actor: actor.slice(0, 120) } : null;
  };
}
