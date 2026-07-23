// Cloudflare Pages Function: GET /api/reveal?type=contact|facility&id=…
//
// Returns exactly ONE phone number. Phones never appear in directory.json —
// they are served only here, one request at a time, and only for rows that are
// published (live; and for contacts, consented or self-added).
//
// Protections (packet §9.2):
//   - per-IP rate limiting: 20/hour, 60/day (KV-backed; IP never stored)
//   - Cloudflare Turnstile on the FIRST reveal of a session (then a cookie
//     skips it) — enforced only when TURNSTILE_SECRET is configured
//   - a reveal counter (aggregate only, never the IP)
//
// Everything degrades gracefully so the prototype works before D1/KV/Turnstile
// are provisioned: missing bindings simply skip that protection.

import {
  contacts as seedContacts,
  facilities as seedFacilities,
} from '../../src/data/seed';
import { checkAndIncrement } from '../../src/lib/ratelimit';
import { verifyTurnstile } from '../../src/lib/turnstile';

interface Env {
  DB?: D1Database;
  RATE_LIMIT?: KVNamespace;
  TURNSTILE_SECRET?: string;
}

const SESSION_COOKIE = 'rv_ok';

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.split(';').some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type') === 'facility' ? 'facility' : 'contact';
  if (!id) return json({ error: 'missing_id' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
  let setCookie: string | undefined;

  // --- Turnstile on first reveal of a session ---
  if (env.TURNSTILE_SECRET && !hasSessionCookie(request)) {
    const token =
      url.searchParams.get('cf_token') ??
      request.headers.get('cf-turnstile-response') ??
      '';
    const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET, ip);
    if (!ok) return json({ error: 'turnstile_required' }, 403);
    // Passed: mark the session so subsequent reveals skip the check.
    setCookie = `${SESSION_COOKIE}=1; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`;
  }

  // --- Rate limiting ---
  if (env.RATE_LIMIT) {
    const result = await checkAndIncrement(env.RATE_LIMIT, ip);
    if (!result.allowed) {
      return json(
        { error: 'rate_limited', scope: result.scope },
        429,
        { 'retry-after': String(result.retryAfter) },
      );
    }
    // Aggregate reveal counter — never keyed by IP.
    const dayBucket = Math.floor(Date.now() / 86400000);
    const counterKey = `reveal:count:${dayBucket}`;
    const current = parseInt((await env.RATE_LIMIT.get(counterKey)) ?? '0', 10) || 0;
    await env.RATE_LIMIT.put(counterKey, String(current + 1), { expirationTtl: 60 * 60 * 24 * 40 });
  }

  // --- Look up the single number ---
  let phone: string | null = null;
  if (env.DB) {
    if (type === 'facility') {
      const row = await env.DB
        .prepare("SELECT phone FROM facilities WHERE id = ? AND status = 'live'")
        .bind(id)
        .first<{ phone: string | null }>();
      phone = row?.phone ?? null;
    } else {
      const row = await env.DB
        .prepare(
          "SELECT phone FROM contacts WHERE id = ? AND status = 'live' AND (self_added = 1 OR consent = 1)",
        )
        .bind(id)
        .first<{ phone: string | null }>();
      phone = row?.phone ?? null;
    }
  } else {
    if (type === 'facility') {
      phone = seedFacilities.find((f) => f.id === id && f.status === 'live')?.phone ?? null;
    } else {
      const c = seedContacts.find(
        (c) => c.id === id && c.status === 'live' && (c.self_added === 1 || c.consent === 1),
      );
      phone = c?.phone ?? null;
    }
  }

  if (!phone) return json({ error: 'not_found' }, 404);
  return json({ id, type, phone }, 200, setCookie ? { 'set-cookie': setCookie } : {});
};
