# Handover — Jamaat Directory

Everything you need to pick this project up on your laptop and keep building.

Last updated: 3 October 2026.

---

## 1. Current state — read this first

- **The prototype is DEPLOYED** on Cloudflare Pages → **https://jamaat-directory.pages.dev**
  (unlisted / `noindex`). The live D1 still holds the fictional sample data
  plus one test city (Mahuva); it is cleared at go-live (`npm run db:clear`).
- **Repo:** **https://github.com/zakijariwala/jamaat-directory** (`main`).
- **Intake is in-site:** `/contribute` → pending → `/moderate` approve →
  **Publish to site**. The Google Form / Apps Script path is legacy.
- **Real data** comes from supplied lists via `npm run import:listings`
  (prompts for collecting it: `docs/gemini-data-prompts.md`), never hand-typed
  seed. 15-city pilot, deliberately mixing complete and incomplete cities.
- **For future sessions, read first:** `docs/PROGRESS.md` (where things are),
  `docs/DECISIONS.md` (what was decided and why), `docs/DEPENDENCIES.md`
  (what blocks what, who owns it), `TODO.md` (the checklist).

**Provisioned on Cloudflare so far:**

| Resource | Status |
|---|---|
| **D1** database `jamaat_directory` | ✅ created; schema + seed loaded (remote) |
| **KV** namespace `RATE_LIMIT` | ✅ created (reveal rate limiting) |
| **Pages** project `jamaat-directory` | ✅ deployed via `wrangler pages deploy` |
| **INGEST_SECRET** | ✅ set during deploy (legacy Apps Script only) |
| **ADMIN_PASSCODE** | ✅ set (`/moderate` login works) |
| **DEPLOY_HOOK_URL** | ⏳ not set — needed for **Publish to site** |
| **Migration 0005** (office / representative / source) | ⏳ not applied to remote yet |
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
npm test                     # Vitest — incl. the no-phone-numbers guard
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
| `npm run db:migrate` | Apply migrations to the **remote** D1. |
| `npm run import:listings -- <file>` | Supplied CSV/Excel list → `import.sql` (pending rows). See `data/README.md`. |
| `npm run db:clear` | Empty the **remote** D1 (asks for confirmation). |
| `npm run db:purge-samples` | Remove only the sample rows from the remote D1. |
| `npm run db:seed` | Load the sample data into the remote D1 — **wipes it first**; asks for confirmation. |
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

The full, current list is **`TODO.md`**; status and the pilot table are in
**`docs/PROGRESS.md`**. In short:

1. **Go live with this round** (order matters): `npm run db:migrate` →
   `npm run db:clear` → merge the PR → create the Pages deploy hook and
   `npx wrangler pages secret put DEPLOY_HOOK_URL` → `npm run deploy`.
2. **Collect the pilot data** with `docs/gemini-data-prompts.md`, phase by
   phase → `npm run import:listings` → approve in `/moderate` → **Publish to site**.
3. **Before launch:** Turnstile, remove the seed fallbacks, move Report/Remove
   in-site, admin dashboard (`TODO.md` §4), committee decisions.
4. **Optional:** R2 backups, custom domain, Web Analytics (`docs/DEPLOYMENT.md`).

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

Production builds render the home index and `/city/[id]` pages from the
**live** `/directory.json` (D1) — see `src/lib/directory-source.ts`. Approving
an entry updates D1 immediately; the pages update after **Publish to site** in
`/moderate` (Pages deploy hook, `DEPLOY_HOOK_URL` secret) or `npm run deploy`.
`npm run dev` still uses `src/data/seed.ts`.

---

## 12. Open decisions (carry these forward)

1. **Access posture** — public / unlisted+`noindex` / passcoded. Shipping
   unlisted (`NOINDEX="true"`) by default.
2. **Hotels + restaurants in v1?** Being collected for the pilot (halal lists +
   Google Maps); the committee can still drop them.
3. **Named moderators** (min. two).
4. **Domain name.**
5. **Any jamaat body whose endorsement should precede launch**, and whether that
   changes what may be published.
6. ~~Frontend page-building strategy~~ — decided: build from live D1 + publish button (§11).
7. **Shared moderator passcode vs. per-moderator logins.**

Decided items, with reasons, are logged in `docs/DECISIONS.md`.

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
- **`seed.sql`**, **`import.sql`**, **`purge-samples.sql`** and
  **`public/directory.json`** are generated + gitignored. `src/data/seed.ts` is
  test/demo data only; production pages are built from the live D1.
- **`data/imports/`** (supplied lists with phone numbers) is gitignored — keep
  those files local.
- **No-phone-numbers guarantee is enforced in code** — `buildSnapshot()` builds
  public objects from an explicit allowlist, and a test fails the build if any
  phone-like pattern reaches the snapshot. Keep it that way.
- **Windows:** use **Git Bash** for `scripts/*.sh`; in PowerShell run commands one
  line at a time (no `&&` on PS 5.1), and env vars are `$env:NAME="value"`.
- Gitignored (regenerated locally): `node_modules/`, `dist/`, `.astro/`,
  `.wrangler/`, `seed.sql`, `public/directory.json`, `.dev.vars`.

---

## 15. Resuming the build

1. Read `docs/PROGRESS.md`, then `TODO.md`.
2. `npm install && npm test && npm run typecheck && npm run build`
   (`npm run build` needs internet: it reads the live directory. Offline:
   `DIRECTORY_SOURCE=seed npm run build`.)
3. Pick up the next unchecked 🔴 item in `TODO.md`, and log any new decision
   in `docs/DECISIONS.md`.
