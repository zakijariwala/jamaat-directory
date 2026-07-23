import { describe, it, expect } from 'vitest';
import { checkAndIncrement, HOUR_LIMIT, DAY_LIMIT, type KVLike } from '../src/lib/ratelimit';

/** In-memory KV that ignores TTL — enough to exercise the counting logic. */
function fakeKV(): KVLike {
  const store = new Map<string, string>();
  return {
    get: async (k) => store.get(k) ?? null,
    put: async (k, v) => {
      store.set(k, v);
    },
  };
}

const IP = '203.0.113.7';

describe('reveal rate limiter', () => {
  it('allows up to the hourly limit then trips', async () => {
    const kv = fakeKV();
    const now = Date.parse('2026-07-23T10:15:00Z');
    for (let i = 0; i < HOUR_LIMIT; i++) {
      const r = await checkAndIncrement(kv, IP, now);
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkAndIncrement(kv, IP, now);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('hour');
      expect(blocked.retryAfter).toBeGreaterThan(0);
    }
  });

  it('resets in the next hour bucket', async () => {
    const kv = fakeKV();
    const hour1 = Date.parse('2026-07-23T10:15:00Z');
    for (let i = 0; i < HOUR_LIMIT; i++) await checkAndIncrement(kv, IP, hour1);
    expect((await checkAndIncrement(kv, IP, hour1)).allowed).toBe(false);

    const hour2 = Date.parse('2026-07-23T11:05:00Z');
    expect((await checkAndIncrement(kv, IP, hour2)).allowed).toBe(true);
  });

  it('trips the daily limit across hours', async () => {
    const kv = fakeKV();
    const base = Date.parse('2026-07-23T00:30:00Z');
    let allowed = 0;
    // Spread requests one per hour so the hourly bucket never trips first.
    for (let h = 0; h < 24; h++) {
      const now = base + h * 3600_000;
      for (let i = 0; i < 5; i++) {
        const r = await checkAndIncrement(kv, IP, now);
        if (r.allowed) allowed++;
        else {
          expect(r.scope).toBe('day');
        }
      }
    }
    expect(allowed).toBe(DAY_LIMIT);
  });

  it('tracks different IPs independently', async () => {
    const kv = fakeKV();
    const now = Date.parse('2026-07-23T10:15:00Z');
    for (let i = 0; i < HOUR_LIMIT; i++) await checkAndIncrement(kv, IP, now);
    expect((await checkAndIncrement(kv, IP, now)).allowed).toBe(false);
    expect((await checkAndIncrement(kv, '198.51.100.9', now)).allowed).toBe(true);
  });
});
