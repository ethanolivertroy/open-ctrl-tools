import type { APIRoute } from 'astro';
import { getCrosswalkStats } from '@/data/crosswalk-stats';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(getCrosswalkStats()), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
