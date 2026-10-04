// Cloudflare Pages Function: GET /directory.json
//
// The full public snapshot. Contains NO phone numbers (buildSnapshot enforces
// this). Long edge cache; the ingest handler purges it on write. Only
// status = 'live' rows are queried; buildSnapshot additionally drops any
// live-but-unconsented contact.
//
// No seed fallback: without a DB binding this returns 503, so a broken binding
// never silently publishes sample data (and the production build refuses it).

import { buildSnapshot } from '../src/lib/snapshot';
import type { CityRow, ContactRow, FacilityRow, FlagRow } from '../src/lib/types';

interface Env {
  DB?: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  if (!db) {
    return new Response(JSON.stringify({ error: 'db_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const [cities, contacts, facilities, flags] = await Promise.all([
    db.prepare("SELECT * FROM cities WHERE status = 'live'").all<CityRow>(),
    db.prepare("SELECT * FROM contacts WHERE status = 'live'").all<ContactRow>(),
    db.prepare("SELECT * FROM facilities WHERE status = 'live'").all<FacilityRow>(),
    db.prepare('SELECT * FROM flags WHERE resolved = 0').all<FlagRow>(),
  ]);
  const snapshot = buildSnapshot(
    cities.results,
    contacts.results,
    facilities.results,
    Date.now(),
    flags.results,
  );

  return new Response(JSON.stringify(snapshot), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short edge cache so an approved edit is live within ~5 min (success
      // criterion) without needing an explicit purge. browser: 60s.
      'cache-control': 'public, max-age=60, s-maxage=300',
    },
  });
};
