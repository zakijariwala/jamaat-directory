// Cloudflare Pages Function: GET /directory.json
//
// The full public snapshot. Contains NO phone numbers (buildSnapshot enforces
// this). Long edge cache; the ingest handler purges it on write. Only
// status = 'live' rows are queried; buildSnapshot additionally drops any
// live-but-unconsented contact.
//
// PROTOTYPE FALLBACK: until D1 is provisioned, there is no DB binding, so this
// serves the seed-derived snapshot instead. Remove the fallback once D1 is live.

import { buildSnapshot } from '../src/lib/snapshot';
import { cities as seedCities, contacts as seedContacts, facilities as seedFacilities } from '../src/data/seed';
import type { CityRow, ContactRow, FacilityRow, FlagRow } from '../src/lib/types';

interface Env {
  DB?: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  let snapshot;
  if (db) {
    const [cities, contacts, facilities, flags] = await Promise.all([
      db.prepare("SELECT * FROM cities WHERE status = 'live'").all<CityRow>(),
      db.prepare("SELECT * FROM contacts WHERE status = 'live'").all<ContactRow>(),
      db.prepare("SELECT * FROM facilities WHERE status = 'live'").all<FacilityRow>(),
      db.prepare('SELECT * FROM flags WHERE resolved = 0').all<FlagRow>(),
    ]);
    snapshot = buildSnapshot(
      cities.results,
      contacts.results,
      facilities.results,
      Date.now(),
      flags.results,
    );
  } else {
    // No D1 bound yet (prototype): derive from seed (no flags).
    snapshot = buildSnapshot(seedCities, seedContacts, seedFacilities);
  }

  return new Response(JSON.stringify(snapshot), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short edge cache so an approved edit is live within ~5 min (success
      // criterion) without needing an explicit purge. browser: 60s.
      'cache-control': 'public, max-age=60, s-maxage=300',
    },
  });
};
