// Cloudflare Pages Function: POST /api/login
// Body: { passcode }. On a correct passcode, set the signed admin cookie.

import { makeSession, safeEqual, sessionSetCookie } from '../../src/lib/auth';

interface Env {
  ADMIN_PASSCODE?: string;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSCODE) return json({ error: 'not_configured' }, 503);

  let body: { passcode?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const supplied = String(body.passcode ?? '');
  if (!supplied || !safeEqual(supplied, env.ADMIN_PASSCODE)) {
    return json({ error: 'bad_passcode' }, 401);
  }

  const cookie = sessionSetCookie(await makeSession(env.ADMIN_PASSCODE));
  return json({ ok: true }, 200, { 'set-cookie': cookie });
};
