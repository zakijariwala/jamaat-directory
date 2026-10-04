# Pilot data (15 cities)

Collected with Gemini (`docs/gemini-data-prompts.md`), cross-checked against
KhojaPedia, Shia Portal and ksijbhavnagar.org, and **verified manually by Zaki
(3 Oct 2026)**. The only phone numbers are businesses' own numbers as listed on
Google Maps (no personal numbers), so these files are committed. Numbers are
still served only through **Show number**, never in the public data.

| File | Rows |
|---|---|
| `phase-2-jamaats.csv` | 15 jamaat (city) rows |
| `phase-3-masjids-stays.csv` | 11 masjids / imambargahs, 1 musafir khana |
| `phase-4-food-hotels.csv` | 16 halal restaurants, 12 hotels (7 cities) |
| `phase-4b-food-hotels.csv` | 16 restaurants, 14 hotels for the other 8 cities; 15 non-halal or wrongly placed restaurants removed |

Load all four in one go (after the go-live steps: migrate, clear, deploy):

```bash
npm run db:import-pilot
```

Phase 2 must be imported together with or before the others, so the cities get
their jamaat names. Everything lands as pending: approve in `/moderate` (or
Download Excel → set `status` to `live` → Upload), then **Publish to site**.

Map links are Google Maps searches, not place pins; replace them with each
place's share link over time.

**Halal screening (4b):** pure-veg, dhaba, bar-style and unnamed places were
removed. Kept restaurants are Muslim-named or in Muslim areas; all are
`halal = Not sure` except Kareem's. Sigdi (Jamnagar) and Hyderabad Swadh
(Chandrapur) are marked "halal to confirm" in their private source note.
Pithalpur's two hotels are in Talaja, the nearest town.

**Coverage after import:** every city has a hotel. No restaurant yet in
Bhavnagar, Hinganghat or Pithalpur; no masjid/stay yet in Vadodara, Jamnagar,
Una, Pithalpur, Nagpur, Chandrapur, Hinganghat, Raipur.
