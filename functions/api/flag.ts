// Cloudflare Pages Function: POST /api/flag
//
// Records a problem report or a removal request against a contact or facility.
// Body: { target_type: 'contact'|'facility', target_id, kind: 'problem'|'removal_request', reason? }
//
//  - problem          → logged; the snapshot shows a caution on that entry after
//                       48h if a moderator hasn't resolved it.
//  - removal_request  → logged AND the target is set status='removed' immediately
//                       (self-service removal, no questions asked). It drops out
//                       of the snapshot on the next rebuild (≤5 min edge cache).
//
// Turnstile is enforced when TURNSTILE_SECRET is configured.

import { verifyTurnstile } from '../../src/lib/turnstile';
import type { FlagKind, FlagTarget } from '../../src/lib/types';

interface Env {
  DB?: D1Database;
  TURNSTILE_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { target_type?: string; target_id?: string; kind?: string; reason?: string; cf_token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const targetType = body.target_type === 'facility' ? 'facility' : 'contact';
  const kind: FlagKind = body.kind === 'removal_request' ? 'removal_request' : 'problem';
  const targetId = (body.target_id ?? '').trim();
  if (!targetId) return json({ error: 'missing_target' }, 400);

  // Turnstile (when configured).
  if (env.TURNSTILE_SECRET) {
    const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
    const token = body.cf_token ?? request.headers.get('cf-turnstile-response') ?? '';
    if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
      return json({ error: 'turnstile_required' }, 403);
    }
  }

  if (!env.DB) return json({ error: 'no_db' }, 503);

  const now = new Date().toISOString();
  const flagId = crypto.randomUUID();
  const table = (targetType satisfies FlagTarget) === 'facility' ? 'facilities' : 'contacts';

  const statements = [
    env.DB
      .prepare(
        'INSERT INTO flags (id, target_type, target_id, reason, kind, resolved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
      )
      .bind(flagId, targetType, targetId, body.reason ?? null, kind, now),
  ];

  if (kind === 'removal_request') {
    statements.push(
      env.DB.prepare(`UPDATE ${table} SET status = 'removed' WHERE id = ?`).bind(targetId),
    );
  }

  await env.DB.batch(statements);
  return json({ ok: true, id: flagId });
};
