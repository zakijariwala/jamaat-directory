import { describe, it, expect } from 'vitest';
import { buildListingRows, regionForState } from '../src/lib/listings';

const NOW = '2026-10-03T00:00:00Z';

describe('buildListingRows', () => {
  it('maps loose headers and makes pending rows', () => {
    const r = buildListingRows([
      {
        'Restaurant Name': 'KGN Restaurant',
        Type: 'Restaurant',
        City: 'Ahmedabad',
        State: 'Gujarat',
        'Full Address': 'Relief Road, Ahmedabad',
        'Google Maps Link': 'https://maps.app.goo.gl/x',
        'Phone Number': '098250 12345',
        Halal: 'Yes',
        Price: 'budget',
      },
    ], { now: NOW, source: 'kgn.csv' });
    expect(r.errors).toEqual([]);
    expect(r.facilities).toHaveLength(1);
    const f = r.facilities[0];
    expect(f).toMatchObject({
      kind: 'restaurant',
      name: 'KGN Restaurant',
      city_id: 'ahmedabad',
      address: 'Relief Road, Ahmedabad',
      maps_url: 'https://maps.app.goo.gl/x',
      phone: '+919825012345',
      source: 'kgn.csv',
      status: 'pending',
      verified_at: null,
    });
    expect(JSON.parse(f.facilities!)).toEqual(['Budget', 'Strictly Halal']);
    expect(r.cities).toEqual([
      expect.objectContaining({ id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', region: 'west', status: 'pending' }),
    ]);
  });

  it('uses --kind when the sheet has no kind column', () => {
    const r = buildListingRows([{ name: 'Hotel X', city: 'Surat' }], { defaultKind: 'hotel', now: NOW });
    expect(r.facilities[0].kind).toBe('hotel');
  });

  it('skips rows without kind, name or city, and ignores blank lines', () => {
    const r = buildListingRows([
      { name: 'No kind', city: 'Surat' },
      { kind: 'restaurant', city: 'Surat' },
      { kind: 'restaurant', name: 'No city' },
      { kind: 'spaceship', name: 'X', city: 'Surat' },
      { kind: '', name: '', city: '' },
    ], { now: NOW });
    expect(r.facilities).toHaveLength(0);
    expect(r.errors.map((e) => e.row)).toEqual([1, 2, 3, 4]);
  });

  it('keeps same-name outlets in one city apart by address, and drops exact repeats', () => {
    const row = (address: string) => ({ kind: 'restaurant', name: 'KGN', city: 'Mumbai', address });
    const r = buildListingRows([row('Mohammed Ali Road'), row('Kurla West'), row('Mohammed Ali Road')], { now: NOW });
    expect(r.facilities).toHaveLength(2);
    expect(new Set(r.facilities.map((f) => f.id)).size).toBe(2);
    expect(r.duplicates).toBe(1);
  });

  it('gives the same id on re-import (idempotent)', () => {
    const rows = [{ kind: 'hotel', name: 'Hotel Y', city: 'Pune', address: 'Camp' }];
    expect(buildListingRows(rows, { now: NOW }).facilities[0].id)
      .toBe(buildListingRows(rows, { now: '2027-01-01T00:00:00Z' }).facilities[0].id);
  });

  it('attaches to an existing city by name or alias instead of creating one', () => {
    const r = buildListingRows(
      [{ kind: 'restaurant', name: 'R', city: 'POONA' }],
      { now: NOW, knownCities: [{ id: 'pune', name: 'Pune', aliases: ['poona'] }] },
    );
    expect(r.facilities[0].city_id).toBe('pune');
    expect(r.cities).toEqual([]);
  });

  it('title-cases an all-caps new city name', () => {
    const r = buildListingRows([{ kind: 'restaurant', name: 'R', city: 'NAVI MUMBAI', state: 'Maharashtra' }], { now: NOW });
    expect(r.cities[0].name).toBe('Navi Mumbai');
    expect(r.cities[0].id).toBe('navi-mumbai');
  });

  it('warns (but keeps the row) on unknown halal/price values, bad phones, no location, no state', () => {
    const r = buildListingRows([
      { kind: 'restaurant', name: 'R', city: 'Vapi', phone: '123', halal: 'maybe', price: 'cheap' },
    ], { now: NOW });
    expect(r.facilities).toHaveLength(1);
    const msgs = r.warnings.map((w) => w.message).join('\n');
    expect(msgs).toMatch(/no state/);
    expect(msgs).toMatch(/phone/);
    expect(msgs).toMatch(/halal/);
    expect(msgs).toMatch(/price band/);
    expect(msgs).toMatch(/no address or map link/);
  });
});

describe('regionForState', () => {
  it('maps states to the five regions', () => {
    expect(regionForState('Gujarat')).toBe('west');
    expect(regionForState('madhya pradesh')).toBe('central');
    expect(regionForState('Tamil Nadu')).toBe('south');
    expect(regionForState('West Bengal')).toBe('east');
    expect(regionForState('Uttar Pradesh')).toBe('north');
    expect(regionForState('Atlantis')).toBeNull();
  });
});

describe('jamaat (city) rows', () => {
  it('creates the city with jamaat name, stations, office number and aliases', () => {
    const r = buildListingRows([
      { kind: 'restaurant', name: 'R', city: 'Mahuva', state: 'Gujarat' },
      {
        kind: 'jamaat', 'Jamaat Name': 'Mahuva Khoja Shia Isna Ashari Jamaat', city: 'Mahuva', state: 'Gujarat',
        'Nearest Railway Station': 'Mahuva (MHV)', 'Nearest Airport': 'Bhavnagar (BHU)', phone: '02844 222333',
        'Old Names': '',
      },
    ], { now: NOW });
    expect(r.cities).toHaveLength(1);
    expect(r.cities[0]).toMatchObject({
      id: 'mahuva', jamaat_name: 'Mahuva Khoja Shia Isna Ashari Jamaat',
      nearest_rail: 'Mahuva (MHV)', nearest_air: 'Bhavnagar (BHU)', office_phone: '+912844222333',
      region: 'west', status: 'pending',
    });
    expect(r.facilities).toHaveLength(1);
  });

  it('does not touch a city that already exists', () => {
    const r = buildListingRows(
      [{ kind: 'jamaat', name: 'J', city: 'Pune' }],
      { now: NOW, knownCities: [{ id: 'pune', name: 'Pune' }] },
    );
    expect(r.cities).toEqual([]);
    expect(r.warnings[0].message).toMatch(/already in the directory/);
  });

  it('maps musafir khana charges', () => {
    const r = buildListingRows([{ kind: 'musafir khana', name: 'MK', city: 'Surat', charges: 'Donation' }], { now: NOW });
    expect(r.facilities[0]).toMatchObject({ kind: 'musafir_khana', charges_band: 'donation' });
  });
});
