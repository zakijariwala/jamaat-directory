// Cloudflare Pages Function: GET /api/pending
// Passcode-gated. Returns the staging rows (status='pending') for the in-site
// moderation page. Includes phones — gated, never public.

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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSCODE) return json({ error: 'not_configured' }, 503);
  if (!(await requireAdmin(request, env.ADMIN_PASSCODE))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  const [cities, contacts, facilities] = await Promise.all([
    env.DB.prepare("SELECT * FROM cities WHERE status = 'pending' ORDER BY name").all(),
    env.DB.prepare("SELECT * FROM contacts WHERE status = 'pending' ORDER BY city_id, name").all(),
    env.DB.prepare("SELECT * FROM facilities WHERE status = 'pending' ORDER BY city_id, name").all(),
  ]);

  return json({
    cities: cities.results ?? [],
    contacts: contacts.results ?? [],
    facilities: facilities.results ?? [],
  });
};
