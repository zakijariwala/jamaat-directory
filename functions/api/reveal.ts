// Cloudflare Pages Function: GET /api/reveal?type=contact|facility&id=…
//
// Returns exactly ONE phone number. Phone numbers never appear in
// directory.json — they are only served here, one request at a time, and only
// for rows that are actually published (live; and for contacts, consented or
// self-added).
//
// STAGE 3 (this file): the correct privacy boundary, seed-backed until D1.
// STAGE 4 will add on top of this, without changing the contract:
//   - per-IP rate limiting (20/hour, 60/day)
//   - Cloudflare Turnstile on the first reveal of a session
//   - a reveal counter (never logging the IP)

import {
  contacts as seedContacts,
  facilities as seedFacilities,
} from '../../src/data/seed';

interface Env {
  DB?: D1Database;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // A revealed number must never be cached at the edge or in the browser.
      'cache-control': 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type') === 'facility' ? 'facility' : 'contact';
  if (!id) return json({ error: 'missing_id' }, 400);

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
    // Prototype fallback: same publish rules, from seed.
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
  return json({ id, type, phone });
};
