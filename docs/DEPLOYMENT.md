# Deploying the Jamaat Directory to Cloudflare

A step-by-step runbook to take this repo from nothing to a live site with the
full backend pipeline. Everything here fits Cloudflare's **free tier** at launch
scale — see [Costs](#costs) at the end.

## What you'll end up with

| Resource | Purpose |
|---|---|
| **Pages project** | Frontend + the `/api/*` and `/directory.json` Functions |
| **D1 database** | Source of truth (holds phone numbers) |
| **KV namespace** | Per-IP rate limiting for number reveals |
| **R2 bucket** | Nightly backups |
| **Worker** (scheduled) | Runs the nightly backup |
| **Turnstile** (later) | Bot check on the first reveal of a session |

---

## Phase 0 — Prerequisites

- A Cloudflare account → **dash.cloudflare.com**
- Node **22.18+**, the repo cloned on branch `jamaat-directory`, then `npm install`
- Log in: `npx wrangler login` (opens a browser)

## Phase 1 — Create the resources

```bash
npx wrangler d1 create jamaat_directory
npx wrangler kv namespace create RATE_LIMIT
npx wrangler r2 bucket create jamaat-directory-backups
```

The first two commands each print an **`id`** — copy them.

## Phase 2 — Paste the IDs into config

- **`wrangler.toml`** → set `database_id` (D1) and the KV `id`.
- **`workers/backup/wrangler.toml`** → set the **same** `database_id`.

## Phase 3 — Schema + data (remote D1)

```bash
npm run db:migrate     # applies migrations/0001_init.sql to the remote D1
npm run db:seed        # loads the sample cities (swap for real data at launch)
```

## Phase 4 — Deploy the frontend

```bash
npm run deploy         # astro build + wrangler pages deploy ./dist
```

The first run **creates the Pages project** `jamaat-directory` and gives you a URL
like `https://jamaat-directory.pages.dev`. The D1/KV/R2 bindings are read from
`wrangler.toml`.

> **Build-time vars** (read by Astro during `npm run build`): `NOINDEX` (defaults
> `"true"` = unlisted) and `CF_ANALYTICS_TOKEN`. Set them in your shell for a
> local deploy, or in **Pages → Settings → Environment variables** for
> dashboard/Git builds.

## Phase 5 — The ingest secret

```bash
openssl rand -hex 32                        # copy the output
npx wrangler pages secret put INGEST_SECRET # paste it when prompted
```

Keep this value — the Apps Script uses the **same** one in Phase 10.
*(Don't set `TURNSTILE_SECRET` yet — see Phase 8.)*

## Phase 6 — Nightly backup Worker

```bash
cd workers/backup
npx wrangler deploy      # registers the 02:00 UTC cron
cd ../..
```

Test it immediately: open the worker's URL in a browser (its `GET` path runs one
backup), then check the R2 bucket for `backups/YYYY-MM-DD.json`.

## Phase 7 — Web Analytics (optional, no cookies)

Dashboard → **Web Analytics** → add your site → copy the **token**, then set it
and redeploy:

```bash
CF_ANALYTICS_TOKEN=<token> npm run deploy
```

## Phase 8 — Turnstile ⚠️ do this AFTER the client widget is wired

1. Dashboard → **Turnstile** → **Add site** → note the **Site key** (client) +
   **Secret key** (server).
2. `npx wrangler pages secret put TURNSTILE_SECRET`

> **Ordering matters:** `/api/reveal` enforces Turnstile **only when
> `TURNSTILE_SECRET` is set**. Until the client-side widget passes a token,
> setting this makes "Show number" return `403`. Leave it unset for the
> prototype — **rate limiting (KV) is already active and needs no widget.**
> Turnstile goes in with the one remaining code task (the client widget).

## Phase 9 — Custom domain

Pages project → **Custom domains** → **Set up a domain** → enter yours. If the
domain's DNS is already on Cloudflare it's automatic; otherwise add the CNAME it
shows you.

## Phase 10 — Google intake (connects the Form → Cloudflare)

*(Google side — needed for live contributions.)*

1. Build the **Google Form**; link responses to a **Sheet**.
2. Sheet → **Extensions → Apps Script** → paste **`docs/apps-script.gs`**.
3. **Project Settings → Script properties**:
   - `INGEST_URL` = `https://<your-domain>/api/ingest`
   - `INGEST_SECRET` = *(the same value from Phase 5)*
4. **Triggers** (clock icon): add `onFormSubmit` (on form submit) and
   `onEditRow` (on edit).
5. Edit the `COLS` map to match your sheet's header names.

## Phase 11 — Access posture

Default `NOINDEX="true"` ships `noindex` + a disallow `robots.txt` (unlisted). To
go **fully public**: set `NOINDEX=false` as a build var and redeploy.

---

## Verify end-to-end

- [ ] `https://<domain>/` loads; typing `madras` finds Chennai
- [ ] `https://<domain>/directory.json` has data and **no `phone` field**
- [ ] A city page → **Show number** reveals via `/api/reveal`
- [ ] Add a Sheet row, set **Status=live** + tick consent → appears within ~5 min
- [ ] Report / Remove → the entry drops out
- [ ] Backup Worker → an object exists in R2
- [ ] Lighthouse (mobile): Perf 90+, Accessibility 100

---

## Git-connected alternative

Instead of `npm run deploy`, connect the repo + `jamaat-directory` branch in the
Pages dashboard (build command `npm run build`, output `dist`), and add the
D1/KV/R2 bindings under **Settings → Functions**. Then every push auto-deploys.

Once D1 is live, the seed **fallbacks** in `functions/directory.json.ts` and
`functions/api/reveal.ts` stay dormant (they only run when D1 is unbound) —
optional to remove.

---

## Costs

**Bottom line: ₹0 / $0 per month on Cloudflare at this scale.** The whole system
is designed to sit inside the free tier. The only money involved is a domain
name if you want one, and an optional paid plan only if usage grows a lot.

Approximate free-tier limits at the time of writing (Cloudflare changes these —
verify on their pricing pages), with this app's demand next to each:

| Service | Free tier (approx.) | This app needs | Verdict |
|---|---|---|---|
| **Pages** (static hosting) | Unlimited requests + bandwidth; 500 builds/mo | A handful of deploys | ✅ Free |
| **Pages Functions / Workers** | 100,000 requests/day | `/directory.json` is edge-cached (~5 min); reveals are a few per visit | ✅ Free |
| **D1** | 5 GB; 5M row-reads/day; 100k row-writes/day | A few thousand records total | ✅ Free |
| **KV** (rate limiting) | ~100k reads/day; **~1,000 writes/day**; 1 GB | ~3 writes per reveal → ~**300 reveals/day** free | ✅ Free at launch; see note |
| **R2** (backups) | 10 GB; generous ops; **egress free** | 1 small write/night + prune | ✅ Free |
| **Turnstile** | Unlimited | Bot check on first reveal | ✅ Free |
| **Web Analytics** | Unlimited, no cookies | Page/search metrics | ✅ Free |

### The one thing to watch

**KV writes.** The reveal rate-limiter writes ~3 KV keys per number reveal, and
the free tier is ~1,000 KV writes/day per namespace — so roughly **300 reveals a
day** before you'd hit it. For a single-jamaat-network launch that's plenty
(reveals are typically dozens/day). If the directory takes off network-wide and
reveals climb into the thousands/day, **Workers Paid (~$5/month)** raises KV to
~1M writes/day and removes the concern.

### Actual out-of-pocket

- **Domain name** — ~**$8–12/year** if you want a custom domain and don't already
  own one, paid to a registrar (Cloudflare Registrar sells at cost, no markup).
  Connecting the domain to Pages is free. You can also launch on the free
  `*.pages.dev` URL and add a domain later.
- **Google** (Form / Sheet / Apps Script) — **free** on a normal Google account;
  Apps Script's daily `UrlFetchApp` quota (thousands of calls/day) far exceeds a
  moderation workflow.

### Optional, not required at launch

- **Workers Paid (~$5/month)** — headroom for KV writes + Functions requests once
  the network is large.
- **Cloudflare Access (free for small teams)** — if/when you add a moderator
  admin page (month-two item), to gate it behind email login.

**So: launch cost is effectively $0/month, plus an optional ~$10/year for a
domain.**
