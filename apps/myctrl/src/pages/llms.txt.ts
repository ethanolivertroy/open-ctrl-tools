import type { APIRoute } from 'astro';
import { renderLlmsTxt } from '@/lib/markdown-renderer';

export const GET: APIRoute = () => {
  const body = renderLlmsTxt();
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
