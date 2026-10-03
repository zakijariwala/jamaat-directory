// Cloudflare Pages Function: POST /api/publish
//
// Passcode-gated. Rebuilds the site from the live database so everything
// approved since the last build appears on the city and home pages (takes a
// couple of minutes). Needs the DEPLOY_HOOK_URL secret.

import { requireAdmin } from '../../src/lib/auth';
import { triggerRebuild, type PublishEnv } from '../../src/lib/publish';

interface Env extends PublishEnv {
  ADMIN_PASSCODE?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSCODE) return json({ error: 'not_configured' }, 503);
  if (!(await requireAdmin(request, env.ADMIN_PASSCODE))) return json({ error: 'unauthorized' }, 401);

  const result = await triggerRebuild(env, 60);
  if (result.ok) return json(result);
  const status = result.reason === 'throttled' ? 429 : result.reason === 'not_configured' ? 503 : 502;
  return json({ error: result.reason, retry_after: result.retry_after }, status);
};
