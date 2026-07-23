// Ingest contract: the shape the Apps Script POSTs to /api/ingest, and the
// pure logic that turns it into idempotent D1 statements.
//
// The Sheet is the moderation UI, so it sends FULL rows (every column) for each
// upsert; INSERT OR REPLACE keyed on the primary id makes re-sends idempotent.
// Removals set status='removed' rather than deleting, so the snapshot rebuild
// drops them immediately.

import type { CityRow, ContactRow, FacilityRow } from './types';

export interface IngestPayload {
  submission_id: string;
  city?: CityRow;
  contacts?: ContactRow[];
  facilities?: FacilityRow[];
  remove?: Array<{ type: 'contact' | 'facility'; id: string }>;
}

export interface Statement {
  query: string;
  params: Array<string | number | null>;
}

const CITY_COLS: Array<keyof CityRow> = [
  'id', 'name', 'jamaat_name', 'state', 'aliases', 'region',
  'nearest_rail', 'nearest_air', 'notes', 'updated_at',
];
const CONTACT_COLS: Array<keyof ContactRow> = [
  'id', 'city_id', 'name', 'phone', 'whatsapp', 'role', 'helps_with',
  'best_time', 'languages', 'self_added', 'consent', 'status', 'verified_at', 'created_at',
];
const FACILITY_COLS: Array<keyof FacilityRow> = [
  'id', 'city_id', 'kind', 'name', 'address', 'maps_url', 'phone', 'timings',
  'charges_band', 'booking_note', 'facilities', 'status', 'verified_at', 'created_at',
];

function upsert(
  table: string,
  cols: string[],
  row: Record<string, unknown>,
): Statement {
  const placeholders = cols.map(() => '?').join(', ');
  const params = cols.map((c) => {
    const v = row[c];
    if (v === undefined || v === null) return null;
    if (typeof v === 'number' || typeof v === 'string') return v;
    return String(v);
  });
  return {
    query: `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    params,
  };
}

export function buildIngestStatements(payload: IngestPayload): Statement[] {
  const stmts: Statement[] = [];

  if (payload.city) {
    stmts.push(upsert('cities', CITY_COLS as string[], payload.city as unknown as Record<string, unknown>));
  }
  for (const c of payload.contacts ?? []) {
    stmts.push(upsert('contacts', CONTACT_COLS as string[], c as unknown as Record<string, unknown>));
  }
  for (const f of payload.facilities ?? []) {
    stmts.push(upsert('facilities', FACILITY_COLS as string[], f as unknown as Record<string, unknown>));
  }
  for (const r of payload.remove ?? []) {
    const table = r.type === 'facility' ? 'facilities' : 'contacts';
    stmts.push({
      query: `UPDATE ${table} SET status = 'removed' WHERE id = ?`,
      params: [r.id],
    });
  }

  return stmts;
}
