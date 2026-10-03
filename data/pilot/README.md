# Pilot data (15 cities)

Collected with Gemini (`docs/gemini-data-prompts.md`), cross-checked against
KhojaPedia, Shia Portal and ksijbhavnagar.org, and **verified manually by Zaki
(3 Oct 2026)**. No personal phone numbers, so these files are committed.

| File | Rows |
|---|---|
| `phase-2-jamaats.csv` | 15 jamaat (city) rows |
| `phase-3-masjids-stays.csv` | 11 masjids / imambargahs, 1 musafir khana |
| `phase-4-food-hotels.csv` | 16 halal restaurants, 12 hotels |

Load all three in one go (after the go-live steps: migrate, clear, deploy):

```bash
npm run db:import-pilot
```

Phase 2 must be imported together with or before the others, so the cities get
their jamaat names. Everything lands as pending: approve in `/moderate` (or
Download Excel → set `status` to `live` → Upload), then **Publish to site**.

Map links are Google Maps searches, not place pins; replace them with each
place's share link over time.
