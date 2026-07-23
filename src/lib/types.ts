// Shared types for the Jamaat Directory.
//
// Two families of shapes:
//   *Row      — raw D1 rows (mirror migrations/0001_init.sql). May contain phones.
//   Public*   — the shapes that appear in directory.json. NEVER contain phones.
//
// buildSnapshot() is the only bridge between them, and it uses explicit
// field allowlists so a phone number is structurally unable to reach the snapshot.

export type Region = 'north' | 'south' | 'east' | 'west' | 'central';
export type RowStatus = 'pending' | 'live' | 'flagged' | 'removed';
export type FacilityKind = 'masjid' | 'musafir_khana' | 'hotel' | 'restaurant';
export type ChargesBand = 'free' | 'donation' | 'paid';

// ---------------------------------------------------------------------------
// Raw D1 rows
// ---------------------------------------------------------------------------

export interface CityRow {
  id: string;
  name: string;
  jamaat_name: string;
  state: string | null;
  aliases: string | null; // JSON array string
  region: Region | null;
  nearest_rail: string | null;
  nearest_air: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ContactRow {
  id: string;
  city_id: string;
  name: string;
  phone: string; // E.164 — NEVER published
  whatsapp: number; // 0/1
  role: string | null;
  helps_with: string | null;
  best_time: string | null;
  languages: string | null;
  self_added: number; // 0/1
  consent: number; // 0/1
  status: RowStatus;
  verified_at: string | null;
  created_at: string;
}

export interface FacilityRow {
  id: string;
  city_id: string;
  kind: FacilityKind;
  name: string;
  address: string | null;
  maps_url: string | null;
  phone: string | null; // NEVER published
  timings: string | null;
  charges_band: ChargesBand | null;
  booking_note: string | null;
  facilities: string | null; // JSON array string
  status: RowStatus;
  verified_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Public snapshot (directory.json) — no phone fields anywhere
// ---------------------------------------------------------------------------

export interface PublicContact {
  id: string;
  name: string;
  whatsapp: boolean;
  role: string | null;
  helps_with: string | null;
  best_time: string | null;
  languages: string | null;
  verified_at: string | null;
  stale: boolean; // verified_at missing or older than 12 months
}

export interface PublicFacility {
  id: string;
  kind: FacilityKind;
  name: string;
  address: string | null;
  maps_url: string | null;
  timings: string | null;
  charges_band: ChargesBand | null;
  booking_note: string | null;
  facilities: string[];
  verified_at: string | null;
  stale: boolean;
}

/** The status chips a traveller reads at a glance (contact + facility kinds). */
export interface CityHas {
  contact: boolean;
  masjid: boolean;
  stay: boolean; // musafir khana
  hotel: boolean;
  restaurant: boolean;
}

export interface PublicCity {
  id: string;
  name: string;
  jamaat_name: string;
  state: string | null;
  region: Region | null;
  aliases: string[];
  nearest_rail: string | null;
  nearest_air: string | null;
  notes: string | null;
  contacts: PublicContact[];
  facilities: PublicFacility[];
  has: CityHas;
}

export interface Snapshot {
  generated_at: string;
  counts: { cities: number; contacts: number; facilities: number };
  /** Most recent verified/updated timestamp across published data. Powers the coverage line. */
  updated_at: string | null;
  cities: PublicCity[];
}
