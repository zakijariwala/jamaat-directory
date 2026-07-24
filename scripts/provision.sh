#!/usr/bin/env bash
#
# One-shot Cloudflare provisioning + deploy for the Jamaat Directory.
# The manual, explained equivalent is docs/DEPLOYMENT.md.
#
# Usage:
#   bash scripts/provision.sh [--no-seed] [--domain example.org] [--turnstile] [--analytics]
#
#   --no-seed     Apply the schema but don't load the sample cities.
#   --domain X    Attach a custom domain to the Pages project (REST API).
#   --turnstile   Create a Turnstile widget and print its keys (REST API).
#   --analytics   Create a Web Analytics site and print the token (REST API).
#
# Auth:
#   Core steps need `npx wrangler login` OR an exported CLOUDFLARE_API_TOKEN.
#   The --domain/--turnstile/--analytics steps use the Cloudflare REST API and
#   REQUIRE both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
#
# The D1 database id and KV namespace id are NOT secrets; committing the patched
# wrangler.toml files is fine.

set -euo pipefail
cd "$(dirname "$0")/.."

WR="npx --yes wrangler"
DB_NAME="jamaat_directory"
KV_BINDING="RATE_LIMIT"
R2_BUCKET="jamaat-directory-backups"
PROJECT="jamaat-directory"
BRANCH="jamaat-directory"

SEED=1
DOMAIN=""
TURNSTILE=0
ANALYTICS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --no-seed) SEED=0 ;;
    --domain) DOMAIN="${2:-}"; shift ;;
    --turnstile) TURNSTILE=1 ;;
    --analytics) ANALYTICS=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

say()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!  %s\033[0m\n' "$*" >&2; }

command -v node >/dev/null || { echo "node is required"; exit 1; }

say "Checking Cloudflare auth"
if ! $WR whoami >/dev/null 2>&1; then
  echo "Not authenticated. Run 'npx wrangler login' or export CLOUDFLARE_API_TOKEN." >&2
  exit 1
fi

# ---------------------------------------------------------------- D1
get_d1_id() {
  $WR d1 list --json 2>/dev/null | DB_NAME="$DB_NAME" node -e '
    try {
      const raw = require("fs").readFileSync(0, "utf8").trim() || "[]";
      const d = JSON.parse(raw); const arr = Array.isArray(d) ? d : (d.result || []);
      const m = arr.find((x) => x.name === process.env.DB_NAME);
      process.stdout.write(m ? (m.uuid || m.id || "") : "");
    } catch { process.stdout.write(""); }'
}
say "Ensuring D1 database: $DB_NAME"
D1_ID="$(get_d1_id || true)"
if [ -z "$D1_ID" ]; then $WR d1 create "$DB_NAME" >/dev/null; D1_ID="$(get_d1_id || true)"; fi
[ -n "$D1_ID" ] || { echo "Could not resolve D1 id" >&2; exit 1; }
echo "  D1 id: $D1_ID"

# ---------------------------------------------------------------- KV
get_kv_id() {
  $WR kv namespace list --json 2>/dev/null | KV_BINDING="$KV_BINDING" node -e '
    try {
      const raw = require("fs").readFileSync(0, "utf8").trim() || "[]";
      const d = JSON.parse(raw); const arr = Array.isArray(d) ? d : (d.result || []);
      const m = arr.find((x) => (x.title || "").includes(process.env.KV_BINDING));
      process.stdout.write(m ? m.id : "");
    } catch { process.stdout.write(""); }'
}
say "Ensuring KV namespace: $KV_BINDING"
KV_ID="$(get_kv_id || true)"
if [ -z "$KV_ID" ]; then $WR kv namespace create "$KV_BINDING" >/dev/null; KV_ID="$(get_kv_id || true)"; fi
[ -n "$KV_ID" ] || { echo "Could not resolve KV id" >&2; exit 1; }
echo "  KV id: $KV_ID"

# ---------------------------------------------------------------- R2
say "Ensuring R2 bucket: $R2_BUCKET"
$WR r2 bucket create "$R2_BUCKET" >/dev/null 2>&1 || warn "R2 bucket already exists (or was skipped)"

# ---------------------------------------------------------------- patch config
say "Writing ids into wrangler.toml + workers/backup/wrangler.toml"
D1_ID="$D1_ID" KV_ID="$KV_ID" node -e '
  const fs = require("node:fs");
  const d1 = process.env.D1_ID, kv = process.env.KV_ID;
  let s = fs.readFileSync("wrangler.toml", "utf8");
  s = s.replace(/database_id = "[^"]*"/, `database_id = "${d1}"`);
  const lines = s.split("\n"); let seen = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("RATE_LIMIT")) { seen = true; continue; }
    if (seen && /^\s*id\s*=/.test(lines[i])) {
      lines[i] = lines[i].replace(/id\s*=\s*"[^"]*"/, `id = "${kv}"`); seen = false;
    }
  }
  fs.writeFileSync("wrangler.toml", lines.join("\n"));
  let b = fs.readFileSync("workers/backup/wrangler.toml", "utf8");
  b = b.replace(/database_id = "[^"]*"/, `database_id = "${d1}"`);
  fs.writeFileSync("workers/backup/wrangler.toml", b);
  console.log("  patched.");
'

# ---------------------------------------------------------------- schema + seed
say "Applying D1 schema (remote)"
npm run db:migrate
if [ "$SEED" -eq 1 ]; then
  say "Seeding sample data (remote) — pass --no-seed to skip"
  npm run db:seed
fi

# ---------------------------------------------------------------- Pages project + deploy
say "Ensuring Pages project: $PROJECT"
$WR pages project create "$PROJECT" --production-branch "$BRANCH" >/dev/null 2>&1 \
  || warn "Pages project already exists"
say "Building + deploying frontend"
npm run deploy

# ---------------------------------------------------------------- ingest secret
say "Setting INGEST_SECRET"
INGEST_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
printf '%s' "$INGEST_SECRET" | $WR pages secret put INGEST_SECRET --project-name "$PROJECT" >/dev/null
echo "  INGEST_SECRET (copy into the Apps Script now — shown once):"
echo "    $INGEST_SECRET"

# ---------------------------------------------------------------- backup worker
say "Deploying backup Worker"
( cd workers/backup && $WR deploy >/dev/null )

# ---------------------------------------------------------------- optional REST API steps
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-${ACCOUNT_ID:-}}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
api() { curl -sf -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
need_api() { [ -n "$ACCOUNT" ] && [ -n "$TOKEN" ]; }

if [ -n "$DOMAIN" ]; then
  if need_api; then
    say "Attaching custom domain: $DOMAIN"
    api -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/pages/projects/$PROJECT/domains" \
      -d "{\"name\":\"$DOMAIN\"}" >/dev/null && echo "  domain requested (finish DNS if prompted)" \
      || warn "domain attach failed"
  else warn "Skipping --domain: set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"; fi
fi

if [ "$TURNSTILE" -eq 1 ]; then
  if need_api; then
    dom="${DOMAIN:-$PROJECT.pages.dev}"
    say "Creating Turnstile widget for $dom"
    api -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/challenges/widgets" \
      -d "{\"name\":\"jamaat-directory\",\"domains\":[\"$dom\"],\"mode\":\"managed\"}" \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s).result;console.log("  sitekey:",r.sitekey);console.log("  secret :",r.secret);}catch{console.log("  (could not parse Turnstile response)")}})' || warn "Turnstile create failed"
    warn "Do NOT set TURNSTILE_SECRET until the client widget is wired, or reveals will 403."
  else warn "Skipping --turnstile: set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"; fi
fi

if [ "$ANALYTICS" -eq 1 ]; then
  if need_api; then
    dom="${DOMAIN:-$PROJECT.pages.dev}"
    say "Creating Web Analytics site for $dom"
    api -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/rum/site_info" \
      -d "{\"host\":\"$dom\",\"auto_install\":true}" \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s).result;console.log("  set CF_ANALYTICS_TOKEN =",(r.site_tag||"(see dashboard)"));}catch{console.log("  (could not parse analytics response)")}})' || warn "Analytics create failed"
  else warn "Skipping --analytics: set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"; fi
fi

say "Done."
cat <<EOF

Next steps
  • Copy the INGEST_SECRET above into the Apps Script (Script Properties).
  • Live site:      https://$PROJECT.pages.dev${DOMAIN:+  (or https://$DOMAIN)}
  • Snapshot:       https://$PROJECT.pages.dev/directory.json  (contains no phone numbers)
  • Turnstile:      wire the client widget, then: $WR pages secret put TURNSTILE_SECRET
  • Full guide:     docs/DEPLOYMENT.md
EOF
