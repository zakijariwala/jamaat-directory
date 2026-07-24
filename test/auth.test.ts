import { describe, it, expect } from 'vitest';
import { makeSession, verifySessionValue, safeEqual } from '../src/lib/auth';

const SECRET = 'moderator-passcode';

describe('safeEqual', () => {
  it('matches equal strings, rejects different ones and length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});

describe('admin session cookie', () => {
  it('verifies a session it produced', async () => {
    const now = Date.parse('2026-07-25T00:00:00Z');
    const value = await makeSession(SECRET, now);
    expect(await verifySessionValue(SECRET, value, now + 1000)).toBe(true);
  });

  it('rejects the wrong secret', async () => {
    const value = await makeSession(SECRET);
    expect(await verifySessionValue('other', value)).toBe(false);
  });

  it('rejects a tampered expiry', async () => {
    const now = Date.parse('2026-07-25T00:00:00Z');
    const value = await makeSession(SECRET, now);
    const forged = value.replace(/^\d+/, String(now + 999_999_999));
    expect(await verifySessionValue(SECRET, forged, now)).toBe(false);
  });

  it('rejects an expired session', async () => {
    const now = Date.parse('2026-07-25T00:00:00Z');
    const value = await makeSession(SECRET, now);
    expect(await verifySessionValue(SECRET, value, now + 13 * 60 * 60 * 1000)).toBe(false);
  });

  it('rejects empty/garbage values', async () => {
    expect(await verifySessionValue(SECRET, null)).toBe(false);
    expect(await verifySessionValue(SECRET, 'garbage')).toBe(false);
  });
});
