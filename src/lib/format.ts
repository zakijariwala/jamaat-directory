// Small, dependency-free date formatting for the UI.

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/** "12 JUN 2026" (uppercase, for verified dates). Empty string if invalid. */
export function formatVerified(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Coverage-line freshness: "TODAY" | "YESTERDAY" | "N DAYS AGO" | "ON 12 JUN 2026". */
export function relativeDays(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((now - t) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 30) return `${days} DAYS AGO`;
  return `ON ${formatVerified(iso)}`;
}
