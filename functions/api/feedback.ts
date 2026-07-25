// Cloudflare Pages Function: POST /api/feedback
//
// General feedback from the About page. Rate-limited; Turnstile when configured.
// Stored privately in D1 for moderators to read.

import { verifyTurnstile } from '../../src/lib/turnstile';
import { checkAndIncrement } from '../../src/lib/ratelimit';

interface Env {
  DB?: D1Database;
  RATE_LIMIT?: KVNamespace;
  TURNSTILE_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { name?: string; contact?: string; message?: string; cf_token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const message = (body.message ?? '').trim();
  if (!message) return json({ error: 'empty_message' }, 400);
  if (message.length > 4000) return json({ error: 'too_long' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';

  if (env.TURNSTILE_SECRET) {
    const token = body.cf_token ?? request.headers.get('cf-turnstile-response') ?? '';
    if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
      return json({ error: 'turnstile_required' }, 403);
    }
  }

  if (env.RATE_LIMIT) {
    const rl = await checkAndIncrement(env.RATE_LIMIT, `feedback:${ip}`);
    if (!rl.allowed) return json({ error: 'rate_limited', scope: rl.scope }, 429);
  }

  if (!env.DB) return json({ error: 'no_db' }, 503);

  await env.DB
    .prepare('INSERT INTO feedback (id, name, contact, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(
      crypto.randomUUID(),
      (body.name ?? '').trim() || null,
      (body.contact ?? '').trim() || null,
      message,
      new Date().toISOString(),
    )
    .run();

  return json({ ok: true });
};
