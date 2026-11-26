import { createApiHandler, createEmailSender, createWorkerServices, resolveAdmin, type WorkerEnv } from './worker-services';
import { D1Repository } from './d1-repository';
import { drainOutbox } from './email';
import { TrustCenterMCP } from './mcp';
import { isMcpPath } from './mcp-tools';

export { isMcpPath, TrustCenterMCP };

const mcpHandler = TrustCenterMCP.serve('/mcp', { binding: 'TRUST_CENTER_MCP' });

function withMcpProps(ctx: ExecutionContext, actor: string, origin: string): ExecutionContext {
  (ctx as ExecutionContext & { props?: { actor: string; origin: string } }).props = { actor, origin };
  return ctx;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (isMcpPath(url.pathname)) {
      const services = createWorkerServices(env, ctx);
      const admin = await resolveAdmin(request, services);
      if (!admin) {
        return new Response('Admin authentication required.', {
          status: 401,
          headers: {
            'www-authenticate': 'Bearer realm="mcp"',
            'cache-control': 'no-store'
          }
        });
      }
      return mcpHandler.fetch(request, env, withMcpProps(ctx, admin.actor, env.PUBLIC_BASE_URL ?? url.origin));
    }

    const workerOwned = url.pathname.startsWith('/api/') || url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml';
    if (!workerOwned) return env.ASSETS.fetch(request);
    return createApiHandler(env, ctx)(request);
  },

  async scheduled(_event: ScheduledController, env: WorkerEnv): Promise<void> {
    const sender = createEmailSender(env);
    if (!sender) return;
    await drainOutbox(new D1Repository(env.DB), sender, 100);
  }
} satisfies ExportedHandler<WorkerEnv>;
