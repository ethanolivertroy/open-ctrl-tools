import type { APIRoute } from 'astro';
import { renderGuidanceMarkdown } from '@/lib/markdown-renderer';

export const GET: APIRoute = () => {
  const body = renderGuidanceMarkdown();
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
