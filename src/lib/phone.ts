// Phone normalisation shared by the public intake and the bulk listing import.
//
// Indian numbers are written many ways ("098200 12345", "+91-98200-12345",
// "9820012345"). Normalise the common forms to E.164 (+91XXXXXXXXXX) so the
// reveal endpoint returns a dialable number and WhatsApp links work. Anything
// we can't confidently recognise is returned trimmed but otherwise unchanged —
// a moderator sees it before it goes live.

export function normalizePhone(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;

  // Explicit international form: keep the country code as given.
  if (s.startsWith('+')) return `+${digits}`;
  if (s.startsWith('00') && digits.length > 10) return `+${digits.slice(2)}`;

  // Indian mobile (6-9 leading) or landline with STD code, 10 digits.
  if (digits.length === 10) return `+91${digits}`;
  // Trunk-prefixed: 0 + 10 digits.
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  // Country code without the plus.
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;

  return s;
}
