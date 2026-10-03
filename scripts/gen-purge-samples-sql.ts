// Generate purge-samples.sql: deletes ONLY the fictional sample rows defined in
// src/data/seed.ts from D1, by id. Real (imported / contributed) rows are left
// alone. Run once real data is in and approved:
//
//   npm run db:purge-samples        (remote D1)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cities, contacts, facilities } from '../src/data/seed.ts';
import { sqlValue } from './sql.ts';

const list = (ids: string[]) => ids.map((id) => sqlValue(id)).join(', ');
const contactIds = list(contacts.map((c) => c.id));
const facilityIds = list(facilities.map((f) => f.id));
const cityIds = list(cities.map((c) => c.id));

const sql = [
  '-- GENERATED FILE — removes the sample rows from src/data/seed.ts only.',
  `DELETE FROM flags WHERE target_id IN (${contactIds}, ${facilityIds});`,
  `DELETE FROM contacts WHERE id IN (${contactIds});`,
  `DELETE FROM facilities WHERE id IN (${facilityIds});`,
  // A sample city is kept if real contacts/listings now hang off it.
  `DELETE FROM cities WHERE id IN (${cityIds})`,
  '  AND id NOT IN (SELECT city_id FROM contacts)',
  '  AND id NOT IN (SELECT city_id FROM facilities);',
  '',
].join('\n');

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'purge-samples.sql');
writeFileSync(outPath, sql, 'utf8');
console.log(`Wrote ${outPath}: ${contacts.length} contacts, ${facilities.length} facilities, up to ${cities.length} cities.`);
