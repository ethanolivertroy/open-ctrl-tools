#!/usr/bin/env node
/**
 * Cursor Bridge — first-party OpenAI-compatible proxy built on the official
 * @cursor/sdk. Lets the myctrl.tools "Cursor" AI provider use your Cursor
 * plan from the browser.
 *
 * Cursor has no official chat-completions API; the SDK is Node-only. This
 * bridge runs on your machine and exposes the two endpoints the site needs:
 *
 *   GET  /v1/models            — models available to your Cursor account
 *   POST /v1/chat/completions  — chat completion (supports stream: true)
 *
 * Usage:
 *   CURSOR_API_KEY=crsr_... npm run cursor-bridge
 *
 * Env:
 *   CURSOR_API_KEY   required — user API key from cursor.com/dashboard -> API Keys
 *   PORT             default 4646
 *   ALLOWED_ORIGINS  comma-separated CORS origins
 *                    default: http://localhost:4321,https://myctrl.tools
 *
 * The agent runs sandboxed in an empty scratch directory: it answers from
 * model knowledge and cannot read or modify your files.
 */

import http from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 4646);
const API_KEY = process.env.CURSOR_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:4321,https://myctrl.tools')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'composer-2.5';

if (!API_KEY) {
  console.error('CURSOR_API_KEY is required. Create one at https://cursor.com/dashboard -> API Keys.');
  process.exit(1);
}

let Agent;
let Cursor;
try {
  ({ Agent, Cursor } = await import('@cursor/sdk'));
} catch {
  console.error('@cursor/sdk is not installed. Run: npm install -D @cursor/sdk');
  process.exit(1);
}

const scratchDir = await mkdtemp(join(tmpdir(), 'cursor-bridge-'));

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    // Chrome Private Network Access: required when a public HTTPS page
    // (https://myctrl.tools) calls a localhost server like this one.
    'Access-Control-Allow-Private-Network': 'true',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** Flatten OpenAI-style messages into a single prompt for the agent. */
function messagesToPrompt(messages) {
  const parts = [];
  for (const message of messages ?? []) {
    const content = typeof message.content === 'string'
      ? message.content
      : (message.content ?? []).map((part) => part.text ?? '').join('\n');
    if (!content) continue;
    if (message.role === 'system') {
      parts.push(`<instructions>\n${content}\n</instructions>`);
    } else if (message.role === 'assistant') {
      parts.push(`Assistant (previous turn):\n${content}`);
    } else {
      parts.push(content);
    }
  }
  return parts.join('\n\n');
}

function completionChunk(id, model, delta, finishReason = null) {
  return JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
}

async function handleModels(req, res) {
  try {
    const models = await Cursor.models.list({ apiKey: API_KEY });
    json(res, 200, {
      object: 'list',
      data: models.map((model) => ({
        id: model.id,
        object: 'model',
        owned_by: 'cursor',
      })),
    }, corsHeaders(req));
  } catch (error) {
    json(res, 502, { error: { message: `Could not list Cursor models: ${error.message}` } }, corsHeaders(req));
  }
}

async function handleChatCompletions(req, res) {
  const cors = corsHeaders(req);
  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: { message: 'Invalid JSON body' } }, cors);
  }

  const model = body.model || DEFAULT_MODEL;
  const prompt = messagesToPrompt(body.messages);
  if (!prompt) {
    return json(res, 400, { error: { message: 'messages is required' } }, cors);
  }

  const id = `chatcmpl-${Math.random().toString(36).slice(2)}`;
  let agent;
  try {
    agent = await Agent.create({
      apiKey: API_KEY,
      model: { id: model },
      local: { cwd: scratchDir, sandboxOptions: { enabled: true } },
    });

    if (body.stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...cors,
      });
      res.write(`data: ${completionChunk(id, model, { role: 'assistant' })}\n\n`);

      const run = await agent.send(prompt, {
        onDelta: (update) => {
          if (update.type === 'text-delta' && update.text) {
            res.write(`data: ${completionChunk(id, model, { content: update.text })}\n\n`);
          }
        },
      });
      await run.wait();

      res.write(`data: ${completionChunk(id, model, {}, 'stop')}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const run = await agent.send(prompt);
    const result = await run.wait();
    json(res, 200, {
      id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.result ?? '' },
        finish_reason: 'stop',
      }],
    }, cors);
  } catch (error) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: { message: error.message } })}\n\n`);
      res.end();
    } else {
      json(res, 502, { error: { message: `Cursor agent error: ${error.message}` } }, cors);
    }
  } finally {
    try {
      await agent?.[Symbol.asyncDispose]?.() ?? agent?.dispose?.();
    } catch {
      // Best-effort cleanup
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    return json(res, 200, { ok: true, service: 'cursor-bridge', model: DEFAULT_MODEL }, corsHeaders(req));
  }
  if (req.method === 'GET' && url.pathname === '/v1/models') {
    return handleModels(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    return handleChatCompletions(req, res);
  }
  json(res, 404, { error: { message: `No route: ${req.method} ${url.pathname}` } }, corsHeaders(req));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`cursor-bridge listening on http://127.0.0.1:${PORT}/v1`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log('Point the myctrl.tools Cursor provider base URL at the address above.');
});
