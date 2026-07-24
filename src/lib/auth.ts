// Shared-passcode admin auth for the moderation endpoints.
//
// A moderator posts the passcode to /api/login; on success we set an HttpOnly
// cookie carrying an expiry, HMAC-signed with the passcode itself so it cannot
// be forged. Admin endpoints call requireAdmin(). No user table, no sessions DB.

import { hmacSha256Hex, verifySignature } from './hmac';

const COOKIE = 'admin_session';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

/** Constant-time string equality (avoids leaking the passcode via timing). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signed cookie value: "<expiryMs>.<hmac(expiryMs)>". */
export async function makeSession(secret: string, now: number = Date.now()): Promise<string> {
  const exp = String(now + TTL_MS);
  const sig = await hmacSha256Hex(secret, exp);
  return `${exp}.${sig}`;
}

export async function verifySessionValue(
  secret: string,
  value: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < now) return false;
  return verifySignature(secret, exp, sig);
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** True when the request carries a valid admin session cookie. */
export async function requireAdmin(request: Request, secret: string): Promise<boolean> {
  if (!secret) return false;
  return verifySessionValue(secret, readCookie(request, COOKIE));
}

export function sessionSetCookie(value: string): string {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${TTL_MS / 1000}; HttpOnly; Secure; SameSite=Lax`;
}
