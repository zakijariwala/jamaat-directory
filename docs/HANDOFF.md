# Handoff: Jamaat Directory

For the incoming development team. State as of 7 Oct 2026.
Deeper detail: `README.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`,
`docs/DEPENDENCIES.md`, `docs/PROGRESS.md`, `TODO.md`.

## 1. Stack

- Astro 7 (static output) + TypeScript, Tailwind 4.
- Cloudflare Pages Functions (Workers runtime) serve `/api/*` and `/directory.json`.
- Node 22.18+ (`.node-version`), npm (`package-lock.json`).
- Rendering: static HTML + small client JS (search, number reveal, forms) + JSON API. Not SSR.
  Pages are built at deploy time from the live `/directory.json`.

## 2. Database

- Cloudflare D1 (SQLite). Cloudflare KV (`RATE_LIMIT`) for rate limits and a rebuild throttle (ephemeral).
- Schema: `migrations/0001`–`0005`. Tables: `cities`, `contacts`, `facilities`, `flags`, `feedback`.
- Data: 15 cities, 70 places live (from `/directory.json`), 0 contacts. Pending rows, flags and
  feedback: query with `wrangler d1 execute jamaat_directory --remote`. Size well under 1 MB.

## 3. Where it runs

- Cloudflare Pages project `jamaat-directory` → https://jamaat-directory.pages.dev. No Docker, no server process.
- Build: `npm ci && npm run build` → `./dist` (needs internet: fetches the live `/directory.json`;
  offline: `DIRECTORY_SOURCE=seed`).
- Deploy: `npm run deploy` (`wrangler pages deploy ./dist`). A branch preview URL exists; confirm in
  the dashboard whether Git-triggered builds are also enabled.
- Migrations: `npm run db:migrate`. Local: `npm run dev` (UI only) or `npm run preview` (Functions + local D1).
- Checks: `npm test`, `npm run typecheck`, `npm run build`.

## 4. Env vars

| Name | Kind | Purpose | Status |
|---|---|---|---|
| `ADMIN_PASSCODE` | Pages secret | Moderator login; HMAC key for the session cookie | set |
| `DEPLOY_HOOK_URL` | Pages secret | "Publish to site" rebuild | not set (as of 4 Oct) |
| `TURNSTILE_SECRET` | Pages secret | Bot check | not set |
| `INGEST_SECRET` | Pages secret | HMAC for legacy `/api/ingest` (Apps Script) | set |
| `NOINDEX` | var, `wrangler.toml` | Unlisted mode | `"true"` |
| `CF_ANALYTICS_TOKEN` | build var | Web Analytics | unset |
| `DIRECTORY_SOURCE`, `DIRECTORY_SOURCE_URL` | build env | Build data source | default: live site |
| `TURNSTILE_SITE_KEY`, `HOWTO_VIDEO_URL` | `src/lib/config.ts` | Public config | empty |

- Bindings: `DB` (D1), `RATE_LIMIT` (KV). Backup Worker: `DB`, `BACKUPS` (R2).
- Third parties: Cloudflare only (hosting, D1, KV; Turnstile, R2, Web Analytics planned), on Zaki's
  Cloudflare account. GitHub `zakijariwala`. Legacy Google Form / Apps Script on Zaki's Google account.
- Not used: email, SMS, payments, maps API (Google Maps links only, no key), external auth.

## 5. Auth

- Public: no login.
- One role, moderator: shared passcode → `POST /api/login` → HttpOnly cookie, HMAC-signed with the
  passcode, 12 h.
- Enforcement: app level only (`requireAdmin()` in `pending`, `pending.xlsx`, `approve`, `import`,
  `publish`). No DB-level security.
- Privacy in app code: phones excluded from public data by a field allowlist (test-enforced);
  numbers revealed one at a time via `/api/reveal`, per-IP limit 20/h, 60/day (KV); consent check in SQL.

## 6. Files / uploads

- No user uploads. Static assets in `public/` (logos, briefing PDF).
- Excel upload in `/moderate` is parsed in memory, not stored.

## 7. Background jobs

- Cron: `workers/backup` (02:00 UTC, D1 → R2 JSON, 30-day prune). Written, **not deployed** (R2 not enabled).
- Outbound webhook: "Publish to site" → Pages deploy hook; also auto on removal requests
  (throttled 10 min). Inactive until `DEPLOY_HOOK_URL` is set.
- Inbound webhook: `/api/ingest` (legacy Apps Script, HMAC). Likely unused.
- No queues.

## 8. Domain, DNS, SSL

- No custom domain; `pages.dev` subdomain. DNS and SSL managed by Cloudflare (Zaki's account).
- Custom domain pending a committee decision.

## 9. Repo

- https://github.com/zakijariwala/jamaat-directory (`main`).
- Secrets in history: none found by scan. Committed and expected: D1/KV IDs in `wrangler.toml`
  (identifiers, not credentials), test fixture `'shared-secret'`, placeholders in `.dev.vars.example`,
  businesses' public Google Maps phone numbers in `data/pilot/*.csv`.
- The project began as an orphan branch on `ai-website-cloner-template`; check that repo for old copies.
- Rotate `ADMIN_PASSCODE` at handoff (it has been shared).

## 10. Features

**Traveller (public)**
- City search with old-name aliases (Poona → Pune).
- City page: jamaat office, contacts (representative first), masjid, musafir khana, hotels,
  restaurants; status chips; "Not listed yet" for gaps; stale / reported badges.
- Show number (one at a time, rate limited).
- Report a problem / request removal (in-site dialog → `/api/flag`).
- `/contribute` form (lands as pending), About + feedback, `/howitworks`.

**Moderator**
- `/moderate`: pending queue, approve / reject; Excel download / upload of statuses; Publish to site.

**Operator (CLI)**
- `import:listings`, `db:import-pilot`, `db:clear`, `db:purge-samples`, `db:migrate`.

**Half-built / known broken**
- Turnstile not enabled: forms and reveal protected only by rate limits.
- Publish button fails without `DEPLOY_HOOK_URL`; deploy manually.
- No editing in moderation; reports, removal requests and feedback stored but not shown in any UI;
  no re-verification UI.
- Shared passcode, no audit log.
- One contact per submission; WhatsApp "Not sure" stored as "No".
- Changing an existing city's office number needs a DB edit.
- Backups not running.
- Map links are Google searches, not place pins.
- Legacy `/api/ingest` still deployed.
- Briefing docx/pdf and `/howitworks` still describe the Google Form intake.
- Lighthouse targets not verified.
- Open committee decisions: access posture, domain, moderators, endorsement.

## 11. Backups

- Automated: none (backup Worker not deployed).
- Manual: D1 export from 4 Oct (before `db:clear`) on Zaki's laptop in `backups/` (gitignored).
- D1 Time Travel point-in-time restore (`wrangler d1 time-travel`) should be on by default; confirm.
- Restore never tested.
