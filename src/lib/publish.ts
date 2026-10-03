// Rebuild the static site so approved / removed entries show on the city and
// home pages. Calls a Cloudflare Pages deploy hook (Pages project → Settings →
// Builds → Deploy hooks), stored as the DEPLOY_HOOK_URL secret.
//
// Throttled through the RATE_LIMIT KV (when bound) so a burst of calls can't
// burn through the monthly build allowance.

export interface PublishEnv {
  DEPLOY_HOOK_URL?: string;
  RATE_LIMIT?: KVNamespace;
}

export type PublishResult =
  | { ok: true; triggered_at: string }
  | { ok: false; reason: 'not_configured' | 'throttled' | 'hook_failed'; retry_after?: number };

const LAST_KEY = 'publish:last';

export async function triggerRebuild(env: PublishEnv, minIntervalSec: number): Promise<PublishResult> {
  if (!env.DEPLOY_HOOK_URL) return { ok: false, reason: 'not_configured' };

  const now = Date.now();
  if (env.RATE_LIMIT) {
    const last = parseInt((await env.RATE_LIMIT.get(LAST_KEY)) ?? '0', 10) || 0;
    const wait = Math.ceil((last + minIntervalSec * 1000 - now) / 1000);
    if (wait > 0) return { ok: false, reason: 'throttled', retry_after: wait };
  }

  const res = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
  if (!res.ok) return { ok: false, reason: 'hook_failed' };

  // KV's minimum TTL is 60s.
  await env.RATE_LIMIT?.put(LAST_KEY, String(now), { expirationTtl: Math.max(60, minIntervalSec * 2) });
  return { ok: true, triggered_at: new Date(now).toISOString() };
}
