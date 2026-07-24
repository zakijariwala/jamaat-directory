// Cloudflare Pages Function: GET /api/pending.xlsx
//
// Passcode-gated. Streams a consolidated Excel workbook (Cities / Contacts /
// Facilities sheets) of the FULL dataset for offsite data operations. Each row
// carries its id (the stable key) and status; a moderator can edit the status
// column offline and upload the file back to /api/import. Contains phones —
// which is why it is gated and never public.

import * as XLSX from 'xlsx';
import { requireAdmin } from '../../src/lib/auth';

interface Env {
  DB?: D1Database;
  ADMIN_PASSCODE?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSCODE) return new Response('not_configured', { status: 503 });
  if (!(await requireAdmin(request, env.ADMIN_PASSCODE))) return new Response('unauthorized', { status: 401 });
  if (!env.DB) return new Response('no_db', { status: 503 });

  const [cities, contacts, facilities] = await Promise.all([
    env.DB.prepare('SELECT * FROM cities ORDER BY status, name').all(),
    env.DB.prepare('SELECT * FROM contacts ORDER BY status, city_id, name').all(),
    env.DB.prepare('SELECT * FROM facilities ORDER BY status, city_id, name').all(),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cities.results ?? []), 'Cities');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contacts.results ?? []), 'Contacts');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facilities.results ?? []), 'Facilities');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="jamaat-directory-${stamp}.xlsx"`,
      'cache-control': 'no-store',
    },
  });
};
