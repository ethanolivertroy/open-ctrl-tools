import type { APIRoute } from 'astro';
import { renderCrosswalkMarkdown } from '@/lib/markdown-renderer';

export const GET: APIRoute = () => {
  const body = renderCrosswalkMarkdown();
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
