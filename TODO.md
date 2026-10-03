# TODO — Jamaat Directory

Up-to-date list of what's left before and after launch. Last updated: 3 October 2026.

**Where things stand:** the site is live at https://jamaat-directory.pages.dev
(unlisted, `noindex`) running the latest `main`. 60 tests pass, typecheck and
build are clean. Every entry is still fictional sample data.

Legend: 🔴 launch blocker · 🟠 should do before launch · 🟢 after launch / polish

---

## 1. Launch blockers 🔴

- [ ] **Real data.** Replace the 12 sample cities / 14 contacts / 22 facilities
      in `src/data/seed.ts` with real entries (or load them via `/contribute`
      + moderation) and clear the samples from the live D1.
- [ ] **Approvals must reach the city pages.** City pages are built from
      `seed.ts` at build time, so an approved D1 entry only shows on its city
      page after a rebuild. Pick one: client-render city/home pages from
      `/directory.json` (recommended), or trigger a Pages rebuild on approve.
- [ ] **Turnstile (bot protection).** Create the Turnstile site, set
      `TURNSTILE_SITE_KEY` in `src/lib/config.ts`, then
      `wrangler pages secret put TURNSTILE_SECRET`. Covers `/contribute`,
      feedback, flag, reveal.
- [ ] **Remove seed fallbacks** in `functions/directory.json.ts` and
      `functions/api/reveal.ts` so a D1 failure never silently serves sample data.
- [ ] **Move Report / Remove in-site.** City pages still link to the old Google
      Form (`FORM_URL`); point them at `/api/flag` with an in-site form.

## 2. Jamaat representative / office number 🟠

Today a jamaat (`cities` table) has **no phone number of its own** — no office
number and no designated representative. The only numbers are individual
contacts (with a role such as President or Secretary) and facility phones
(masjid, musafir khana, etc.).

- [ ] Decide the model: a jamaat **office number** on the city, a flagged
      **official representative** among the contacts, or both.
- [ ] Migration (e.g. `cities.office_phone` and/or `contacts.is_representative`).
- [ ] Show it at the top of the city page ("Jamaat office" / "Jamaat
      representative") behind the same one-at-a-time **Show number** reveal —
      never in `directory.json`.
- [ ] Add the field(s) to `/contribute`, the moderation dashboard, the Excel
      round-trip, and the no-phone snapshot test.

## 3. Admin dashboard (`/moderate`) 🟠

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

## 4. Contribute form fixes 🟠

- [ ] **Several contacts per submission** — currently one contact per form, so a
      President and a Secretary need two submissions.
- [ ] **WhatsApp "Not sure"** is stored as "No" (`whatsapp: val === 'Yes'`), so
      no WhatsApp button appears. Store it as unknown or default to showing it.
- [ ] Publish the how-to video and set `HOWTO_VIDEO_URL` in `src/lib/config.ts`.

## 5. Infrastructure 🟢

- [ ] **Nightly R2 backups** — enable R2, `npx wrangler r2 bucket create
      jamaat-directory-backups`, `cd workers/backup && npx wrangler deploy`.
- [ ] **Custom domain** (see `docs/DEPLOYMENT.md`).
- [ ] **Web Analytics** — set `CF_ANALYTICS_TOKEN` as a build var.
- [ ] Lighthouse check against the deployed site (Perf 90+, A11y 100, JS < 50KB gz).
- [ ] Retire the Google Form / Apps Script intake once in-site flows cover
      everything (`docs/apps-script.gs`).

## 6. Decisions needed from the committee

- [ ] Access posture: public, unlisted (current), or passcoded.
- [ ] Keep hotels and restaurants in v1?
- [ ] At least two named moderators.
- [ ] Domain name.
- [ ] Which jamaat body (if any) must endorse before launch, and does that
      change what may be published.
- [ ] Jamaat office number vs. named representative (§2).
- [ ] Shared passcode vs. per-moderator logins (§3).

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
- Deployed to Cloudflare Pages with D1 + KV; `noindex` on by default
