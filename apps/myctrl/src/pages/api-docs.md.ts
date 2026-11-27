import type { APIRoute } from 'astro';
import { renderApiDocsMarkdown } from '@/lib/markdown-renderer';

export const GET: APIRoute = () => {
  const body = renderApiDocsMarkdown();
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
