import { describe, it, expect } from 'vitest';
import { buildPendingRows, slug, type SubmitPayload } from '../src/lib/intake';

const NOW = '2026-07-25T00:00:00Z';

describe('slug', () => {
  it('lowercases and hyphenates, strips punctuation', () => {
    expect(slug('  Dar es Salaam ')).toBe('dar-es-salaam');
    expect(slug('Panvel!')).toBe('panvel');
    expect(slug('')).toBe('x');
  });
});

describe('buildPendingRows', () => {
  const base: SubmitPayload = {
    city: { name: 'Panvel', jamaat_name: 'Panvel Shia Jamat', state: 'Maharashtra' },
    contacts: [
      { name: 'Shujaat Ali', phone: '+91 9320201572', self: true, whatsapp: true, role: 'Member' },
    ],
    facilities: [
      { kind: 'masjid', name: 'Panvel Imambada', address: 'Old Panvel' },
    ],
  };

  it('forces every row to pending status', () => {
    const { city, contacts, facilities } = buildPendingRows(base, NOW);
    expect(city.status).toBe('pending');
    expect(contacts[0].status).toBe('pending');
    expect(facilities[0].status).toBe('pending');
  });

  it('derives a stable city id from the name', () => {
    expect(buildPendingRows(base, NOW).city.id).toBe('panvel');
  });

  it('carries consent flags through (self vs consent)', () => {
    const { contacts } = buildPendingRows(base, NOW);
    expect(contacts[0].self_added).toBe(1);
    expect(contacts[0].consent).toBe(0);
  });

  it('gives deterministic contact/facility ids for idempotent upserts', () => {
    const a = buildPendingRows(base, NOW);
    const b = buildPendingRows(base, NOW);
    expect(a.contacts[0].id).toBe(b.contacts[0].id);
    expect(a.facilities[0].id).toBe(b.facilities[0].id);
    expect(a.contacts[0].id).toContain('panvel');
  });

  it('skips a contact with no phone and a facility with no name', () => {
    const { contacts, facilities } = buildPendingRows({
      city: { name: 'Test' },
      contacts: [{ name: 'No Phone', phone: '' }],
      facilities: [{ kind: 'masjid', name: '' }],
    }, NOW);
    expect(contacts).toHaveLength(0);
    expect(facilities).toHaveLength(0);
  });

  it('throws when the city name is missing', () => {
    expect(() => buildPendingRows({ city: { name: '' } }, NOW)).toThrow();
  });

  it('never lets a submitter set a live status (no status field is read)', () => {
    const sneaky = { city: { name: 'X' }, contacts: [{ name: 'A', phone: '1', status: 'live' }] } as unknown as SubmitPayload;
    expect(buildPendingRows(sneaky, NOW).contacts[0].status).toBe('pending');
  });
});
