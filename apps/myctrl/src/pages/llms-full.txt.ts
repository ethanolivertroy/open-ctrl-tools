import type { APIRoute } from 'astro';
import { renderLlmsFullTxt } from '@/lib/markdown-renderer';

export const GET: APIRoute = () => {
  const body = renderLlmsFullTxt();
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
