// Bulk listing import: rows from a supplied spreadsheet (halal restaurants,
// hotels, masjids, musafir khanas) -> pending D1 rows. Rows with kind
// `jamaat` describe the city itself (jamaat name, stations, office number).
//
// Pure and dependency-free so it is unit-testable; scripts/import-listings.ts
// does the file reading and SQL writing. Same rules as the public intake:
//   - every row lands as status='pending' — nothing goes live without a moderator
//   - deterministic ids, so re-importing the same list is a no-op
//   - cities that don't exist yet are created as 'pending' (never overwrite an
//     existing city — the SQL uses INSERT OR IGNORE)

import type { CityRow, FacilityKind, FacilityRow, Region } from './types';
import { slug } from './intake';
import { normalizePhone } from './phone';

export type RawRecord = Record<string, unknown>;

export interface ImportIssue {
  row: number; // 1-based data row (header excluded); spreadsheet line = row + 1
  message: string;
}

export interface KnownCity {
  id: string;
  name: string;
  aliases?: string[];
}

export interface ImportResult {
  cities: CityRow[]; // NEW cities only (inserted as pending); known cities are referenced by id
  facilities: FacilityRow[];
  errors: ImportIssue[]; // row skipped
  warnings: ImportIssue[]; // row kept, but a moderator should look
  duplicates: number; // rows that repeated an earlier row in the same import
}

export interface ImportOptions {
  /** Kind to use when the sheet has no `kind` column (e.g. a restaurants-only list). */
  defaultKind?: FacilityKind;
  /** Private provenance note stored on every row (e.g. the file name). */
  source?: string;
  /** Cities already in the directory (e.g. from the live directory.json), so
   *  "Poona" or "Bombay" attach to the existing city instead of creating one. */
  knownCities?: KnownCity[];
  now?: string;
}

// Header aliases -> canonical column. Matching is case/space/punctuation-insensitive.
const HEADER_ALIASES: Record<string, string[]> = {
  kind: ['kind', 'type', 'category'],
  name: ['name', 'restaurant', 'restaurantname', 'hotel', 'hotelname', 'placename', 'title', 'jamaatname'],
  city: ['city', 'town', 'cityortown'],
  state: ['state', 'stateut', 'stateunionterritory'],
  address: ['address', 'fulladdress', 'location', 'area'],
  maps_url: ['mapsurl', 'maps', 'map', 'mapslink', 'maplink', 'googlemaps', 'googlemapslink', 'url', 'link'],
  phone: ['phone', 'phonenumber', 'contact', 'contactnumber', 'mobile', 'tel'],
  timings: ['timings', 'hours', 'openinghours', 'timing'],
  price_band: ['priceband', 'price', 'pricerange', 'budget'],
  halal: ['halal', 'halalstatus'],
  features: ['features', 'tags', 'amenities'],
  notes: ['notes', 'note', 'bookingnote', 'remarks'],
  source: ['source'],
  charges: ['charges', 'chargesband', 'cost'],
  nearest_rail: ['nearestrail', 'railwaystation', 'nearestrailwaystation', 'station'],
  nearest_air: ['nearestair', 'airport', 'nearestairport'],
  aliases: ['aliases', 'oldnames', 'othernames', 'alsoknownas'],
};

const CHARGES: Record<string, FacilityRow['charges_band']> = { free: 'free', donation: 'donation', paid: 'paid' };

const KIND_ALIASES: Record<string, FacilityKind | 'jamaat'> = {
  jamaat: 'jamaat',
  jamat: 'jamaat',
  city: 'jamaat',
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  food: 'restaurant',
  hotel: 'hotel',
  hotels: 'hotel',
  lodge: 'hotel',
  masjid: 'masjid',
  mosque: 'masjid',
  imambargah: 'masjid',
  imambada: 'masjid',
  musafirkhana: 'musafir_khana',
  musafirkhanas: 'musafir_khana',
  guesthouse: 'musafir_khana',
};

// Same option lists the contribute form uses, so imported chips read identically.
const PRICE_BANDS = ['Budget', 'Mid-range', 'Higher-end'];
const HALAL_OPTS = ['Strictly Halal', 'Halal options available', 'Not sure'];

const STATE_REGION: Record<string, Region> = {
  // north
  'delhi': 'north', 'haryana': 'north', 'punjab': 'north', 'himachal pradesh': 'north',
  'jammu and kashmir': 'north', 'ladakh': 'north', 'uttarakhand': 'north',
  'uttar pradesh': 'north', 'chandigarh': 'north', 'rajasthan': 'north',
  // west
  'maharashtra': 'west', 'gujarat': 'west', 'goa': 'west',
  'dadra and nagar haveli and daman and diu': 'west',
  // central
  'madhya pradesh': 'central', 'chhattisgarh': 'central',
  // east (incl. north-east)
  'west bengal': 'east', 'bihar': 'east', 'jharkhand': 'east', 'odisha': 'east',
  'assam': 'east', 'sikkim': 'east', 'arunachal pradesh': 'east', 'nagaland': 'east',
  'manipur': 'east', 'mizoram': 'east', 'tripura': 'east', 'meghalaya': 'east',
  'andaman and nicobar islands': 'east',
  // south
  'karnataka': 'south', 'kerala': 'south', 'tamil nadu': 'south', 'telangana': 'south',
  'andhra pradesh': 'south', 'puducherry': 'south', 'lakshadweep': 'south',
};

function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ALIAS_TO_COLUMN = new Map<string, string>();
for (const [col, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const a of aliases) ALIAS_TO_COLUMN.set(a, col);
}

function text(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Re-key a raw record by canonical column name. Unknown headers are dropped. */
function canonical(record: RawRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, value] of Object.entries(record)) {
    const col = ALIAS_TO_COLUMN.get(key(header));
    if (col && !out[col]) out[col] = text(value);
  }
  return out;
}

export function regionForState(state: string | null): Region | null {
  if (!state) return null;
  return STATE_REGION[state.trim().toLowerCase()] ?? null;
}

function matchOption(value: string, options: string[]): string | null {
  const k = key(value);
  return options.find((o) => key(o) === k) ?? null;
}

/** Short, stable hash (FNV-1a, 6 hex chars) — disambiguates same-name outlets in one city. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/** Title-case a city name typed in any case ("AHMEDABAD" -> "Ahmedabad"). */
function cityDisplayName(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s; // already mixed case — trust it
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function buildListingRows(records: RawRecord[], opts: ImportOptions = {}): ImportResult {
  const now = opts.now ?? new Date().toISOString();
  const known = new Map<string, string>(); // key(name or alias) -> city id
  for (const c of opts.knownCities ?? []) {
    for (const n of [c.name, c.id, ...(c.aliases ?? [])]) known.set(key(n), c.id);
  }
  const cities = new Map<string, CityRow>();
  const facilities: FacilityRow[] = [];
  const seen = new Set<string>();
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  let duplicates = 0;

  records.forEach((record, i) => {
    const row = i + 1;
    const r = canonical(record);
    if (Object.values(r).every((v) => v === '')) return; // blank line

    const kind = r.kind ? KIND_ALIASES[key(r.kind)] : opts.defaultKind;
    if (!kind) {
      errors.push({ row, message: r.kind ? `unknown kind "${r.kind}"` : 'no kind (add a kind column or pass --kind)' });
      return;
    }
    if (!r.name) {
      errors.push({ row, message: 'missing name' });
      return;
    }
    if (!r.city) {
      errors.push({ row, message: `"${r.name}": missing city` });
      return;
    }

    const knownId = known.get(key(r.city));
    const cityId = knownId ?? slug(r.city);

    if (kind === 'jamaat') {
      // The city's own row: jamaat name, stations, office number. Fills in a
      // placeholder created by an earlier listing row for the same city.
      if (knownId) {
        warnings.push({ row, message: `"${r.city}" is already in the directory — change its details in /moderate, not by import` });
        return;
      }
      const state = r.state || cities.get(cityId)?.state || null;
      if (!state) warnings.push({ row, message: `city "${r.city}" has no state` });
      const office = normalizePhone(r.phone);
      if (office && !/^\+\d{10,15}$/.test(office)) {
        warnings.push({ row, message: `"${r.name}": office phone "${r.phone}" not recognised — check before approving` });
      }
      const aliases = (r.aliases || '').split(/[;,|]/).map((a) => a.trim().toLowerCase()).filter(Boolean);
      cities.set(cityId, {
        id: cityId,
        name: cityDisplayName(r.city),
        jamaat_name: r.name,
        state,
        aliases: JSON.stringify(aliases),
        region: regionForState(state),
        nearest_rail: r.nearest_rail || null,
        nearest_air: r.nearest_air || null,
        notes: r.notes || null,
        office_phone: office,
        status: 'pending',
        updated_at: now,
      });
      return;
    }

    if (!knownId && !cities.has(cityId)) {
      const state = r.state || null;
      if (!state) warnings.push({ row, message: `city "${r.city}" has no state` });
      cities.set(cityId, {
        id: cityId,
        name: cityDisplayName(r.city),
        jamaat_name: '', // unknown from a listing; a moderator fills it in
        state,
        aliases: '[]',
        region: regionForState(state),
        nearest_rail: null,
        nearest_air: null,
        notes: null,
        office_phone: null,
        status: 'pending',
        updated_at: now,
      });
    }

    const address = r.address || null;
    // Same-name outlets (chains) in one city are told apart by their address.
    const id = `f-${cityId}-${kind}-${slug(r.name)}${address ? `-${shortHash(key(address))}` : ''}`;
    if (seen.has(id)) {
      duplicates++;
      return;
    }
    seen.add(id);

    const phone = normalizePhone(r.phone);
    if (phone && !/^\+\d{10,15}$/.test(phone)) {
      warnings.push({ row, message: `"${r.name}": phone "${r.phone}" not recognised — check before approving` });
    }

    const chips: string[] = [];
    for (const f of (r.features || '').split(/[;,|]/)) {
      const t = f.trim();
      if (t) chips.push(t);
    }
    if (r.price_band) {
      const band = matchOption(r.price_band, PRICE_BANDS);
      chips.push(band ?? r.price_band);
      if (!band) warnings.push({ row, message: `"${r.name}": price band "${r.price_band}" is not one of ${PRICE_BANDS.join(' / ')}` });
    }
    if (r.halal) {
      const halal = matchOption(r.halal, HALAL_OPTS)
        ?? (/^(yes|y|halal|100%|fully halal|strict)$/i.test(r.halal) ? 'Strictly Halal' : null);
      chips.push(halal ?? r.halal);
      if (!halal) warnings.push({ row, message: `"${r.name}": halal value "${r.halal}" is not one of ${HALAL_OPTS.join(' / ')}` });
    }
    if (r.charges && !CHARGES[key(r.charges)]) {
      warnings.push({ row, message: `"${r.name}": charges "${r.charges}" is not free / donation / paid` });
    }
    if (!address && !r.maps_url) {
      warnings.push({ row, message: `"${r.name}": no address or map link — travellers can't find it` });
    }

    facilities.push({
      id,
      city_id: cityId,
      kind,
      name: r.name,
      address,
      maps_url: r.maps_url || null,
      phone,
      timings: r.timings || null,
      // free/donation/paid applies to musafir khanas; hotels use price band chips.
      charges_band: CHARGES[key(r.charges || '')] ?? null,
      booking_note: r.notes || null,
      facilities: JSON.stringify(chips),
      source: r.source || opts.source || null,
      status: 'pending',
      verified_at: null,
      created_at: now,
    });
  });

  return { cities: [...cities.values()], facilities, errors, warnings, duplicates };
}
