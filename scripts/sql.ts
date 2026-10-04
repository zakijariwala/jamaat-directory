// SQL text helpers for the generated .sql files (seed, listing import).
// Values are literal-escaped; the files are run with `wrangler d1 execute --file`.

export type Row = Record<string, string | number | null | undefined>;

export function sqlValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

export function insert(table: string, columns: string[], rows: Row[], verb = 'INSERT'): string {
  if (rows.length === 0) return '';
  const cols = columns.join(', ');
  return rows
    .map((row) => `${verb} INTO ${table} (${cols}) VALUES (${columns.map((c) => sqlValue(row[c])).join(', ')});`)
    .join('\n');
}
