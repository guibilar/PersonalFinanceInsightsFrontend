#!/usr/bin/env sh
# Checks a running frontend container (or any server using docker/default.conf.template):
#   docker/smoke-test.sh [base-url]        default http://localhost:5095
# The API upstream may be down: /api/ requests are only expected to get past nginx (502).
set -eu
BASE="${1:-http://localhost:5095}"
fail() { echo "FAIL: $*" >&2; exit 1; }
header() { curl -sI "$@" | tr -d '\r'; }

page=$(header "$BASE/")
echo "$page" | grep -q '^HTTP/[0-9.]* 200' || fail "index.html is not served"
echo "$page" | grep -qi "^content-security-policy: default-src 'self'; script-src 'self';" || fail "Content-Security-Policy missing"
echo "$page" | grep -qi '^x-frame-options: DENY' || fail "X-Frame-Options missing"
echo "$page" | grep -qi '^x-content-type-options: nosniff' || fail "X-Content-Type-Options missing"
echo "$page" | grep -qi '^cache-control: no-cache' || fail "index.html must be revalidated"
if echo "$page" | grep -qi '^server: nginx/'; then fail "nginx version is exposed"; fi

# HSTS only when the HTTPS proxy in front says the browser used HTTPS.
header -H 'X-Forwarded-Proto: https' "$BASE/" | grep -qi '^strict-transport-security: max-age=' || fail "HSTS missing over HTTPS"
if echo "$page" | grep -qi '^strict-transport-security'; then fail "HSTS sent over plain HTTP"; fi

# Client-side routes fall back to the app; the theme bootstrap is served and revalidated.
curl -sf "$BASE/transactions" | grep -q '<app-root>' || fail "SPA fallback for /transactions"
curl -sf "$BASE/money/transactions" | grep -q '<app-root>' || fail "SPA fallback for /money/transactions"
header "$BASE/theme.js" | grep -qi '^cache-control: no-cache' || fail "theme.js must be revalidated"

# Statements up to 5 MB must reach the API instead of being rejected by nginx (413).
tmp=$(mktemp)
head -c 2000000 /dev/zero > "$tmp"
status=$(curl -s -o /dev/null -w '%{http_code}' -F "file=@$tmp;filename=statement.csv" "$BASE/api/Transaction/Import")
rm -f "$tmp"
[ "$status" != 413 ] || fail "a 2 MB upload was rejected by nginx (413)"

# Other API paths keep the 6 MB limit.
upload() { # size in MiB (nginx's "m"), path, file name
  file=$(mktemp)
  head -c "$(($1 * 1048576))" /dev/zero > "$file"
  curl -s -o /dev/null -w '%{http_code}' -F "files=@$file;filename=$3" "$BASE$2"
  rm -f "$file"
}
[ "$(upload 7 /api/Transaction/Import statement.csv)" = 413 ] || fail "a 7 MB statement got past nginx (6 MB limit)"

# Documents take up to 100 MB in one upload: a 20 MB PDF reaches the API, 101 MB does not.
[ "$(upload 20 /api/documents scan.pdf)" != 413 ] || fail "a 20 MB document was rejected by nginx (413)"
[ "$(upload 101 /api/documents scan.pdf)" = 413 ] || fail "a 101 MB document got past nginx (100 MB limit)"

echo "Smoke test passed ($BASE)"
