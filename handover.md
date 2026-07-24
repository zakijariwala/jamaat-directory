# Handover — Jamaat Directory

Everything you need to pick this project up on your laptop and keep building.

Last updated: 24 July 2026.

---

## 1. Current state — read this first

- **The prototype is DEPLOYED** on Cloudflare Pages → **https://jamaat-directory.pages.dev**
  (seed data, unlisted / `noindex`).
- **Repo:** its own home now → **https://github.com/zakijariwala/jamaat-directory** (`main`).
- **All application code (build steps 1–8) is written, tested, and deployed.** 43 tests
  pass. What remains is *content* and a few connect-the-dots tasks — see §9.

**Provisioned on Cloudflare so far:**

| Resource | Status |
|---|---|
| **D1** database `jamaat_directory` | ✅ created; schema + seed loaded (remote) |
| **KV** namespace `RATE_LIMIT` | ✅ created (reveal rate limiting) |
| **Pages** project `jamaat-directory` | ✅ deployed via `wrangler pages deploy` |
| **INGEST_SECRET** | ✅ set during deploy — *save the value; the Apps Script needs it* |
| **R2** bucket (backups) | ⏳ deferred until backups are needed |
| **Turnstile / Web Analytics / custom domain** | ⏳ not set up yet |

The real D1 + KV ids are committed in `wrangler.toml` (they're resource
identifiers, not secrets), so the repo is deploy-ready out of the box.

---

## 2. What this is (30-second version)

A public, pan-India web directory of jamaat contacts and facilities for a Khoja
Shia network. One shareable link, no login, no app. Cloudflare Pages (Astro
static frontend) + Pages Functions + D1 + KV (+ R2 for backups later), with a
Google Form/Sheet as the non-technical intake and moderation surface.

The authoritative product spec is the **PRD** (Packet 1) and the **build packet**
(Packet 2). `README.md` covers day-to-day dev; `docs/DEPLOYMENT.md` is the full
Cloudflare runbook; `docs/how-it-works.html` explains the architecture with
diagrams. This file is the map for picking the work back up.

---

## 3. Where the code lives

- **Repo:** `github.com/zakijariwala/jamaat-directory`, branch **`main`**.
- History note: it began as an orphan branch on the `ai-website-cloner-template`
  repo, then moved to this dedicated repo. `main` is clean and project-only.

---

## 4. Get it on your laptop

Fresh clone:

```bash
git clone https://github.com/zakijariwala/jamaat-directory.git
cd jamaat-directory
npm install
```

**If you already have a laptop copy pointed at the old template repo**, re-point
it to the new one (the deploy fixes are already in `main`, so local edits can be
dropped):

```bash
git remote set-url origin https://github.com/zakijariwala/jamaat-directory.git
git fetch origin
git reset --hard origin/main        # ⚠️ discards uncommitted edits (already in main)
git branch -m main                  # optional: rename local branch to main
```

Your `node_modules`, local D1 (`.wrangler`), and `dist` are gitignored, so
they're untouched — no reinstall needed.

---

## 5. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **22.18+** (dev'd on 22.22) | Some scripts run TypeScript directly via Node's native type-stripping. On Node < 22.18 run them via `npx tsx` instead. |
| **npm** | 10+ | Ships with Node. |
| **Git Bash** (Windows) | — | `scripts/provision.sh` is a bash script — run it in **Git Bash**, not PowerShell. In PowerShell, run chained commands one line at a time (no `&&` on PS 5.1). |
| **Cloudflare account** | — | Already connected. Wrangler is a dev dependency (`npx wrangler …`); no global install needed. |
| **Google account** | — | For the Form + Sheet + Apps Script intake. |

---

## 6. First run on a new machine (local)

```bash
npm install

# Local database (local SQLite via Wrangler/Miniflare — no cloud)
npm run db:migrate:local
npm run db:seed:local

# Verify
npm test                     # Vitest — 43 tests incl. the no-phone-numbers guard
npm run typecheck            # tsc --noEmit
npm run build                # astro build → ./dist

# Run
npm run dev                  # Astro dev server (UI only, fast). Show-number won't work here.
npm run preview              # build + wrangler pages dev — Functions + local D1 (reveal works)
```

> ⚠️ For local `preview`, do **not** set `TURNSTILE_SECRET` (e.g. don't copy
> `.dev.vars.example` verbatim) or `/api/reveal` will `403`. Leave it unset —
> reveal + rate-limiting work without it.

---

## 7. Command reference

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server (UI only). |
| `npm run preview` | Build + `wrangler pages dev ./dist` — Functions + local D1. |
| `npm run build` | Static build to `./dist`. |
| `npm run deploy` | Build + `wrangler pages deploy ./dist` (redeploy the live site). |
| `npm test` / `npm run typecheck` | Vitest / `tsc --noEmit`. |
| `npm run db:migrate` / `db:seed` | Apply migrations / load seed into **remote** D1. |
| `npm run db:migrate:local` / `db:seed:local` | Same, against the **local** D1. |
| `bash scripts/provision.sh` | One-command Cloudflare setup (Git Bash). Idempotent. |

To redeploy after any code change: **`npm run deploy`**.

---

## 8. How it was deployed (and how to redeploy)

The whole Cloudflare core was set up with **`bash scripts/provision.sh`** (Git
Bash): it created D1 + KV, wrote their ids into the config, migrated + seeded the
remote D1, deployed Pages, and set `INGEST_SECRET`. Full manual equivalent +
costs are in **`docs/DEPLOYMENT.md`**.

- **Redeploy the site:** `npm run deploy`.
- **Access posture:** `NOINDEX="true"` (default) ships `noindex` + a disallow
  `robots.txt`. Set `NOINDEX=false` (build var) and redeploy to go fully public.

---

## 9. What's left — your next steps

1. **Set the Google Form link.** `src/lib/config.ts` → `FORM_URL` drives every
   Add / Report / Remove button. Optionally set `FORM_CITY_ENTRY` (the form's
   city-field id, from Forms' "Get pre-filled link") to pre-fill the city. Then
   `npm run deploy`.
2. **Build the Google Form + Sheet + Apps Script** (turns on live contributions):
   - One Form whose first question is *"What would you like to do?"*
     (Add / Report / Remove) with section branching; responses → a Sheet.
   - Sheet → Extensions → Apps Script → paste `docs/apps-script.gs`. Script
     Properties: `INGEST_URL = https://jamaat-directory.pages.dev/api/ingest`,
     `INGEST_SECRET =` the value from deploy. Add the `onFormSubmit` + `onEdit`
     triggers, and match the `COLS` map to your sheet headers.
   - The sample script maps **city + one contact**; extend its column map to also
     populate `facilities[]` for masjid / musafir / hotel / restaurant.
3. **Client-side Turnstile widget.** `/api/reveal` enforces Turnstile only when
   `TURNSTILE_SECRET` is set. The client widget isn't wired yet, so **do not set
   that secret** until it is, or reveals `403`. Rate limiting (KV) is already live.
4. **R2 + nightly backups** (when wanted): enable R2 in the dashboard →
   `npx wrangler r2 bucket create jamaat-directory-backups` →
   `cd workers/backup && npx wrangler deploy`.
5. **Custom domain + Web Analytics** — optional polish (`docs/DEPLOYMENT.md`
   phases 7 & 9).
6. **Real data.** Replace the sample cities in `src/data/seed.ts`, or (better)
   let the Google Form populate D1 and stop relying on seed.

---

## 10. Deploy fixes already applied (so you don't rediscover them)

Found during the first real Cloudflare deploy, fixed in the repo:

- **`wrangler kv namespace list --json`** — the `--json` flag isn't accepted on
  Wrangler 4.x (the command already outputs JSON). Removed from `provision.sh`.
- **Remote D1 rejects `BEGIN TRANSACTION` / `COMMIT`** — the seed generator no
  longer wraps the inserts in an explicit transaction (D1 handles atomicity).
- **R2 binding removed from the Pages config** — the site's Functions don't use
  R2 (only the backup Worker does), and binding a not-yet-created bucket failed
  the Pages deploy. R2 now lives only in `workers/backup/wrangler.toml`.

---

## 11. Page-building model (important architecture note)

The **data** (`/directory.json`) is always live from D1; the **HTML pages** (home
index + `/city/[id]`) are generated **at build time from `src/data/seed.ts`**. So
a city added via the Form lands in D1 and appears in `/directory.json`
immediately, but its rendered page waits for a rebuild. Before launch, decide
between (A) trigger a Pages rebuild on ingest, or (B) client-render the list/city
pages from `directory.json`. Full explanation with diagrams:
`docs/how-it-works.html`.

---

## 12. Open decisions (carry these forward)

1. **Access posture** — public / unlisted+`noindex` / passcoded. Shipping
   unlisted (`NOINDEX="true"`) by default.
2. **Hotels + restaurants in v1?** Both are the weakest, hardest-to-keep-current
   sections. Decide if both stay.
3. **Named moderators** (min. two).
4. **Domain name.**
5. **Any jamaat body whose endorsement should precede launch**, and whether that
   changes what may be published.
6. **Frontend page-building strategy** (§11) — rebuild-on-write vs client-render.

---

## 13. Deviations from the packet (flagged, not silent)

- **Design:** the delivered design (a navy/red "functional field-manual"
  brutalist system, **Public Sans + JetBrains Mono**) superseded the PRD §8.5
  written direction (IBM Plex / Jade). Icons are inline SVG (not an icon font)
  so they survive WhatsApp/Instagram in-app browsers. The three sub-14px type
  sizes were lifted to the a11y floor (17px base, 14px min) per your decision.
- **Indore (Madhya Pradesh)** added to the seed so all five regions are covered.
- **Restaurants** added as a facility `kind` (your request) — no migration needed
  (`facilities.kind` is free-form `TEXT`).
- **"Cloudflare Worker" = Pages Functions.** `/api/*` and `/directory.json` are
  Pages Functions (Workers on the same origin). Same runtime; simpler deploy.

---

## 14. Gotchas & conventions

- **Secrets** never get committed. Local dev → `.dev.vars` (gitignored). Prod →
  `wrangler pages secret put`. Resource **ids** (D1/KV) are not secrets and *are*
  committed in `wrangler.toml`.
- **`seed.sql`** and **`public/directory.json`** are generated + gitignored. The
  source of truth is `src/data/seed.ts` (`npm run gen:seed-sql`, `gen:snapshot`).
- **No-phone-numbers guarantee is enforced in code** — `buildSnapshot()` builds
  public objects from an explicit allowlist, and a test fails the build if any
  phone-like pattern reaches the snapshot. Keep it that way.
- **Windows:** use **Git Bash** for `scripts/*.sh`; in PowerShell run commands one
  line at a time (no `&&` on PS 5.1), and env vars are `$env:NAME="value"`.
- Gitignored (regenerated locally): `node_modules/`, `dist/`, `.astro/`,
  `.wrangler/`, `seed.sql`, `public/directory.json`, `.dev.vars`.

---

## 15. Resuming the build

Fastest path to a fully live directory:

1. Set `FORM_URL` (§9.1) and `npm run deploy` — the Add/Report/Remove buttons go live.
2. Build the Google Form + wire `docs/apps-script.gs` (§9.2) — real contributions flow into D1.
3. Decide the page-building strategy (§11) so new cities appear without a manual redeploy.
4. Add Turnstile widget, R2 backups, custom domain as you go (§9.3–9.5).

The prototype is already up for the committee to react to — everything from here
is turning that into the live, self-maintaining directory.
