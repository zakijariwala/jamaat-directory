// Client-side search over the in-memory snapshot.
//
// The single highest-value piece of the data model at national scale: a member
// will type the name they know (Madras, Poona, Calcutta, Bangalore, Baroda,
// Cochin, Trichy...), and it must resolve. Matching is case- and
// diacritic-insensitive and tolerant of extra spaces, across city name,
// jamaat name, state, and the aliases array.
//
// Pure and dependency-free so it is unit-testable and reusable by the frontend.

import type { PublicCity } from './types';

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining marks
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

type Searchable = Pick<PublicCity, 'name' | 'jamaat_name' | 'state' | 'aliases'>;

/** The normalized strings a query is tested against for one city. */
export function cityHaystack(city: Searchable): string[] {
  return [city.name, city.jamaat_name, city.state ?? '', ...city.aliases]
    .map(normalize)
    .filter((s) => s.length > 0);
}

export function cityMatches(city: Searchable, query: string): boolean {
  const q = normalize(query);
  if (q === '') return true; // empty query matches everything
  return cityHaystack(city).some((hay) => hay.includes(q));
}

export function filterCities(cities: PublicCity[], query: string): PublicCity[] {
  const q = normalize(query);
  if (q === '') return cities;
  return cities.filter((city) => cityMatches(city, q));
}
