// Cloudflare Pages Function: POST /api/submit
//
// First-party intake. A public in-site form posts a submission here; we verify
// Turnstile, rate-limit, build STAGING (pending) rows, and upsert them into D1.
// Nothing here reaches the public snapshot until a moderator approves it.

import { verifyTurnstile } from '../../src/lib/turnstile';
import { checkAndIncrement } from '../../src/lib/ratelimit';
import { buildPendingRows, type SubmitPayload } from '../../src/lib/intake';
import { buildIngestStatements } from '../../src/lib/ingest';

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
  let body: SubmitPayload & { cf_token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';

  // Turnstile (when configured) — the form is public, so guard against bots.
  if (env.TURNSTILE_SECRET) {
    const token = body.cf_token ?? request.headers.get('cf-turnstile-response') ?? '';
    if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
      return json({ error: 'turnstile_required' }, 403);
    }
  }

  // Rate-limit submissions by IP (reuses the reveal limiter's buckets).
  if (env.RATE_LIMIT) {
    const rl = await checkAndIncrement(env.RATE_LIMIT, `submit:${ip}`);
    if (!rl.allowed) return json({ error: 'rate_limited', scope: rl.scope }, 429);
  }

  let rows;
  try {
    rows = buildPendingRows(body);
  } catch (e) {
    return json({ error: 'invalid', detail: (e as Error).message }, 400);
  }
  if (rows.contacts.length === 0 && rows.facilities.length === 0) {
    return json({ error: 'nothing_to_add' }, 400);
  }

  if (!env.DB) return json({ error: 'no_db' }, 503);

  const statements = buildIngestStatements({
    submission_id: `${rows.city.id}:${Date.now()}`,
    city: rows.city,
    contacts: rows.contacts,
    facilities: rows.facilities,
  });
  await env.DB.batch(statements.map((s) => env.DB!.prepare(s.query).bind(...s.params)));

  return json({ ok: true, pending: statements.length, city: rows.city.id });
};
