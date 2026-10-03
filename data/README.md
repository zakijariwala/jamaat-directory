# Importing listings (halal restaurants, hotels, masjids, musafir khanas)

Real data reaches the directory two ways: people use `/contribute`, or a
supplied list is bulk-imported with the steps below. **Nothing is typed into
the seed by hand.** `src/data/seed.ts` is fictional test data only and is
removed from the live database with `npm run db:purge-samples`.

## 1. Prepare the list

Use `templates/listings-template.csv` or any CSV/Excel file. Only the **first
sheet** of an Excel file is read. Header names are matched loosely, so
`Restaurant Name`, `Phone Number` or `Google Maps Link` all work.

| Column | Required | Notes |
|---|---|---|
| `kind` | yes* | `restaurant`, `hotel`, `masjid`, `musafir_khana`. *Omit it and pass `--kind restaurant` for a single-type list. |
| `name` | yes | |
| `city` | yes | Matched against existing cities **including old names** (Poona → Pune). Unknown cities are created as *pending*. |
| `state` | recommended | Sets the region automatically. |
| `address` | recommended | Also separates two outlets of the same chain in one city. |
| `maps_url` | recommended | A Google Maps link. |
| `phone` | optional | Normalised to `+91…`. Never published; shown one-at-a-time via **Show number**. |
| `timings` | optional | |
| `price_band` | optional | `Budget` / `Mid-range` / `Higher-end` |
| `halal` | optional | `Strictly Halal` / `Halal options available` / `Not sure` (`Yes` → Strictly Halal) |
| `features` | optional | Separated by `;` or `,`, e.g. `Parking; Family section` |
| `notes` | optional | **Public**: shown on the listing. |
| `source` | optional | **Private**: where the row came from. Defaults to the file name. |

## 2. Generate the SQL

```bash
npm run import:listings -- data/imports/kgn.csv --kind restaurant --source "KGN list Oct 2026"
```

The script prints every **skipped** row (missing name/city/kind) and every row
to **check** (unrecognised phone, halal value, no state, no address or map
link). It writes `import.sql`, which is gitignored because it contains phone
numbers.

## 3. Load and approve

```bash
npx wrangler d1 execute jamaat_directory --remote --file=import.sql
```

Everything lands as **pending**. Approve in `/moderate`. A listing in a *new*
city shows only after that city is approved too, and the moderator should
fill in the jamaat name. Re-running the same list is safe: rows already in the
database are left untouched.

Keep supplied lists in `data/imports/` locally. They are gitignored, so phone
numbers don't end up in the repo.
