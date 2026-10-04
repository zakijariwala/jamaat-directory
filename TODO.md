# TODO — Jamaat Directory

Up-to-date list of what's left before and after launch. Last updated: 4 October 2026.

**Where things stand:** the site is live at https://jamaat-directory.pages.dev
(unlisted, `noindex`) running `main`. PR #1 (office/representative, importer,
build-from-live-DB, in-site Report / Remove) was merged and deployed 4 Oct. The
live DB holds the 15-city pilot as pending; nothing is public until approved.

See also: `docs/PROGRESS.md` (status + pilot table), `docs/DECISIONS.md`,
`docs/DEPENDENCIES.md`, `docs/gemini-data-prompts.md`.

**Pending worklist (Zaki):** deploy hook, approve pilot → Publish, Turnstile.
See the worklist table in `docs/PROGRESS.md`.

**Go-live sequence for this round** (steps 1–3 and 5 done 4 Oct; 6 imported, awaiting approval):
1. On the branch: `npm run db:migrate` (adds office / representative / source
   columns — do this **before** merging, or `/contribute` submissions fail)
2. `npm run db:clear` (empties the live DB; type `jamaat_directory` to confirm)
3. Merge `feat/seed-import-and-representative` into `main`
4. Create the deploy hook + `npx wrangler pages secret put DEPLOY_HOOK_URL`
5. `npm run deploy` (site rebuilds from the now-empty live DB)
6. Import supplied lists → approve in `/moderate` → **Publish to site**

Legend: 🔴 launch blocker · 🟠 should do before launch · 🟢 after launch / polish

---

## 1. Launch blockers 🔴

- [ ] **Real data — 15-city pilot** (see §2). No hand-typed seed: data comes from
      supplied lists (bulk import) and `/contribute`.
- [x] **Approvals reach the city pages.** Production builds now render the
      home + city pages from the live `/directory.json` (D1), not `seed.ts`,
      and refuse to build if it's unreachable. `/moderate` has **Publish to
      site** (rebuild via deploy hook); removal requests trigger a rebuild too.
- [ ] **Create the deploy hook** (Cloudflare → Pages → jamaat-directory →
      Settings → Builds → Deploy hooks, branch `main`) and save it:
      `npx wrangler pages secret put DEPLOY_HOOK_URL`. Without it, run
      `npm run deploy` after approving instead.
- [x] **Clear the live D1** (done 4 Oct; approved — no real submissions; the 12th live
      city, Mahuva, was a test): `npm run db:clear`, then `npm run deploy`.
      (`npm run db:purge-samples` remains for removing only the sample rows.)
- [ ] **Turnstile (bot protection).** Create the Turnstile site, set
      `TURNSTILE_SITE_KEY` in `src/lib/config.ts`, then
      `wrangler pages secret put TURNSTILE_SECRET`. Covers `/contribute`,
      feedback, flag, reveal.
- [x] **Remove seed fallbacks** in `functions/directory.json.ts` and
      `functions/api/reveal.ts`: no DB binding now returns 503 (decision 27).
- [x] **Move Report / Remove in-site.** City pages open a dialog that posts to
      `/api/flag` (per contact, per masjid/stay, and from the footer); the
      home "add" link goes to `/contribute`. `FORM_URL` removed. Removal is
      self-service for contacts only (decision 26). Needs a click-through on
      the deployed site.

## 2. Seed data — 15-city pilot 🔴

Plan (decision 22): **the 5 states that have jamaats** — Gujarat 6,
Maharashtra 6, Karnataka / Telangana / Chhattisgarh 1 each; North and East
later as listing-only cities.

**Deliberately a mix of complete and incomplete cities**, so the pilot shows
the real-world picture (most towns won't have everything):

| Mix | Roughly | Example of what's there |
|---|---|---|
| Complete | ~5 | office + representative + contacts + masjid + stay (+ restaurant) |
| Partial | ~5 | e.g. a contact and a masjid, no stay; or a masjid and hotels, no contact |
| Sparse | ~5 | a single item — one contact, or only halal restaurants/hotels from a supplied list |

*Complete* is a target, not a gate: jamaat name, state, nearest rail/air ·
jamaat office number (if an office exists) **and** a named representative ·
1–2 more consented contacts · masjid/imambargah · musafir khana or hotel ·
restaurant optional.

- [x] Incomplete city pages show a **"Not listed yet"** box naming what's
      missing (contact / masjid / stay) with an "Add it" link to `/contribute`
- [ ] Check the home index and search read well with many sparse cities
- [x] Bulk import for supplied lists — `npm run import:listings` (see `data/README.md`)
- [x] CSV template — `data/templates/listings-template.csv`
- [x] Guard on `npm run db:seed` (it wipes the remote DB; now asks for confirmation)
- [x] `npm run db:purge-samples` — removes only the fictional rows
- [x] Importer also takes `jamaat` rows (jamaat name, stations, office number, old names)
- [x] Gemini prompts for each data phase — `docs/gemini-data-prompts.md`
- [x] **Phase 1** — jamaat long-list (`data/reference/india-jamaats-khojapedia.csv`)
      → 15 cities proposed (`data/reference/pilot-cities.csv`; decision 22)
- [x] **Phase 2** — jamaat rows (15) → `data/pilot/phase-2-jamaats.csv`
- [x] **Phase 3** — 12 masjids / stays in 7 cities → `data/pilot/phase-3-masjids-stays.csv`
- [x] **Phase 4** — 28 restaurants / hotels in 7 cities → `data/pilot/phase-4-food-hotels.csv`
- [x] **Phase 5** — verified manually (Zaki)
- [x] **Import:** `npm run db:import-pilot` (4 Oct, all pending)
- [ ] Approve the pilot in `/moderate` → Publish to site
- [x] Phase 4b — food + hotels for the 8 cities Gemini skipped (`phase-4b-food-hotels.csv`)
- [ ] Halal restaurant for Bhavnagar, Hinganghat, Pithalpur
- [ ] Confirm halal for Sigdi (Jamnagar), Hyderabad Swadh (Chandrapur)
- [ ] Masjid / stay for Vadodara, Jamnagar, Una, Pithalpur, Nagpur, Chandrapur, Hinganghat, Raipur — via local jamaat contacts
- [ ] Replace Google Maps search links with place share links
- [ ] Office numbers, representatives and contacts → via `/contribute` (needs
      consent, so not bulk-imported); a contacts importer can follow if a
      consented list exists
- [ ] Approve each new city in `/moderate` and fill in its jamaat name

## 3. Jamaat office number + representative 🟠

Decision: **both** — an office number on the jamaat, and a named official
representative among the contacts.

- [x] Migration `0005`: `cities.office_phone`, `contacts.is_representative`
      (+ private `facilities.source` for imports)
- [x] City page: "Jamaat office" card with **Show number** (`/api/reveal?type=office`);
      representative shown first with a badge. Office number never in `directory.json`.
- [x] `/contribute`: office phone field + "official representative" tick box
- [x] `/moderate` queue shows office phone, REPRESENTATIVE, listing source
- [x] Public intake no longer overwrites an existing city (could knock a live
      city back to pending)
- [x] Apply migration to the live D1 (4 Oct); `npm run deploy` after merge
- [ ] Changing the office number of an **existing** city needs the dashboard's
      edit (§4) — `/contribute` only sets it for new cities
- [ ] Decide: one representative per jamaat (auto-unset others on approve) or allow several

## 4. Admin dashboard (`/moderate`) 🟠

Today: one shared passcode, a flat pending list with Approve / Reject, and
Excel download/upload. Expand to a tabbed dashboard:

- [ ] **Pending** — each item opens as an editable card (fix typos before
      approving), with duplicate warnings (same phone, same facility name in
      the city).
- [ ] **Reports** — open problem reports and removal requests (incl. those
      showing "Reported — verify first"), with resolve / edit / remove.
- [ ] **Re-verification** — live contacts and facilities whose `verified_at`
      is over 12 months old, with a **Mark verified** button.
- [ ] **Live** — search all published entries; edit or take down.
- [ ] **Feedback** — inbox for the About-page feedback form.
- [ ] **Activity log** — who approved / edited / removed what, and when
      (needs a small migration).
- [ ] **Per-moderator logins** instead of one shared passcode (needed for a
      meaningful activity log; ties to the "two named moderators" decision).

## 5. Contribute form fixes 🟠

- [ ] **Several contacts per submission** — currently one contact per form, so a
      President and a Secretary need two submissions.
- [ ] **WhatsApp "Not sure"** is stored as "No" (`whatsapp: val === 'Yes'`), so
      no WhatsApp button appears. Store it as unknown or default to showing it.
- [ ] Publish the how-to video and set `HOWTO_VIDEO_URL` in `src/lib/config.ts`.

## 6. Infrastructure 🟢

- [ ] **Nightly R2 backups** — enable R2, `npx wrangler r2 bucket create
      jamaat-directory-backups`, `cd workers/backup && npx wrangler deploy`.
- [ ] **Custom domain** (see `docs/DEPLOYMENT.md`).
- [ ] **Web Analytics** — set `CF_ANALYTICS_TOKEN` as a build var.
- [ ] Lighthouse check against the deployed site (Perf 90+, A11y 100, JS < 50KB gz).
- [ ] Regenerate `docs/jamaat-body-briefing.docx`, `public/ksij-directory-briefing.pdf`
      and the `/howitworks` page from the updated `docs/jamaat-body-briefing.md`
      (they still describe the Google Form intake)
- [ ] Retire the Google Form / Apps Script intake once in-site flows cover
      everything (`docs/apps-script.gs`).

## 7. Decisions needed from the committee

- [ ] Access posture: public, unlisted (current), or passcoded.
- [ ] Keep hotels and restaurants in v1?
- [ ] At least two named moderators.
- [ ] Domain name.
- [ ] Which jamaat body (if any) must endorse before launch, and does that
      change what may be published.
- [x] Jamaat office number vs. named representative → **both** (§3).
- [x] Restaurants in towns with no jamaat → listing-only cities (decisions 11, 22).
- [ ] Shared passcode vs. per-moderator logins (§4).

---

## Done ✅

- Search across India with old-name aliases, city pages, all empty/stale states
- One-at-a-time phone reveal with per-IP rate limiting (KV)
- No-phone-numbers guarantee enforced by code + test; consent rule enforced
- `/contribute` in-site form → pending staging → `/moderate` approve/reject
- Excel export/import of pending items
- Report / removal API (`/api/flag`) with 48h "verify first" caution
- About page (goals + committee) and feedback form
- Contribute guide, `/howitworks` briefing (+ PDF/Word)
- Nightly backup Worker (code ready, not deployed)
- Jamaat office number + representative (code; live DB migration pending)
- Bulk listing importer, sample purge, remote-seed guard
- Pages built from the live DB + Publish to site; "Not listed yet" on incomplete cities
- Deployed to Cloudflare Pages with D1 + KV; `noindex` on by default
