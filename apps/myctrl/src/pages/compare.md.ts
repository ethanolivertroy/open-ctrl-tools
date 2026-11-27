import type { APIRoute } from 'astro';
import { renderCompareMarkdown } from '@/lib/markdown-renderer';

export const GET: APIRoute = () => {
  const body = renderCompareMarkdown();
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
