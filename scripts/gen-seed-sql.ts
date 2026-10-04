// Generate seed.sql from the typed seed dataset (single source of truth).
// Run with:  npm run gen:seed-sql   (uses tsx)
//
// Output is idempotent: it clears the tables then re-inserts, wrapped in a
// transaction, so `wrangler d1 execute ... --file=seed.sql` can be re-run.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cities, contacts, facilities } from '../src/data/seed.ts';
import type { CityRow, ContactRow, FacilityRow } from '../src/lib/types.ts';
import { insert, type Row } from './sql.ts';

const cityCols: Array<keyof CityRow> = [
  'id', 'name', 'jamaat_name', 'state', 'aliases', 'region',
  'nearest_rail', 'nearest_air', 'notes', 'office_phone', 'status', 'updated_at',
];
const contactCols: Array<keyof ContactRow> = [
  'id', 'city_id', 'name', 'phone', 'whatsapp', 'role', 'helps_with',
  'best_time', 'languages', 'self_added', 'consent', 'provenance',
  'is_representative', 'status', 'verified_at', 'created_at',
];
const facilityCols: Array<keyof FacilityRow> = [
  'id', 'city_id', 'kind', 'name', 'address', 'maps_url', 'phone', 'timings',
  'charges_band', 'booking_note', 'facilities', 'source', 'status', 'verified_at', 'created_at',
];

const sql = [
  '-- GENERATED FILE — do not edit by hand. Source: src/data/seed.ts',
  '-- Regenerate with: npm run gen:seed-sql',
  '',
  'DELETE FROM flags;',
  'DELETE FROM facilities;',
  'DELETE FROM contacts;',
  'DELETE FROM cities;',
  '',
  '-- cities',
  insert('cities', cityCols as string[], cities as unknown as Row[]),
  '',
  '-- contacts',
  insert('contacts', contactCols as string[], contacts as unknown as Row[]),
  '',
  '-- facilities',
  insert('facilities', facilityCols as string[], facilities as unknown as Row[]),
  '',
].join('\n');

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql');
writeFileSync(outPath, sql, 'utf8');
console.log(
  `Wrote ${outPath}: ${cities.length} cities, ${contacts.length} contacts, ${facilities.length} facilities.`,
);
