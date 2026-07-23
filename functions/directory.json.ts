// Cloudflare Pages Function: GET /directory.json
//
// The full public snapshot, generated live from D1. Contains NO phone numbers
// (buildSnapshot enforces this). Long edge cache; the ingest handler purges it
// on write. Only status = 'live' rows are queried; buildSnapshot additionally
// drops any live-but-unconsented contact.

import { buildSnapshot } from '../src/lib/snapshot';
import type { CityRow, ContactRow, FacilityRow } from '../src/lib/types';

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const [cities, contacts, facilities] = await Promise.all([
    DB.prepare('SELECT * FROM cities').all<CityRow>(),
    DB.prepare("SELECT * FROM contacts WHERE status = 'live'").all<ContactRow>(),
    DB.prepare("SELECT * FROM facilities WHERE status = 'live'").all<FacilityRow>(),
  ]);

  const snapshot = buildSnapshot(
    cities.results,
    contacts.results,
    facilities.results,
  );

  return new Response(JSON.stringify(snapshot), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Served from the edge; purged on write via cache purge in /api/ingest.
      'cache-control': 'public, max-age=60, s-maxage=86400',
    },
  });
};
