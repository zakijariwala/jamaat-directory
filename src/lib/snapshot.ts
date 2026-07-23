// Snapshot generator: D1 rows -> directory.json.
//
// Non-negotiable rules enforced here (packet §"Non-negotiable rules"):
//   1. No phone number, ever, in the snapshot — enforced by allowlist construction
//      (we build Public* objects field by field; we never spread a *Row).
//   2. Only status === 'live' rows are published.
//   3. A contact with self_added === 0 AND consent === 0 is never published.
//
// Pure and dependency-free so it runs identically in the Worker, in the seed
// tooling, and under test.

import type {
  CityRow,
  ContactRow,
  FacilityRow,
  PublicCity,
  PublicContact,
  PublicFacility,
  Snapshot,
} from './types';

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

/** Missing or unparseable verified_at counts as stale (needs verification). */
export function isStale(verifiedAt: string | null, now: number): boolean {
  if (!verifiedAt) return true;
  const t = Date.parse(verifiedAt);
  if (Number.isNaN(t)) return true;
  return now - t > TWELVE_MONTHS_MS;
}

export function isContactPublishable(c: ContactRow): boolean {
  return c.status === 'live' && (c.self_added === 1 || c.consent === 1);
}

export function isFacilityPublishable(f: FacilityRow): boolean {
  return f.status === 'live';
}

function toPublicContact(c: ContactRow, now: number): PublicContact {
  // Explicit allowlist. `phone` is deliberately not referenced.
  return {
    id: c.id,
    name: c.name,
    whatsapp: c.whatsapp === 1,
    role: c.role,
    helps_with: c.helps_with,
    best_time: c.best_time,
    languages: c.languages,
    verified_at: c.verified_at,
    stale: isStale(c.verified_at, now),
  };
}

function toPublicFacility(f: FacilityRow, now: number): PublicFacility {
  // Explicit allowlist. `phone` is deliberately not referenced.
  return {
    id: f.id,
    kind: f.kind,
    name: f.name,
    address: f.address,
    maps_url: f.maps_url,
    timings: f.timings,
    charges_band: f.charges_band,
    booking_note: f.booking_note,
    facilities: parseJsonArray(f.facilities),
    verified_at: f.verified_at,
    stale: isStale(f.verified_at, now),
  };
}

export function buildSnapshot(
  cities: CityRow[],
  contacts: ContactRow[],
  facilities: FacilityRow[],
  now: number = Date.now(),
): Snapshot {
  const pubContacts = contacts.filter(isContactPublishable);
  const pubFacilities = facilities.filter(isFacilityPublishable);

  const contactsByCity = new Map<string, PublicContact[]>();
  for (const c of pubContacts) {
    const list = contactsByCity.get(c.city_id) ?? [];
    list.push(toPublicContact(c, now));
    contactsByCity.set(c.city_id, list);
  }

  const facilitiesByCity = new Map<string, PublicFacility[]>();
  for (const f of pubFacilities) {
    const list = facilitiesByCity.get(f.city_id) ?? [];
    list.push(toPublicFacility(f, now));
    facilitiesByCity.set(f.city_id, list);
  }

  const publicCities: PublicCity[] = cities.map((city) => {
    const cityContacts = contactsByCity.get(city.id) ?? [];
    const cityFacilities = facilitiesByCity.get(city.id) ?? [];
    return {
      id: city.id,
      name: city.name,
      jamaat_name: city.jamaat_name,
      state: city.state,
      region: city.region,
      aliases: parseJsonArray(city.aliases),
      nearest_rail: city.nearest_rail,
      nearest_air: city.nearest_air,
      notes: city.notes,
      contacts: cityContacts,
      facilities: cityFacilities,
      has: {
        contact: cityContacts.length > 0,
        masjid: cityFacilities.some((f) => f.kind === 'masjid'),
        stay: cityFacilities.some((f) => f.kind === 'musafir_khana'),
        hotel: cityFacilities.some((f) => f.kind === 'hotel'),
        restaurant: cityFacilities.some((f) => f.kind === 'restaurant'),
      },
    };
  });

  // Alphabetical by city name — the index is alphabetical throughout,
  // grouped by state on the frontend. No region leads by default.
  publicCities.sort((a, b) => a.name.localeCompare(b.name));

  // Most recent verified/updated timestamp across everything published.
  let updatedAt: string | null = null;
  let updatedMs = -Infinity;
  const consider = (d: string | null): void => {
    if (!d) return;
    const t = Date.parse(d);
    if (!Number.isNaN(t) && t > updatedMs) {
      updatedMs = t;
      updatedAt = d;
    }
  };
  for (const city of cities) consider(city.updated_at);
  for (const c of pubContacts) consider(c.verified_at);
  for (const f of pubFacilities) consider(f.verified_at);

  return {
    generated_at: new Date(now).toISOString(),
    counts: {
      cities: publicCities.length,
      contacts: pubContacts.length,
      facilities: pubFacilities.length,
    },
    updated_at: updatedAt,
    cities: publicCities,
  };
}
