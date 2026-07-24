import { describe, it, expect } from 'vitest';
import { hmacSha256Hex, verifySignature } from '../src/lib/hmac';
import { buildIngestStatements, type IngestPayload } from '../src/lib/ingest';
import type { CityRow, ContactRow } from '../src/lib/types';

describe('HMAC signing', () => {
  const secret = 'shared-secret';

  it('verifies a signature it produced', async () => {
    const body = JSON.stringify({ submission_id: 'row-1' });
    const sig = await hmacSha256Hex(secret, body);
    expect(await verifySignature(secret, body, sig)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const sig = await hmacSha256Hex(secret, '{"submission_id":"row-1"}');
    expect(await verifySignature(secret, '{"submission_id":"row-2"}', sig)).toBe(false);
  });

  it('rejects the wrong secret and an empty signature', async () => {
    const body = '{"a":1}';
    const sig = await hmacSha256Hex(secret, body);
    expect(await verifySignature('other', body, sig)).toBe(false);
    expect(await verifySignature(secret, body, '')).toBe(false);
  });
});

describe('buildIngestStatements', () => {
  const city: CityRow = {
    id: 'ooty', name: 'Ooty', jamaat_name: 'Ooty Jamaat', state: 'Tamil Nadu',
    aliases: JSON.stringify(['udhagamandalam']), region: 'south',
    nearest_rail: 'Udagamandalam (UAM)', nearest_air: 'Coimbatore (CJB)',
    notes: null, status: 'live', updated_at: '2026-07-23T00:00:00Z',
  };
  const contact: ContactRow = {
    id: 'c-ooty-1', city_id: 'ooty', name: 'Test Person', phone: '+919000000099',
    whatsapp: 1, role: 'Trustee', helps_with: 'Accommodation', best_time: null,
    languages: 'Tamil', self_added: 0, consent: 1, status: 'live',
    verified_at: '2026-07-23T00:00:00Z', created_at: '2026-07-23T00:00:00Z',
  };

  it('emits an idempotent upsert per row', () => {
    const payload: IngestPayload = { submission_id: 's1', city, contacts: [contact] };
    const stmts = buildIngestStatements(payload);
    expect(stmts).toHaveLength(2);
    expect(stmts[0].query).toContain('INSERT OR REPLACE INTO cities');
    expect(stmts[0].params).toContain('ooty');
    expect(stmts[1].query).toContain('INSERT OR REPLACE INTO contacts');
    // phone is carried into D1 (server side) — it just never reaches the snapshot.
    expect(stmts[1].params).toContain('+919000000099');
  });

  it('maps a removal to a status update, not a delete', () => {
    const payload: IngestPayload = {
      submission_id: 's2',
      remove: [{ type: 'contact', id: 'c-ooty-1' }],
    };
    const stmts = buildIngestStatements(payload);
    expect(stmts).toHaveLength(1);
    expect(stmts[0].query).toContain("UPDATE contacts SET status = 'removed'");
    expect(stmts[0].params).toEqual(['c-ooty-1']);
  });

  it('returns nothing for an empty payload', () => {
    expect(buildIngestStatements({ submission_id: 's3' })).toHaveLength(0);
  });
});
