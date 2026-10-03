# Decisions

Every product and technical decision, with the reason, so future sessions
don't reopen settled questions. Add new entries at the top of the log. Open
questions are at the bottom (and in `TODO.md` §7).

## Log

| # | Date | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 25 | 3 Oct 2026 | Restaurants are **screened for halal** before import: no pure-veg, dhaba, bar-style or unnamed places; `halal` stays "Not sure" unless confirmed | A halal directory listing a non-halal place breaks trust | List everything Gemini returns |
| 24 | 3 Oct 2026 | Pilot data files are **committed** in `data/pilot/` (not the gitignored `data/imports/`) | They hold only businesses' public numbers (no personal ones), and the import has to run from Zaki's laptop | Keep them local only |
| 23 | 3 Oct 2026 | Several jamaats in one area: **village jamaats are listed under their own village name**; jamaats sharing one city get a combined name (e.g. "Kalupur Jamaat & Sarkhej Jamaat") | It's what travellers search for; no code change | Multi-jamaat support per city |
| 22 | 3 Oct 2026 | Pilot uses the **5 states that have jamaats**: Gujarat (6), Maharashtra (6), Karnataka, Telangana, Chhattisgarh (1 each). North and East come later as **listing-only cities** (masjid / food / hotels, no jamaat) | KhojaPedia's India Federation list has jamaats only in these states; Gemini's North/East rows were unsupported | Keep one state per region |
| 21 | 3 Oct 2026 | A removal request triggers a site rebuild, throttled to once per 10 min | Takes the name off the static page; the endpoint is public, so throttling protects the build allowance | Rebuild on every removal; never |
| 20 | 3 Oct 2026 | Cleared to empty the live database (`npm run db:clear`) | Zaki confirmed there are no real submissions; Mahuva was a test | Purge only the sample rows |
| 19 | 3 Oct 2026 | Production builds **fail** if the live directory can't be read | Never silently publish sample data | Fall back to `seed.ts` |
| 18 | 3 Oct 2026 | **Pages are built from the live DB**, with a **Publish to site** button (Pages deploy hook) | Keeps pages static: fast on 3G, work without JS, reuse the existing templates. Batch approvals then one rebuild (~2 min) | Client-render city pages from `/directory.json` (instant, but needs JS and a template rewrite); rebuild on every approval (burns build quota) |
| 17 | 3 Oct 2026 | Pilot **includes incomplete cities**; city pages show a "Not listed yet" box | Shows the realistic picture: most towns won't have everything | Only publish complete cities |
| 16 | 3 Oct 2026 | *(Superseded by 22.)* Pilot = **15 cities: 5 states (one per region) × 3 jamaat sizes**, sized by jamaat not city population | Covers all regions and page shapes with a manageable data effort | Chain-first seeding (e.g. all KGN restaurants in two states) |
| 15 | 3 Oct 2026 | **No hand-typed seed data.** Real data comes from supplied lists (bulk import) and `/contribute`; Gemini + Google Maps used to collect lists | Repeatable, auditable, and every row is moderated | Editing `seed.ts` by hand |
| 14 | 3 Oct 2026 | **People are never bulk-imported** (contacts, representatives) | They must give permission; that's captured in `/contribute` | Importing contact lists |
| 13 | 3 Oct 2026 | A jamaat gets **both** an office number and a named official representative | Office when there is one; a person as the fallback, especially for small jamaats | Only one of the two |
| 12 | 3 Oct 2026 | Imports and public submissions **never overwrite an existing city** | A submission could knock a live city back to pending or wipe its office number | Overwrite (old behaviour) |
| 11 | 3 Oct 2026 | Restaurants in towns with no jamaat are created as **pending sparse cities**; the moderator decides at approval | Fits the incomplete-cities pilot | Attach to the nearest jamaat city |
| 10 | 3 Oct 2026 | Same-name outlets (chains) in one city are told apart by an address hash in the id | Two KGN outlets in one city must both be listed; re-imports stay idempotent | Name-only ids |
| 9 | Jul 2026 | **In-site intake** (`/contribute` → `/moderate`) replaces the Google Form / Sheet / Apps Script | One system, no Google dependency, moderation in one place | Keep the Google path |
| 8 | Jul 2026 | Ship **unlisted** (`noindex`) by default | Access posture is a committee decision; unlisted is the safe default | Public; passcoded |
| 7 | Jul 2026 | `/api/*` are **Pages Functions**, not a separate Worker | Same runtime, same origin, simpler deploy | Standalone Worker |
| 6 | Jul 2026 | **Restaurants** added as a facility kind | Requested; no migration needed | — |
| 5 | Jul 2026 | **Indore** added to the samples | So all five regions have a city | — |
| 4 | Jul 2026 | Design: navy/red "field-manual" system, Public Sans + JetBrains Mono, 17px base, inline SVG icons | Delivered design superseded the PRD; inline SVG survives WhatsApp/Instagram in-app browsers | PRD's IBM Plex / Jade |
| 3 | Jul 2026 | A contact is published only if self-added **or** consented | Privacy | — |
| 2 | Jul 2026 | **No phone number in the public data**; numbers revealed one at a time, rate limited | Stops scraping of the whole directory | Numbers in the page |
| 1 | Jul 2026 | Cloudflare stack: Pages (Astro static) + Functions + D1 + KV (+ R2 backups) | ₹0/month at this scale, one vendor, edge-fast | — |

## Open questions

| Question | Options | Owner |
|---|---|---|
| Access posture | public / unlisted (current) / passcoded | Committee |
| Hotels + restaurants in v1 | keep both / drop one / drop both (being collected for the pilot) | Committee |
| Named moderators | at least two people | Committee |
| Domain name | — | Committee |
| Endorsement before launch | which jamaat body, and does it change what may be published | Committee |
| Moderator logins | one shared passcode (current) / a login per moderator | Zaki |
| Representatives per jamaat | exactly one (auto-replace on approve) / several | Zaki |
