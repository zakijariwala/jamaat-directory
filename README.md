# Jamaat Directory

A public web directory of community contacts and facilities in jamaats across
India, for a Khoja Shia jamaat network. Pan-India from day one — no city is the
default. One shareable link, no login, no app: a traveller opens it, searches a
city, and gets a local contact, the masjid, and somewhere to stay.

Built entirely on Cloudflare (Pages + Workers + D1 + R2 + Turnstile), with a
Google Form / Sheet as the non-technical intake and moderation surface.

> **Status:** working prototype (build order steps 1–3). Backend snapshot +
> phone-safe `directory.json`, and the full frontend (home, search, city pages,
> all states) built from the design deliverable, with a one-number-at-a-time
> reveal endpoint. Later steps harden the reveal API and wire the ingest
> pipeline, flags, backups, and deploy. See **Build status** below.
>
> **Architecture explainer:** open `docs/how-it-works.html` in a browser for
> rendered diagrams of the data flow, the page-building model, adding full vs.
> partial cities, and de-duplication.

---

## Architecture

```
Google Form → Google Sheet → Apps Script (onFormSubmit, onEdit)
   → POST /api/ingest (HMAC-signed) → Pages Function → D1
   → regenerates directory.json (no phone numbers) → cached at edge
   → Cloudflare Pages (Astro static) fetches that one file, searches client-side
   → GET /api/reveal?id=… returns a single phone number, rate limited
```

- **D1** is the source of truth. **R2** is used only for nightly JSON backups.
- The Google Sheet stays as the moderation UI so a non-technical moderator can
  fix a typo without a developer.
- **One JSON snapshot, client-side search** — shipped once, searched in memory,
  survives a bad connection. Phone numbers are excluded from it entirely and
  served one-at-a-time from `/api/reveal`.

`/api/*` and `/directory.json` are **Cloudflare Pages Functions** (in
`functions/`) — Workers on the same origin as the static site, bound to D1/R2.

## Tech stack

Astro (static output) · Cloudflare Pages / Functions · D1 (SQLite) · R2 ·
Turnstile · Cloudflare Web Analytics · Google Apps Script · Wrangler · Vitest.

## Project structure

```
migrations/            D1 schema migrations (0001_init.sql)
functions/             Cloudflare Pages Functions (API + /directory.json)
  directory.json.ts    GET /directory.json — public snapshot from D1
src/
  lib/
    types.ts           Row shapes (may hold phones) + Public* shapes (never do)
    snapshot.ts        buildSnapshot(): the only D1→snapshot bridge, phone-safe
    search.ts          normalize + alias-aware client search (pure)
  data/seed.ts         Seed dataset — single source of truth for DB + tests
  pages/index.astro    Home screen (placeholder until Stage 3)
scripts/
  gen-seed-sql.ts      Generates seed.sql from src/data/seed.ts
test/                  Vitest: no-phone-in-snapshot, consent, alias search, …
wrangler.toml          Pages project config + D1/R2 bindings
```

## Local development

```bash
npm install

# 1. Create the local D1 schema and load seed data
npm run db:migrate:local     # apply migrations to the local D1
npm run db:seed:local        # regenerate seed.sql and load it

# 2. Run the tests
npm test                     # Vitest — includes the no-phone-numbers guard
npm run typecheck            # tsc --noEmit

# 3. Frontend dev / full preview
npm run dev                  # Astro dev server (frontend only)
npm run preview              # astro build + wrangler pages dev (Functions + D1)
```

`npm run preview` is the one that exercises the Pages Functions (`/directory.json`,
and later `/api/*`) against the local D1, matching production behaviour.

## Database & migrations

The schema lives in `migrations/`. Apply it locally with `npm run db:migrate:local`
and to the remote D1 with `npm run db:migrate` (after creating the database — see
below). Seed data is defined once in `src/data/seed.ts`; `npm run gen:seed-sql`
turns it into an idempotent `seed.sql`.

First-time remote setup:

```bash
wrangler d1 create jamaat_directory        # paste the returned id into wrangler.toml
wrangler r2 bucket create jamaat-directory-backups
npm run db:migrate                          # apply schema to remote D1
npm run db:seed                             # load seed data
```

## Secrets

Never committed. Local values go in `.dev.vars` (gitignored — copy from
`.dev.vars.example`). Production values are set with Wrangler:

```bash
wrangler pages secret put INGEST_SECRET     # shared HMAC secret with Apps Script
wrangler pages secret put TURNSTILE_SECRET  # Cloudflare Turnstile server key
```

## Configuration

`wrangler.toml` `[vars]`:

- `NOINDEX` — `"true"` (default) ships the site with `noindex` so it is not
  found on Google. Flip to `"false"` only if the committee chooses the fully
  public posture. This is the single flag for the open access-posture decision.

## Privacy guarantees (enforced in code)

1. **No phone number ever appears in `directory.json`.** `buildSnapshot()` builds
   public objects from an explicit field allowlist, and a test fails the build if
   any phone-like pattern reaches the snapshot.
2. Only `status = 'live'` rows are published.
3. A contact that was not self-added and has not consented is never published,
   regardless of status.

## Deploy

Provision once (needs your Cloudflare account), then deploy:

```bash
npx wrangler login
npx wrangler d1 create jamaat_directory          # paste id into wrangler.toml + workers/backup/wrangler.toml
npx wrangler r2 bucket create jamaat-directory-backups
npx wrangler kv namespace create RATE_LIMIT      # paste id into wrangler.toml
npm run db:migrate && npm run db:seed            # schema + seed into remote D1

npx wrangler pages secret put INGEST_SECRET      # shared with docs/apps-script.gs
npx wrangler pages secret put TURNSTILE_SECRET   # from the Turnstile dashboard

npm run deploy                                    # astro build + wrangler pages deploy ./dist
cd workers/backup && npx wrangler deploy && cd ../..   # nightly backup Worker
```

Then in the dashboard: create a **Turnstile** site (put the site key in the
client widget), enable **Web Analytics** (set `CF_ANALYTICS_TOKEN` as a build
var), add the **custom domain**, and — once D1 is live — remove the seed
fallbacks in `functions/directory.json.ts` and `functions/api/reveal.ts`.
Full step-by-step is in `handover.md`.

## Build status

- [x] **1 — Scaffold, Wrangler config, D1 schema/migrations, seed script**
- [x] **2 — Snapshot generator + `/directory.json` + no-phone-numbers test**
- [x] **3 — Frontend: home, search, city pages, all states** *(from the design)*
- [x] **4 — `/api/reveal`** with per-IP rate limiting + Turnstile *(client Turnstile widget added at deploy)*
- [x] **5 — `/api/ingest`** (HMAC) + Apps Script trigger (`docs/apps-script.gs`)
- [x] **6 — `/api/flag`** + self-service removal + 48h caution
- [x] **7 — Nightly R2 backup** (`workers/backup`, scheduled)
- [~] **8 — Deploy** — code done (analytics beacon, `noindex`/`robots.txt`); **provisioning + custom domain is on the Cloudflare account** (see below)

All **code** for steps 1–8 is in place; what remains is provisioning the
Cloudflare/Google resources and deploying (see **Deploy** and `handover.md`).

## Environment variables

- **Build-time** (`import.meta.env`, set in Pages build settings or a local `.env`):
  - `NOINDEX` — `"true"` (default) ships `noindex` + a disallow `robots.txt`.
  - `CF_ANALYTICS_TOKEN` — Cloudflare Web Analytics token; unset = no beacon.
- **Runtime secrets** (`wrangler pages secret put …`, or `.dev.vars` locally):
  - `INGEST_SECRET`, `TURNSTILE_SECRET`.

## Performance / accessibility targets (acceptance criteria)

3G-usable < 2s; Lighthouse Perf 90+, A11y 100; JS < 50KB gzipped; 17px base;
48px tap targets; 4.5:1 contrast; keyboard + reduced-motion. Icons are inline
SVG (no icon font); run Lighthouse against the deployed preview to confirm.
