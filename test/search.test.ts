import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../src/lib/snapshot';
import { filterCities, normalize, cityMatches } from '../src/lib/search';
import { cities, contacts, facilities } from '../src/data/seed';

const snap = buildSnapshot(cities, contacts, facilities, Date.parse('2026-07-23T00:00:00Z'));

function idsFor(query: string): string[] {
  return filterCities(snap.cities, query).map((c) => c.id);
}

describe('normalize', () => {
  it('lowercases, strips diacritics, collapses whitespace', () => {
    expect(normalize('  Bengalūru  ')).toBe('bengaluru');
    expect(normalize('KOCHI')).toBe('kochi');
    expect(normalize('New   Delhi')).toBe('new delhi');
  });
});

describe('alias resolution — old names must resolve', () => {
  it('Madras -> Chennai', () => {
    expect(idsFor('madras')).toContain('chennai');
    expect(idsFor('MADRAS ')).toContain('chennai');
  });

  it('Calcutta -> Kolkata', () => {
    expect(idsFor('calcutta')).toContain('kolkata');
  });

  it('Poona -> Pune', () => {
    expect(idsFor('poona')).toContain('pune');
  });

  it('Bangalore and Bengaluru both resolve', () => {
    expect(idsFor('bangalore')).toContain('bengaluru');
    expect(idsFor('bengaluru')).toContain('bengaluru');
  });

  it('Cochin and Ernakulam -> Kochi', () => {
    expect(idsFor('cochin')).toContain('kochi');
    expect(idsFor('ernakulam')).toContain('kochi');
  });
});

describe('matching across fields', () => {
  it('matches on jamaat name', () => {
    expect(idsFor('poona khoja')).toContain('pune');
  });

  it('matches on state', () => {
    expect(idsFor('gujarat')).toContain('bhavnagar');
    expect(idsFor('kerala')).toContain('kochi');
  });

  it('matches on country', () => {
    expect(idsFor('united kingdom')).toContain('london');
    expect(idsFor('tanzania')).toContain('dar-es-salaam');
    expect(idsFor('canada')).toContain('toronto');
  });

  it('is case- and space-insensitive on the city name', () => {
    expect(cityMatches(snap.cities.find((c) => c.id === 'sangli')!, '  sAnGli ')).toBe(true);
  });

  it('empty query returns everything', () => {
    expect(filterCities(snap.cities, '   ')).toHaveLength(snap.cities.length);
  });

  it('non-existent city returns nothing (empty-state path)', () => {
    expect(idsFor('atlantis')).toHaveLength(0);
  });
});
