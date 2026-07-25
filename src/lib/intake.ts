// First-party intake: turn an in-site submission into staging (pending) rows.
//
// Pure and dependency-free so it is unit-testable and reusable by /api/submit.
// Every row is forced to status='pending' — nothing a submitter sends is public
// until a moderator approves it. Deterministic ids make re-submits/edits map to
// the same row (idempotent upsert), mirroring the retired Apps Script.

import type { CityRow, ContactRow, FacilityRow, FacilityKind } from './types';

export interface SubmittedContact {
  name: string;
  phone: string;
  whatsapp?: boolean;
  role?: string;
  helps_with?: string;
  best_time?: string;
  languages?: string;
  self?: boolean; // submitter is adding their own details
  consent?: boolean; // has the person's consent to publish
  how_known?: string; // how the submitter knows this person (trust signal)
  knows?: string; // does the person know they're being submitted
}

export interface SubmittedFacility {
  kind: FacilityKind;
  name: string;
  address?: string;
  maps_url?: string;
  phone?: string;
  timings?: string;
  charges_band?: string;
  booking_note?: string;
  facilities?: string[]; // chips
}

export interface SubmitPayload {
  city: {
    name: string;
    jamaat_name?: string;
    state?: string;
    nearest_rail?: string;
    nearest_air?: string;
    notes?: string;
  };
  contacts?: SubmittedContact[];
  facilities?: SubmittedFacility[];
}

export interface PendingRows {
  city: CityRow;
  contacts: ContactRow[];
  facilities: FacilityRow[];
}

const KINDS: FacilityKind[] = ['masjid', 'musafir_khana', 'hotel', 'restaurant'];

export function slug(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';
}

function last4(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : d || '0000';
}

function clean(v: string | undefined | null): string | null {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
}

/** Validate + normalize a submission into pending D1 rows. Throws on no city. */
export function buildPendingRows(payload: SubmitPayload, now: string = new Date().toISOString()): PendingRows {
  const cityName = (payload.city?.name ?? '').trim();
  if (!cityName) throw new Error('city name is required');
  const cityId = slug(cityName);

  const city: CityRow = {
    id: cityId,
    name: cityName,
    jamaat_name: (payload.city.jamaat_name ?? '').trim(),
    state: clean(payload.city.state),
    aliases: '[]',
    region: null, // a moderator can set the region later
    nearest_rail: clean(payload.city.nearest_rail),
    nearest_air: clean(payload.city.nearest_air),
    notes: clean(payload.city.notes),
    status: 'pending',
    updated_at: now,
  };

  const contacts: ContactRow[] = [];
  for (const c of payload.contacts ?? []) {
    const name = (c.name ?? '').trim();
    const phone = (c.phone ?? '').trim();
    if (!name || !phone) continue;
    const provenance = [
      clean(c.how_known) ? `Known: ${clean(c.how_known)}` : '',
      clean(c.knows) ? `They know: ${clean(c.knows)}` : '',
    ].filter(Boolean).join(' · ') || null;
    contacts.push({
      id: `c-${cityId}-${slug(name)}-${last4(phone)}`,
      city_id: cityId,
      name,
      phone,
      whatsapp: c.whatsapp ? 1 : 0,
      role: clean(c.role),
      helps_with: clean(c.helps_with),
      best_time: clean(c.best_time),
      languages: clean(c.languages),
      self_added: c.self ? 1 : 0,
      consent: c.consent ? 1 : 0,
      provenance,
      status: 'pending',
      verified_at: null, // set on approval
      created_at: now,
    });
  }

  const facilities: FacilityRow[] = [];
  for (const f of payload.facilities ?? []) {
    const name = (f.name ?? '').trim();
    if (!name || !KINDS.includes(f.kind)) continue;
    facilities.push({
      id: `f-${cityId}-${f.kind}-${slug(name)}`,
      city_id: cityId,
      kind: f.kind,
      name,
      address: clean(f.address),
      maps_url: clean(f.maps_url),
      phone: clean(f.phone),
      timings: clean(f.timings),
      charges_band: (clean(f.charges_band) as FacilityRow['charges_band']) ?? null,
      booking_note: clean(f.booking_note),
      facilities: JSON.stringify(Array.isArray(f.facilities) ? f.facilities.map(String) : []),
      status: 'pending',
      verified_at: null,
      created_at: now,
    });
  }

  return { city, contacts, facilities };
}
