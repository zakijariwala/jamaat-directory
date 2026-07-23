// Cloudflare Pages Function: POST /api/ingest
//
// The seam between intake (Google Form → Sheet → Apps Script) and the site.
// The Apps Script signs the raw JSON body with HMAC-SHA256 using a shared
// secret; we verify, then upsert rows into D1. Idempotent on row ids.
//
// The public snapshot is served live from D1 by /directory.json with a short
// edge cache (~5 min), which meets the "under 5 minutes to live" target without
// a separate purge step. (A cache purge can be added later if that must be
// instant.)

import { verifySignature } from '../../src/lib/hmac';
import { buildIngestStatements, type IngestPayload } from '../../src/lib/ingest';

interface Env {
  DB?: D1Database;
  INGEST_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.INGEST_SECRET) return json({ error: 'not_configured' }, 503);

  const raw = await request.text();
  const signature = request.headers.get('x-signature') ?? '';
  const ok = await verifySignature(env.INGEST_SECRET, raw, signature);
  if (!ok) return json({ error: 'bad_signature' }, 401);

  let payload: IngestPayload;
  try {
    payload = JSON.parse(raw) as IngestPayload;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!payload.submission_id) return json({ error: 'missing_submission_id' }, 400);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  const statements = buildIngestStatements(payload);
  if (statements.length === 0) return json({ ok: true, applied: 0 });

  await env.DB.batch(statements.map((s) => env.DB!.prepare(s.query).bind(...s.params)));

  return json({ ok: true, applied: statements.length });
};
