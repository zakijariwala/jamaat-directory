import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../src/lib/snapshot';
import { cities, contacts, facilities } from '../src/data/seed';
import type { FlagRow, PublicContact } from '../src/lib/types';

// Fixed "now" so the stale calculations are deterministic (matches the PRD's
// working date). 2026-07-23.
const NOW = Date.parse('2026-07-23T00:00:00Z');
const snap = buildSnapshot(cities, contacts, facilities, NOW);

function allPublicContacts(): PublicContact[] {
  return snap.cities.flatMap((c) => c.contacts);
}

describe('no phone numbers in the snapshot (non-negotiable rule 1)', () => {
  const json = JSON.stringify(snap);

  it('contains none of the exact seed phone numbers', () => {
    const seedPhones = [
      ...contacts.map((c) => c.phone),
      ...facilities.map((f) => f.phone).filter((p): p is string => !!p),
    ];
    expect(seedPhones.length).toBeGreaterThan(0);
    for (const phone of seedPhones) {
      expect(json).not.toContain(phone);
      expect(json).not.toContain(phone.replace('+', '')); // digits-only form too
    }
  });

  it('contains no phone-like pattern (8+ consecutive digits, or +91…)', () => {
    // ISO dates (max 4 consecutive digits) and place-name maps URLs do not trip this.
    expect(json).not.toMatch(/\d{8,}/);
    expect(json).not.toMatch(/\+91\d/);
  });

  it('never emits a "phone" key anywhere in the tree', () => {
    expect(json).not.toMatch(/"phone"\s*:/);
  });
});

describe('publish rules', () => {
  it('excludes an unconsented, non-self-added contact even when status=live (rule 3)', () => {
    const ids = allPublicContacts().map((c) => c.id);
    expect(ids).not.toContain('c-kolkata-unconsented');
  });

  it('publishes a self-added contact with consent=0', () => {
    const ids = allPublicContacts().map((c) => c.id);
    expect(ids).toContain('c-pune-2');
  });

  it('excludes removed and pending contacts (rule 2)', () => {
    const ids = allPublicContacts().map((c) => c.id);
    expect(ids).not.toContain('c-chennai-removed');
    expect(ids).not.toContain('c-delhi-pending');
  });

  it('excludes a pending facility', () => {
    const facilityIds = snap.cities.flatMap((c) => c.facilities.map((f) => f.id));
    expect(facilityIds).not.toContain('f-chennai-musafir-pending');
  });

  it('publishes ordinary live, consented contacts', () => {
    const ids = allPublicContacts().map((c) => c.id);
    expect(ids).toContain('c-sangli-1');
    expect(ids).toContain('c-chennai-1');
  });
});

describe('stale flag (verified_at older than 12 months)', () => {
  it('marks a contact verified > 12 months ago as stale', () => {
    const c = allPublicContacts().find((x) => x.id === 'c-kolkata-1');
    expect(c?.stale).toBe(true);
  });

  it('marks a recently verified contact as fresh', () => {
    const c = allPublicContacts().find((x) => x.id === 'c-sangli-1');
    expect(c?.stale).toBe(false);
  });

  it('marks a facility verified > 12 months ago as stale', () => {
    const f = snap.cities
      .flatMap((c) => c.facilities)
      .find((x) => x.id === 'f-lucknow-masjid');
    expect(f?.stale).toBe(true);
  });
});

describe('city status (staging gate)', () => {
  it('excludes a pending city from the snapshot', () => {
    const pendingCity = {
      id: 'staging-town', name: 'Staging Town', jamaat_name: 'Test Jamaat',
      state: null, aliases: '[]', region: null, nearest_rail: null,
      nearest_air: null, notes: null, status: 'pending' as const,
      updated_at: '2026-07-25T00:00:00Z',
    };
    const snap2 = buildSnapshot([...cities, pendingCity], contacts, facilities, NOW);
    expect(snap2.cities.find((c) => c.id === 'staging-town')).toBeUndefined();
    expect(snap2.counts.cities).toBe(snap.counts.cities); // unchanged
  });
});

describe('city presence and status chips', () => {
  it('includes a masjid-only city with the contact chip greyed', () => {
    const bhavnagar = snap.cities.find((c) => c.id === 'bhavnagar');
    expect(bhavnagar).toBeDefined();
    expect(bhavnagar?.has.masjid).toBe(true);
    expect(bhavnagar?.has.contact).toBe(false);
    expect(bhavnagar?.contacts).toHaveLength(0);
  });

  it('derives all chips from published children', () => {
    const pune = snap.cities.find((c) => c.id === 'pune');
    expect(pune?.has).toEqual({
      contact: true,
      masjid: true,
      stay: true,
      hotel: true,
      restaurant: true,
    });
  });

  it('greys the restaurant chip for a city without one', () => {
    const sangli = snap.cities.find((c) => c.id === 'sangli');
    expect(sangli?.has.restaurant).toBe(false);
    expect(snap.cities.find((c) => c.id === 'pune')?.has.restaurant).toBe(true);
  });

  it('lists cities alphabetically', () => {
    const names = snap.cities.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

describe('caution flag (unresolved problem report > 48h)', () => {
  const flag = (over: Partial<FlagRow>): FlagRow => ({
    id: 'flag-1',
    target_type: 'contact',
    target_id: 'c-sangli-1',
    reason: 'wrong number',
    kind: 'problem',
    resolved: 0,
    created_at: '2026-07-20T00:00:00Z', // 3 days before NOW
    ...over,
  });

  const cautionOf = (id: string, flags: FlagRow[]) =>
    buildSnapshot(cities, contacts, facilities, NOW, flags)
      .cities.flatMap((c) => c.contacts)
      .find((c) => c.id === id)?.caution;

  it('marks an entry with a problem report older than 48h', () => {
    expect(cautionOf('c-sangli-1', [flag({})])).toBe(true);
  });

  it('does not flag a report younger than 48h', () => {
    expect(cautionOf('c-sangli-1', [flag({ created_at: '2026-07-22T06:00:00Z' })])).toBe(false);
  });

  it('does not flag a resolved report', () => {
    expect(cautionOf('c-sangli-1', [flag({ resolved: 1 })])).toBe(false);
  });

  it('does not flag on a removal_request (only problem reports caution)', () => {
    expect(cautionOf('c-sangli-1', [flag({ kind: 'removal_request' })])).toBe(false);
  });

  it('defaults to no caution when no flags are supplied', () => {
    const c = snap.cities.flatMap((x) => x.contacts).find((x) => x.id === 'c-sangli-1');
    expect(c?.caution).toBe(false);
  });
});

describe('counts and coverage', () => {
  it('counts only published rows', () => {
    // 11 cities; published contacts exclude removed/pending/unconsented (3 dropped).
    expect(snap.counts.cities).toBe(11);
    expect(snap.counts.contacts).toBe(contacts.length - 3);
  });

  it('exposes a most-recent updated_at for the coverage line', () => {
    expect(snap.updated_at).toBeTruthy();
  });
});
