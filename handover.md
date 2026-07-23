# Handover — Jamaat Directory

Everything you need to pick this project up on your laptop and keep building.
Read this once end to end before you start.

Last updated: 23 July 2026.

---

## 1. What this is (30-second version)

A public, pan-India web directory of jamaat contacts and facilities for a Khoja
Shia network. One shareable link, no login, no app. Built on Cloudflare
(Pages + Functions + D1 + R2 + Turnstile) with a Google Form/Sheet as the
non-technical intake and moderation surface.

The authoritative product spec is the **PRD** (Packet 1) and the **build packet**
(Packet 2). The `README.md` covers day-to-day dev. This file is specifically
about **moving the project to a new machine and finishing the remaining stages.**

---

## 2. Where the code lives (read this — it's slightly unusual)

- **Repo:** `zakijariwala/ai-website-cloner-template`
- **Branch:** `jamaat-directory`

⚠️ The Jamaat Directory does **not** live on that repo's `main` branch. `main`
is an unrelated project (a website-cloner template). `jamaat-directory` is a
clean **orphan branch** (its own history, no shared files with `main`) that
contains *only* this project.

Why: creating a brand-new dedicated repo was the original plan, but the GitHub
integration in use couldn't create repos on your behalf. The orphan branch was
the clean workaround. **When you migrate, this is a good moment to move it to
its own repo** — see §8.

---

## 3. Get it onto your laptop

```bash
# Clone and switch to the project branch
git clone https://github.com/zakijariwala/ai-website-cloner-template.git jamaat-directory
cd jamaat-directory
git checkout jamaat-directory

# (Optional but recommended) confirm you're on the right branch
git branch --show-current   # -> jamaat-directory
```

If you'd rather not carry the unrelated `main` history, you can start a fresh
repo from this branch's tree — see §8.

---

## 4. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **22.18+** (dev'd on 22.22) | The `gen:seed-sql` script runs TypeScript directly via Node's native type-stripping. On Node < 22.18 it won't run as-is (see gotcha in §9). |
| **npm** | 10+ | Ships with Node. |
| **Cloudflare account** | — | Free tier is enough to start. Wrangler is already a dev dependency; no global install needed. |
| **Google account** | — | For the Form + Sheet + Apps Script intake (Stage 5). |
| Git | any recent | — |

You do **not** need to install Wrangler, Astro, or anything globally —
`npm install` pulls everything (including a local `wrangler`).

---

## 5. First run on the new machine

```bash
npm install                  # restores exact versions from package-lock.json

# Local database (uses a local SQLite via Wrangler/Miniflare — no cloud needed)
npm run db:migrate:local     # apply migrations/0001_init.sql to local D1
npm run db:seed:local        # regenerate seed.sql from src/data/seed.ts + load it

# Verify everything works
npm test                     # Vitest — 28 tests incl. the no-phone-numbers guard
npm run typecheck            # tsc --noEmit
npm run build                # astro build (static output to ./dist)

# Run it
npm run dev                  # Astro dev server (frontend only, fast)
npm run preview              # astro build + wrangler pages dev — exercises the
                             # Pages Functions (/directory.json, later /api/*)
                             # against the local D1. Closest to production.
```

If all four verification commands pass, your environment is good.

---

## 6. Full command reference

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server (UI only). |
| `npm run preview` | Build + `wrangler pages dev ./dist` — Functions + local D1. |
| `npm run build` | Static build to `./dist`. |
| `npm run deploy` | Build + `wrangler pages deploy ./dist`. |
| `npm test` / `npm run test:watch` | Vitest. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run gen:seed-sql` | Regenerate `seed.sql` from `src/data/seed.ts`. |
| `npm run db:migrate:local` / `db:migrate` | Apply migrations to local / remote D1. |
| `npm run db:seed:local` / `db:seed` | Load seed data into local / remote D1. |

---

## 7. Current build status

Build order is from Packet 2. **Stages 1–2 are done, verified, and pushed.**

- [x] **1 — Scaffold, Wrangler config, D1 schema/migrations, seed script**
- [x] **2 — Snapshot generator + `/directory.json` + no-phone-numbers test**
- [x] **+ restaurants** added as a facility kind alongside hotels (your request)
- [x] **3 — Frontend: home, search, city pages, all states** — built from the design (Astro + Tailwind v4, inline SVG icons)
- [~] **4 — `/api/reveal`** — basic one-number endpoint done; rate limiting + Turnstile still to add
- [ ] 5 — `/api/ingest` + Apps Script trigger (shared HMAC secret)
- [ ] 6 — `/api/flag` + removal flow
- [ ] 7 — Nightly R2 backup (scheduled Worker)
- [ ] 8 — Analytics, `noindex` flag wiring, custom domain, deploy

**What's proven so far:** tests pass, typecheck clean, `astro build` succeeds,
and the migration + seed apply to a real local D1 with correct row counts
(11 cities · 12 published contacts · 21 published facilities) and correct
publish-rule behaviour. The generated snapshot contains **zero** phone data.

---

## 8. Moving to a dedicated repo (recommended during migration)

The cleanest home for this is its own repo. On your laptop:

```bash
# From inside the checked-out jamaat-directory branch:
# 1. Create a new empty repo on GitHub (e.g. github.com/zakijariwala/jamaat-directory)
# 2. Point a new remote at it and push this branch as main
git remote rename origin old-template          # keep the old one around, renamed
git remote add origin https://github.com/zakijariwala/jamaat-directory.git
git push -u origin jamaat-directory:main        # push this tree as the new main
```

Because `jamaat-directory` is an orphan branch, its tree is already free of the
template's files, so it becomes a clean `main` with no leftover history to prune.

---

## 9. Cloud & Google provisioning (needs your accounts — not yet done)

None of this exists yet; it requires accounts only you control. Do it as you
reach the relevant stage.

### Cloudflare (Stages 4–8)

```bash
# One-time login
npx wrangler login

# D1 database — paste the returned database_id into wrangler.toml
npx wrangler d1 create jamaat_directory

# R2 bucket for nightly backups (Stage 7)
npx wrangler r2 bucket create jamaat-directory-backups

# Apply schema + seed to the REMOTE D1
npm run db:migrate
npm run db:seed

# Secrets (Stages 4–5) — never committed
npx wrangler pages secret put INGEST_SECRET     # shared HMAC secret w/ Apps Script
npx wrangler pages secret put TURNSTILE_SECRET  # Cloudflare Turnstile server key
```

Also in the Cloudflare dashboard, when you get there:
- **Turnstile:** create a site, note the **site key** (frontend) and **secret key** (server). Stage 4.
- **Web Analytics:** enable for the Pages project (no cookies). Stage 8.
- **Pages:** connect the repo or deploy via `npm run deploy`. Stage 8.
- **Custom domain + HTTPS.** Stage 8, open decision (§11).

### Google (Stage 5)

- Build the **Google Form** (fields per PRD §6.1; consent checkbox required, not pre-ticked).
- The Form's responses go to a **Google Sheet**.
- In the Sheet: **Extensions → Apps Script**, paste the trigger snippet (produced
  in Stage 5), set the shared `INGEST_SECRET` constant to match Cloudflare, and
  install the `onFormSubmit` + `onEdit` triggers. It POSTs HMAC-signed rows to
  `/api/ingest`.

---

## 10. The design blocker (why Stage 3 is paused)

Packet 2 says, repeatedly, to build the frontend **from the design output — the
token sheet and component HTML/CSS — exactly**, without improvising styling.

That design output isn't in the repo yet:
- The **Stitch link is private** to your Google login and can't be fetched by tooling.
- The **Claude Design deliverable** (token sheet + component HTML/CSS) hasn't been provided.

**To unblock Stage 3, bring one of these to the machine you're building on:**
1. The Claude Design output (token sheet + component HTML/CSS), or
2. Screenshots of every Stitch screen (home, city page, empty state, reveal), or
3. A **Figma export** of the Stitch project (a `figma.com` link).

The PRD §8.5 written direction (Ink/Slate/Paper/Mist/Jade/Amber palette, IBM
Plex Serif + Sans, hairline rules, 4px max radius) is enough to build faithfully
*if you decide* to skip the mockups — but the packet's explicit instruction is to
implement the actual components.

---

## 11. Open decisions (carry these forward)

From PRD §15 / the packet. None block the code that's written; several block launch.

1. **Access posture** — public / unlisted+`noindex` / passcoded. Shipping with
   `NOINDEX="true"` (unlisted) by default; it's a single flag in `wrangler.toml`.
2. **Hotels in v1?** They're the weakest, hardest-to-keep-current section.
3. **Restaurants** — added on your request (alongside hotels). Same longevity
   caveat as hotels; decide if both stay for v1.
4. **Named moderators** (min. two).
5. **Domain name.**
6. **Any jamaat body whose endorsement should precede launch**, and whether that
   changes what may be published.

---

## 12. Deviations from the packet (flagged, not silent)

- **Indore (Madhya Pradesh)** was added to the seed. The packet's sample city
  list had no Central-region city, but the PRD requires a spread across all five
  regions. Noted in a `src/data/seed.ts` comment.
- **Restaurants** added as a facility `kind` (your request). No structural
  migration was needed — `facilities.kind` is free-form `TEXT`.
- **"Cloudflare Worker" = Cloudflare Pages Functions.** The `/api/*` routes and
  `/directory.json` are implemented as Pages Functions (in `functions/`), which
  are Workers on the same origin as the static site. Same runtime; simpler
  same-origin deploy. Not an architecture change.

---

## 13. Gotchas & conventions

- **Secrets:** never commit. Local dev values go in `.dev.vars` (gitignored;
  copy from `.dev.vars.example`). Production via `wrangler pages secret put`.
- **`seed.sql` is generated and gitignored.** The single source of truth is the
  typed `src/data/seed.ts`. Run `npm run gen:seed-sql` after editing it.
- **`wrangler.toml` has a placeholder `database_id`** — fill it in from
  `wrangler d1 create` before any remote D1 command works.
- **Node type-stripping:** `npm run gen:seed-sql` runs `node scripts/gen-seed-sql.ts`
  directly. Needs Node ≥ 22.18. On older Node, either upgrade or run it via
  `npx tsx scripts/gen-seed-sql.ts`.
- **The no-phone-numbers guarantee is enforced in code**, not by convention:
  `buildSnapshot()` builds public objects from an explicit allowlist, and a test
  fails the build if any phone-like pattern reaches the snapshot. Keep it that way.
- Gitignored (won't transfer, regenerated locally): `node_modules/`, `dist/`,
  `.astro/`, `.wrangler/`, `seed.sql`, `.dev.vars`.

---

## 14. Resuming the build

Immediate next action once you're set up:

1. **Provide the design** (§10) → I build **Stage 3** (home, search, city page)
   from it exactly.
2. Then **Stages 4–8** in order, wiring the reveal API, ingest pipeline, flags,
   backups, and deploy — each needs some of the provisioning in §9.

The goal for the first milestone (per the packet) is **Stages 1–3 as a working
prototype with seed data**, shown to the committee before the Sheet is wired.
Stages 1–2 are done; only the design stands between you and that prototype.
