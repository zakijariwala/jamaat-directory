# Dependencies

What each piece of work is waiting on, and the outside services, accounts
and secrets the project relies on. Update it when something unblocks.

## Work dependencies

```
Migration 0005 on live DB ──► Merge PR ──► Deploy hook + DEPLOY_HOOK_URL ──► Deploy
        │                                                                     │
        └─ must come first, or /contribute fails after merge                  ▼
                                                              Pilot data phases 1–5
Phase 1 (jamaat list) ──► pick 15 cities ──► Phase 2 (jamaat rows)               │
                                    ├──► Phase 3 (masjids / stays)               │
                                    └──► Phase 4 (food / hotels) ──► Phase 5 check ──► import ──► approve ──► Publish
Real data approved ──► remove seed fallbacks ──► Launch
Turnstile site key ──► TURNSTILE_SECRET ──► Launch
Committee decisions (access, domain, moderators, endorsement) ──► Launch
Admin dashboard: per-moderator logins ──► activity log
```

| Item | Blocked by | Owner |
|---|---|---|
| Merge the open PR | `npm run db:migrate` on the live DB | Zaki |
| Publish to site button working | Git-connected Pages project + deploy hook + `DEPLOY_HOOK_URL` secret | Zaki |
| Pilot data phases 2–4 | Phase 1: choosing the 15 cities | Zaki |
| Contacts and representatives | People adding themselves (or giving permission) via `/contribute` | Jamaat volunteers |
| Remove seed fallbacks | Real data live in D1 | Dev |
| Turnstile | Turnstile site created (site key + secret) | Zaki → Dev |
| Custom domain | Committee picks the domain | Committee |
| Go fully public (`NOINDEX=false`) | Access-posture decision + endorsement | Committee |
| Activity log in dashboard | Decision on per-moderator logins | Zaki |
| Backups running | R2 enabled + bucket + backup Worker deployed | Zaki |

## External services and accounts

| Service | Used for | Status | Where |
|---|---|---|---|
| Cloudflare Pages | Hosting + Functions | ✅ live | project `jamaat-directory` |
| Cloudflare D1 | Database | ✅ | `jamaat_directory`, id in `wrangler.toml` |
| Cloudflare KV | Rate limits, rebuild throttle | ✅ | `RATE_LIMIT`, id in `wrangler.toml` |
| Cloudflare R2 | Nightly backups | ⏳ not enabled | `workers/backup` |
| Cloudflare Turnstile | Bot protection | ⏳ not set up | `src/lib/config.ts` + secret |
| Cloudflare Web Analytics | Visit counts (no cookies) | ⏳ optional | `CF_ANALYTICS_TOKEN` build var |
| GitHub | Code, PRs, Pages Git builds | ✅ | `zakijariwala/jamaat-directory` |
| Gemini + Google Maps | Collecting pilot data | to use | `docs/gemini-data-prompts.md` |
| Google Form / Apps Script | Legacy intake; Report/Remove links still use the form | legacy | `docs/apps-script.gs`, `FORM_URL` |

## Secrets and config

Secrets are set with `npx wrangler pages secret put NAME`, never committed.

| Name | Kind | Purpose | Status |
|---|---|---|---|
| `ADMIN_PASSCODE` | secret | `/moderate` login | ✅ set |
| `DEPLOY_HOOK_URL` | secret | Publish to site | ⏳ |
| `TURNSTILE_SECRET` | secret | Bot check (set only after the site key is in config) | ⏳ |
| `INGEST_SECRET` | secret | Legacy Apps Script HMAC | ✅ set |
| `NOINDEX` | var (`wrangler.toml` / build) | Unlisted by default | `"true"` |
| `CF_ANALYTICS_TOKEN` | build var | Analytics beacon | unset |
| `DIRECTORY_SOURCE` / `DIRECTORY_SOURCE_URL` | build env | Where pages get data (`seed` for offline builds) | default: live site |
| `TURNSTILE_SITE_KEY`, `HOWTO_VIDEO_URL` | `src/lib/config.ts` | Public config | empty |

## Tooling

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.18+ (`.node-version`) | Windows: run `scripts/*.sh` in Git Bash |
| npm packages | see `package.json` | Astro 7, Wrangler 4, Vitest 4, TypeScript 7, Tailwind 4, `xlsx`, `tsx` |
| Internet during `npm run build` | required | Reads the live directory; offline: `DIRECTORY_SOURCE=seed` |
