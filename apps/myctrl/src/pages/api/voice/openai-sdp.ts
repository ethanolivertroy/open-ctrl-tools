import type { APIRoute } from 'astro';
import { z } from 'zod';
import { OPENAI_REALTIME_CALLS_URL } from '@/lib/voice/protocol';

export const prerender = false;

const SdpExchangeSchema = z.object({
  ephemeralToken: z.string().min(10).max(1000),
  sdp: z.string().min(20).max(50000),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const raw = await request.json();
    const parsed = SdpExchangeSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid SDP exchange payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { ephemeralToken, sdp } = parsed.data;
    const upstream = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ephemeralToken}`,
        'Content-Type': 'application/sdp',
      },
      body: sdp,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return new Response(
        JSON.stringify({
          error: `OpenAI WebRTC negotiation failed (${upstream.status})`,
          details: detail.slice(0, 300),
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const answerSdp = await upstream.text();
    return new Response(answerSdp, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected SDP error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
