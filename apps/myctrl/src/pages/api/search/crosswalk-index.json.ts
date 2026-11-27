import type { APIRoute } from 'astro';
import { buildCrosswalkIndexPayload } from '@/lib/search/build-artifacts';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(buildCrosswalkIndexPayload()), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
