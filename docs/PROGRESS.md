# Progress

Where the project stands. Update this at the end of every working session.
Checklist detail lives in `TODO.md`; reasons in `DECISIONS.md`; blockers in
`DEPENDENCIES.md`.

**Last updated:** 3 October 2026

## Snapshot

| Area | State |
|---|---|
| Live site | https://jamaat-directory.pages.dev, unlisted (`noindex`), running `main` |
| Live data | Fictional samples + 1 test city (Mahuva). To be cleared at go-live. |
| Code | Core features done. 91 tests pass, typecheck and build clean. |
| Open PR | `feat/seed-import-and-representative`: office number + representative, bulk importer, pages from live DB, Publish to site, "Not listed yet" |
| Next | Go-live steps (below), then `npm run db:import-pilot` → approve → Publish |

## Go-live steps for the open PR (in order)

| # | Step | Who | Done |
|---|---|---|---|
| 1 | `npm run db:migrate` (migration 0005) **before** merging | Zaki | ☐ |
| 2 | `npm run db:clear` (empty live DB; approved, no real data in it) | Zaki | ☐ |
| 3 | Merge the PR into `main` | Zaki | ☐ |
| 4 | Pages deploy hook → `npx wrangler pages secret put DEPLOY_HOOK_URL` | Zaki | ☐ |
| 5 | `npm run deploy` (site rebuilds from the empty live DB) | Zaki | ☐ |

## Pilot data (15 cities)

Plan (decision 22): the 5 states that have jamaats: Gujarat 6, Maharashtra 6,
Karnataka, Telangana, Chhattisgarh 1 each. Mix complete / partial / sparse.
North and East come later as listing-only cities. Data is collected with
`docs/gemini-data-prompts.md`; the city list is `data/reference/pilot-cities.csv`.

| Phase | What | State |
|---|---|---|
| 1 | Jamaat long-list → pick 15 cities | ✅ list proposed (below); sizes come from Phase 2 |
| 2 | Jamaat rows (name, stations, office number) + size estimate | ✅ in `data/pilot/` · was ◐ CSV checked 3 Oct (15 rows import cleanly; no office numbers found; Una station to verify); sizes marked `?` are Gemini estimates for Zaki to confirm |
| 3 | Masjids / imambargahs / musafir khanas (Google Maps) | ✅ verified by Zaki; `data/pilot/` · was ◐ CSV checked 3 Oct: 11 places in 7 cities (Gemini + Shia Portal + ksijbhavnagar.org); 8 cities have none yet. Map links are searches, not place pins; several addresses to verify |
| 4 | Halal restaurants + hotels (Google Maps + supplied lists) | ✅ 32 restaurants, 26 hotels; every city has a hotel. 4b screened for halal (15 removed). `data/pilot/` |
| 5 | Import, approve, Publish to site | ☐ ready: `npm run db:import-pilot` after go-live steps (tested on a fresh local DB: 15 cities, 70 places) |

### Pilot cities

Proposed 3 Oct 2026; swap any city before Phase 2. Size and target
(complete / partial / sparse) are filled in after Phase 2.

| # | State | City | Jamaat | Size | Target | Jamaat row | Masjid | Stay | Food | Contacts | Live |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Gujarat | Bhavnagar | KSIJ of Bhavnagar | medium? |  | ✓ CSV | ✓ |  |  |  |  |
| 2 | Gujarat | Ahmedabad | Kalupur Jamaat & Sarkhej Jamaat | medium? |  | ✓ CSV | ✓ |  |  |  |  |
| 3 | Gujarat | Vadodara | Baroda Jamaat | medium? | | ✓ CSV | | | | | |
| 4 | Gujarat | Jamnagar | Jamnagar Jamaat | small? | | ✓ CSV | | | | | |
| 5 | Gujarat | Una | Una Jamaat | small? | | ✓ CSV | | | | | |
| 6 | Gujarat | Pithalpur | Pithalpur Jamaat | small? | | ✓ CSV | | | | | |
| 7 | Maharashtra | Mumbai | KSIJ of Mumbai | large |  | ✓ CSV | ✓ | ✓? |  |  |  |
| 8 | Maharashtra | Pune | Khoja Shia Isna Ashari Jamaat of Pune | medium? |  | ✓ CSV | ✓ |  |  |  |  |
| 9 | Maharashtra | Nagpur | Nagpur Jamaat | medium? | | ✓ CSV | | | | | |
| 10 | Maharashtra | Sangli | Masjid-e-Ali Ibne Abu Talib - Sangli Jamaat | small? |  | ✓ CSV | ✓ |  |  |  |  |
| 11 | Maharashtra | Chandrapur | KSIJ Chandrapur | small? | | ✓ CSV | | | | | |
| 12 | Maharashtra | Hinganghat | Khoja Shia Isna Ashri Jamaat Hinganghat | small? | | ✓ CSV | | | | | |
| 13 | Karnataka | Bengaluru | KSIJ Bangalore | medium? |  | ✓ CSV | ✓ |  |  |  |  |
| 14 | Telangana | Hyderabad | Khoja Shia Isna Ashri Jamaat Hyderabad | small? |  | ✓ CSV | ✓ |  |  |  |  |
| 15 | Chhattisgarh | Raipur | KSIJ Raipur | small? | | ✓ CSV | | | | | |

## Feature status

| Feature | State |
|---|---|
| Search (aliases), home index, city pages, all states | ✅ |
| One-at-a-time number reveal, rate limited | ✅ |
| No phone numbers in public data (code + test) | ✅ |
| `/contribute` → pending → `/moderate` approve/reject, Excel round-trip | ✅ |
| Jamaat office number + official representative | ✅ in PR |
| Bulk import of supplied lists (incl. `jamaat` rows) | ✅ in PR |
| Pages built from live DB + Publish to site | ✅ in PR |
| "Not listed yet" box on incomplete cities | ✅ in PR |
| Report / removal API, 48h caution | ✅ (links still point at old Google Form) |
| About page + feedback form | ✅ |
| Turnstile bot protection | ☐ |
| Admin dashboard (edit, reports, re-verify, live, feedback, log) | ☐ |
| Several contacts per submission; WhatsApp "Not sure" fix | ☐ |
| R2 backups, custom domain, analytics | ☐ (code ready for backups) |

## Session log

| Date | What happened |
|---|---|
| Jul 2026 | Stages 1–8 built and deployed; in-site intake + moderation added |
| 3 Oct 2026 | Phase 4b: food + hotels for the 8 missing cities; halal screening removed 14 places + 1 in the wrong town. |
| 3 Oct 2026 | Phases 2–4 collected, repaired (unquoted CSV) and verified; pilot data committed in `data/pilot/` with `npm run db:import-pilot`. |
| 3 Oct 2026 | Phase 1: Gemini's list checked against KhojaPedia's India Federation list. Real jamaats exist only in Gujarat (51), Maharashtra (11), Karnataka, Telangana, Chhattisgarh (1 each); Gemini's North/East rows were unsupported. Region plan needs revisiting. |
| 3 Oct 2026 | Status review; TODO created; office number + representative; bulk importer; 15-city pilot plan incl. incomplete cities; pages from live DB + Publish to site; db:clear; Gemini data prompts; PROGRESS / DECISIONS / DEPENDENCIES docs |
