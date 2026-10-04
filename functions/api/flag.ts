// Cloudflare Pages Function: POST /api/flag
//
// Records a problem report or a removal request against a contact or facility.
// Body: { target_type: 'contact'|'facility', target_id, kind: 'problem'|'removal_request', reason? }
//
//  - problem          → logged; the snapshot shows a caution on that entry after
//                       48h if a moderator hasn't resolved it.
//  - removal_request  → logged AND, for a contact, the target is set
//                       status='removed' immediately (self-service removal, no
//                       questions asked). It drops out of the snapshot on the
//                       next rebuild (≤5 min edge cache). A place (facility) is
//                       not one person's details, so its removal request is
//                       only logged for a moderator.
//
// Turnstile is enforced when TURNSTILE_SECRET is configured.

import { verifyTurnstile } from '../../src/lib/turnstile';
import type { FlagKind, FlagTarget } from '../../src/lib/types';
import { triggerRebuild, type PublishEnv } from '../../src/lib/publish';

interface Env extends PublishEnv {
  DB?: D1Database;
  TURNSTILE_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  let body: { target_type?: string; target_id?: string; kind?: string; reason?: string; cf_token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const targetType: FlagTarget = body.target_type === 'facility' ? 'facility' : 'contact';
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

  const statements = [
    env.DB
      .prepare(
        'INSERT INTO flags (id, target_type, target_id, reason, kind, resolved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
      )
      .bind(flagId, targetType, targetId, body.reason?.trim().slice(0, 500) || null, kind, now),
  ];

  const removeNow = kind === 'removal_request' && targetType === 'contact';
  if (removeNow) {
    statements.push(
      env.DB.prepare("UPDATE contacts SET status = 'removed' WHERE id = ?").bind(targetId),
    );
  }

  await env.DB.batch(statements);
  if (removeNow) {
    // Take the name off the static city page too (the number is already
    // unrevealable). Throttled: public endpoint, so at most one build / 10 min.
    waitUntil(triggerRebuild(env, 600).catch(() => undefined));
  }
  return json({ ok: true, id: flagId });
};
