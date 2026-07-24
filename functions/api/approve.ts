// Cloudflare Pages Function: POST /api/approve
//
// Passcode-gated moderation. Flips a staging row's status:
//   approve → 'live' (contacts/facilities also get verified_at = now)
//   reject  → 'removed'
// Body: { type: 'city'|'contact'|'facility', id, action: 'approve'|'reject' }

import { requireAdmin } from '../../src/lib/auth';

interface Env {
  DB?: D1Database;
  ADMIN_PASSCODE?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const TABLE: Record<string, string> = {
  city: 'cities',
  contact: 'contacts',
  facility: 'facilities',
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSCODE) return json({ error: 'not_configured' }, 503);
  if (!(await requireAdmin(request, env.ADMIN_PASSCODE))) return json({ error: 'unauthorized' }, 401);

  let body: { type?: string; id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const table = TABLE[body.type ?? ''];
  const id = (body.id ?? '').trim();
  const approve = body.action !== 'reject';
  if (!table || !id) return json({ error: 'bad_target' }, 400);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  if (approve) {
    // Cities have no verified_at column; contacts/facilities do.
    const query = table === 'cities'
      ? "UPDATE cities SET status = 'live' WHERE id = ?"
      : `UPDATE ${table} SET status = 'live', verified_at = ? WHERE id = ?`;
    const stmt = table === 'cities'
      ? env.DB.prepare(query).bind(id)
      : env.DB.prepare(query).bind(new Date().toISOString(), id);
    await stmt.run();
  } else {
    await env.DB.prepare(`UPDATE ${table} SET status = 'removed' WHERE id = ?`).bind(id).run();
  }

  return json({ ok: true, type: body.type, id, status: approve ? 'live' : 'removed' });
};
