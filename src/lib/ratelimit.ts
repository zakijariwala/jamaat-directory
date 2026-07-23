// Per-IP rate limiting for /api/reveal, backed by Cloudflare KV.
//
// Limits (packet §"API surface"): 20 reveals/hour, 60/day per IP.
// We count into fixed hour/day buckets with matching TTLs. This is a soft
// limiter (KV is eventually consistent and check-then-increment has a small
// race) — which is exactly the realistic threat model: make bulk scraping slow
// and pointless, not impossible.
//
// The IP is only ever used to derive a bucket key; it is never stored or logged.

export const HOUR_LIMIT = 20;
export const DAY_LIMIT = 60;

/** Minimal KV surface, so this is unit-testable without the Workers runtime. */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export type RateResult =
  | { allowed: true; hourRemaining: number; dayRemaining: number }
  | { allowed: false; scope: 'hour' | 'day'; retryAfter: number };

const HOUR = 3600;
const DAY = 86400;

export async function checkAndIncrement(
  kv: KVLike,
  ip: string,
  now: number = Date.now(),
): Promise<RateResult> {
  const hourBucket = Math.floor(now / 1000 / HOUR);
  const dayBucket = Math.floor(now / 1000 / DAY);
  const hourKey = `rl:h:${ip}:${hourBucket}`;
  const dayKey = `rl:d:${ip}:${dayBucket}`;

  const [hRaw, dRaw] = await Promise.all([kv.get(hourKey), kv.get(dayKey)]);
  const hourCount = hRaw ? parseInt(hRaw, 10) || 0 : 0;
  const dayCount = dRaw ? parseInt(dRaw, 10) || 0 : 0;

  if (hourCount >= HOUR_LIMIT) {
    const retryAfter = HOUR - Math.floor((now / 1000) % HOUR);
    return { allowed: false, scope: 'hour', retryAfter };
  }
  if (dayCount >= DAY_LIMIT) {
    const retryAfter = DAY - Math.floor((now / 1000) % DAY);
    return { allowed: false, scope: 'day', retryAfter };
  }

  await Promise.all([
    kv.put(hourKey, String(hourCount + 1), { expirationTtl: HOUR }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: DAY }),
  ]);

  return {
    allowed: true,
    hourRemaining: HOUR_LIMIT - hourCount - 1,
    dayRemaining: DAY_LIMIT - dayCount - 1,
  };
}
