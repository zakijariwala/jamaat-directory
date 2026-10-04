// Build-time data source for the static pages (home index + /city/[id]).
//
// Production builds render from the LIVE directory — the same phone-free
// snapshot /directory.json serves from D1 — so approved entries appear on the
// site after the next build ("Publish to site" in /moderate triggers one).
// `astro dev` uses the sample seed so local work needs no network.
//
//   DIRECTORY_SOURCE=seed   force the sample data (e.g. an offline build)
//   DIRECTORY_SOURCE_URL    snapshot to build from (default: the production site)
//
// A production build that can't reach the live snapshot FAILS rather than
// silently publishing sample data.

import { buildSnapshot } from './snapshot';
import { cities, contacts, facilities } from '../data/seed';
import type { Snapshot } from './types';

const DEFAULT_URL = 'https://jamaat-directory.pages.dev/directory.json';

let cached: Promise<Snapshot> | undefined;

async function fetchLive(url: string): Promise<Snapshot> {
  // Cache-bust: /directory.json is edge-cached for a few minutes, and a build
  // triggered right after an approval must see it.
  const busted = `${url}${url.includes('?') ? '&' : '?'}build=${Date.now()}`;
  const res = await fetch(busted, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  const snap = (await res.json()) as Snapshot;
  if (!Array.isArray(snap?.cities)) throw new Error(`${url} is not a directory snapshot`);
  return snap;
}

export function loadDirectory(): Promise<Snapshot> {
  if (cached) return cached;
  const source = process.env.DIRECTORY_SOURCE ?? (import.meta.env.DEV ? 'seed' : 'live');
  if (source === 'seed') {
    cached = Promise.resolve(buildSnapshot(cities, contacts, facilities));
  } else {
    const url = process.env.DIRECTORY_SOURCE_URL ?? DEFAULT_URL;
    cached = fetchLive(url).then(
      (snap) => {
        console.log(`[directory] building from ${url}: ${snap.cities.length} cities`);
        return snap;
      },
      (e: Error) => {
        throw new Error(
          `[directory] could not load the live directory (${e.message}). ` +
            'Refusing to build the site from sample data. Set DIRECTORY_SOURCE=seed to override.',
        );
      },
    );
  }
  return cached;
}
