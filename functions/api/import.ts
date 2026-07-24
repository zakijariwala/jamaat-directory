// Cloudflare Pages Function: POST /api/import
//
// Passcode-gated. Accepts an edited workbook (the one from /api/pending.xlsx,
// multipart file field "file") and applies the moderator's status edits back to
// D1 by row id. Only the `status` column is written — never bulk-editing data
// fields from a spreadsheet — so a stray Excel edit can't corrupt records.

import * as XLSX from 'xlsx';
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

const SHEET_TABLE: Record<string, string> = {
  Cities: 'cities',
  Contacts: 'contacts',
  Facilities: 'facilities',
};
const VALID_STATUS = new Set(['pending', 'live', 'flagged', 'removed']);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSCODE) return json({ error: 'not_configured' }, 503);
  if (!(await requireAdmin(request, env.ADMIN_PASSCODE))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  let buf: ArrayBuffer;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'no_file' }, 400);
    buf = await file.arrayBuffer();
  } catch {
    return json({ error: 'bad_upload' }, 400);
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    return json({ error: 'bad_workbook' }, 400);
  }

  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];
  for (const [sheetName, table] of Object.entries(SHEET_TABLE)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    for (const row of rows) {
      const id = String(row.id ?? '').trim();
      const status = String(row.status ?? '').trim().toLowerCase();
      if (!id || !VALID_STATUS.has(status)) continue;
      if (table !== 'cities' && status === 'live') {
        // Stamp verified_at only on first approval (null) — re-importing the
        // workbook must not reset the staleness clock on already-live rows.
        stmts.push(env.DB.prepare(`UPDATE ${table} SET status = 'live', verified_at = COALESCE(verified_at, ?) WHERE id = ?`).bind(now, id));
      } else {
        stmts.push(env.DB.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).bind(status, id));
      }
    }
  }

  if (stmts.length === 0) return json({ ok: true, applied: 0 });
  await env.DB.batch(stmts);
  return json({ ok: true, applied: stmts.length });
};
