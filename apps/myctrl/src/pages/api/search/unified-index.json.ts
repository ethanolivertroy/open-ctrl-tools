import type { APIRoute } from 'astro';
import { buildUnifiedSearchPayload } from '@/lib/search/build-artifacts';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(buildUnifiedSearchPayload()), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
