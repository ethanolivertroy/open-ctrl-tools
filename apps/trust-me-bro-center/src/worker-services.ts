import { createAccessAuthenticator } from './access';
import { createHandler, resolveAdmin, type AppServices, type DocumentStore, type PublicRateLimiter, type StoredDocument, type TurnstileVerifier } from './app';
import type { AiBinding } from './chatbot';
import { D1Repository } from './d1-repository';
import { CloudflareEmailSender, ConsoleEmailSender, type EmailSender, type SendEmailBinding } from './email';

export interface WorkerEnv {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ASSETS: Fetcher;
  TRUST_CENTER_MCP?: DurableObjectNamespace;
  PUBLIC_FORM_LIMITER?: RateLimit;
  AI?: AiBinding;
  ADMIN_TOKEN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  EMAIL?: SendEmailBinding;
  EMAIL_FROM?: string;
  EMAIL_LOG_ONLY?: string;
  PUBLIC_BASE_URL?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  ACCESS_REQUEST_NOTIFY_EMAIL?: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function createTurnstileVerifier(secret: string, fetcher: typeof fetch = fetch): TurnstileVerifier {
  return async (token, remoteIp) => {
    const form = new FormData();
    form.set('secret', secret);
    form.set('response', token);
    if (remoteIp) form.set('remoteip', remoteIp);
    try {
      const response = await fetcher(TURNSTILE_VERIFY_URL, { method: 'POST', body: form });
      if (!response.ok) return false;
      const result = await response.json() as { success?: boolean };
      return result.success === true;
    } catch {
      return false;
    }
  };
}

export class BindingRateLimiter implements PublicRateLimiter {
  constructor(private readonly binding: RateLimit) {}

  async allow(key: string): Promise<boolean> {
    try {
      const outcome = await this.binding.limit({ key });
      return outcome.success;
    } catch (error) {
      // A limiter outage should not take the public forms down with it.
      console.error(JSON.stringify({ context: 'rate_limit', error: error instanceof Error ? error.name : 'UnknownError' }));
      return true;
    }
  }
}

export class R2DocumentStore implements DocumentStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { uploadedBy: 'trust-me-bro-center' }
    });
  }

  async get(key: string): Promise<StoredDocument | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? 'application/octet-stream'
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}

export function createEmailSender(env: WorkerEnv): EmailSender | undefined {
  if (env.EMAIL_LOG_ONLY === 'true') return new ConsoleEmailSender();
  if (env.EMAIL && env.EMAIL_FROM) return new CloudflareEmailSender(env.EMAIL, env.EMAIL_FROM);
  return undefined;
}

export function createWorkerServices(env: WorkerEnv, ctx?: ExecutionContext): AppServices {
  // Both keys are needed: the secret to verify, the site key so the page can render the widget.
  const turnstileEnabled = Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY);
  return {
    repository: new D1Repository(env.DB),
    documents: new R2DocumentStore(env.DOCUMENTS),
    adminToken: env.ADMIN_TOKEN ?? '',
    authenticate: env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD
      ? createAccessAuthenticator({ teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD })
      : undefined,
    emailSender: createEmailSender(env),
    ai: env.AI,
    waitUntil: ctx ? (promise) => ctx.waitUntil(promise) : undefined,
    baseUrl: env.PUBLIC_BASE_URL,
    rateLimiter: env.PUBLIC_FORM_LIMITER ? new BindingRateLimiter(env.PUBLIC_FORM_LIMITER) : undefined,
    verifyTurnstile: turnstileEnabled ? createTurnstileVerifier(env.TURNSTILE_SECRET_KEY as string) : undefined,
    turnstileSiteKey: turnstileEnabled ? env.TURNSTILE_SITE_KEY : undefined,
    notifyEmail: env.ACCESS_REQUEST_NOTIFY_EMAIL?.trim() || undefined
  };
}

export function createApiHandler(env: WorkerEnv, ctx: ExecutionContext) {
  return createHandler(createWorkerServices(env, ctx));
}

export { resolveAdmin };
