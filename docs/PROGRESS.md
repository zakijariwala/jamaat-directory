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
| Next | Go-live steps (below), then pilot data phases 1–5 |

## Go-live steps for the open PR (in order)

| # | Step | Who | Done |
|---|---|---|---|
| 1 | `npm run db:migrate` (migration 0005) **before** merging | Zaki | ☐ |
| 2 | `npm run db:clear` (empty live DB; approved, no real data in it) | Zaki | ☐ |
| 3 | Merge the PR into `main` | Zaki | ☐ |
| 4 | Pages deploy hook → `npx wrangler pages secret put DEPLOY_HOOK_URL` | Zaki | ☐ |
| 5 | `npm run deploy` (site rebuilds from the empty live DB) | Zaki | ☐ |

## Pilot data (15 cities)

Plan: 5 states (one per region) × 3 jamaat sizes; roughly 5 complete, 5
partial, 5 sparse. Data is collected with `docs/gemini-data-prompts.md`.

| Phase | What | State |
|---|---|---|
| 1 | Jamaat long-list → pick 15 cities | ☐ not started |
| 2 | Jamaat rows (name, stations, office number) | ☐ |
| 3 | Masjids / imambargahs / musafir khanas (Google Maps) | ☐ |
| 4 | Halal restaurants + hotels (Google Maps + supplied lists) | ☐ |
| 5 | Check pass, import, approve, Publish to site | ☐ |

### Pilot cities

Fill in after Phase 1. Target = complete / partial / sparse.

| # | Region | State | City | Jamaat size | Target | Jamaat row | Masjid | Stay | Food | Contacts | Live |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | North | | | large | | | | | | | |
| 2 | North | | | medium | | | | | | | |
| 3 | North | | | small | | | | | | | |
| 4 | South | | | large | | | | | | | |
| 5 | South | | | medium | | | | | | | |
| 6 | South | | | small | | | | | | | |
| 7 | East | | | large | | | | | | | |
| 8 | East | | | medium | | | | | | | |
| 9 | East | | | small | | | | | | | |
| 10 | West | | | large | | | | | | | |
| 11 | West | | | medium | | | | | | | |
| 12 | West | | | small | | | | | | | |
| 13 | Central | | | large | | | | | | | |
| 14 | Central | | | medium | | | | | | | |
| 15 | Central | | | small | | | | | | | |

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
| 3 Oct 2026 | Status review; TODO created; office number + representative; bulk importer; 15-city pilot plan incl. incomplete cities; pages from live DB + Publish to site; db:clear; Gemini data prompts; PROGRESS / DECISIONS / DEPENDENCIES docs |
