// Generate public/directory.json from the typed seed dataset.
// Run with:  npm run gen:snapshot   (also runs before dev/build)
//
// This is the canonical public snapshot for the prototype (seed-backed). In
// production the same shape is served by functions/directory.json.ts from D1.
// buildSnapshot guarantees no phone numbers appear here.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSnapshot } from '../src/lib/snapshot.ts';
import { cities, contacts, facilities } from '../src/data/seed.ts';

const snapshot = buildSnapshot(cities, contacts, facilities);

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });
const outPath = resolve(publicDir, 'directory.json');
writeFileSync(outPath, JSON.stringify(snapshot), 'utf8');

console.log(
  `Wrote ${outPath}: ${snapshot.counts.cities} cities, ` +
    `${snapshot.counts.contacts} contacts, ${snapshot.counts.facilities} facilities.`,
);
