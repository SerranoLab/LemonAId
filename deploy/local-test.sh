#!/usr/bin/env bash
# Serve the blank build locally through the same nginx server blocks the droplet uses, and check
# what the droplet will be checked for. Nothing leaves the machine.
#   deploy/local-test.sh        build, start, run the checks, leave it running for a browser test
#   deploy/local-test.sh stop   stop the local server
#   CONF=<(git show 64fccd0:deploy/lemonaid.serranolab.org.conf) deploy/local-test.sh
#                               test another version of the config (this one should fail the header checks)
# Needs nginx (brew install nginx) and openssl. The only differences from the droplet: ports 8080
# and 8443 instead of 80 and 443, a one-day self-signed certificate instead of Let's Encrypt, and
# paths under a temporary folder. The server blocks themselves are the repository's, unedited.
set -euo pipefail
CONF="${CONF:-deploy/lemonaid.serranolab.org.conf}"
cd "$(dirname "$0")/.."
D="${TMPDIR:-/tmp}"; D="${D%/}/lemonaid-local"
NG() { nginx -p "$D/" -c "$D/nginx.conf" "$@"; }

if [[ "${1:-}" == "stop" ]]; then NG -s stop && echo "stopped"; exit 0; fi
command -v nginx >/dev/null || { echo "nginx not found; install it with: brew install nginx"; exit 1; }
[[ -f "$D/nginx.pid" ]] && NG -s stop 2>/dev/null && sleep 1 || true

rm -rf "$D"; mkdir -p "$D/logs" "$D/tmp" "$D/cert" "$D/certbot" "$D/www/releases/local"
node build.cjs >/dev/null
cp dist/LemonAId.html "$D/www/releases/local/"
SHA=$(shasum -a 256 dist/LemonAId.html | cut -d' ' -f1)
printf 'local %s %s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "$SHA" > "$D/www/releases/local/VERSION"
ln -sfn "$D/www/releases/local" "$D/www/current"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=lemonaid.serranolab.org" \
  -keyout "$D/cert/privkey.pem" -out "$D/cert/fullchain.pem" 2>/dev/null

sed -e 's/listen 80;/listen 8080;/' -e 's/listen 443 ssl/listen 8443 ssl/' \
    -e "s#/etc/letsencrypt/live/lemonaid.serranolab.org#$D/cert#g" \
    -e "s#/var/www/lemonaid/current#$D/www/current#" -e "s#/var/www/certbot#$D/certbot#" \
    -e "s#/etc/nginx/lemonaid-access.conf#$D/access.conf#" \
    "$CONF" > "$D/site.conf"
# The gate as it will be on the droplet, with this machine as the allowed address.
printf 'allow 127.0.0.1;\ndeny all;\n' > "$D/access.conf"
cat > "$D/nginx.conf" <<CONF
worker_processes 1;
pid $D/nginx.pid;
error_log $D/logs/error.log;
events {}
http {
    types { text/html html; text/plain txt; }
    default_type application/octet-stream;
    access_log $D/logs/access.log;
    client_body_temp_path $D/tmp/body; proxy_temp_path $D/tmp/proxy; fastcgi_temp_path $D/tmp/fastcgi;
    uwsgi_temp_path $D/tmp/uwsgi; scgi_temp_path $D/tmp/scgi;
    include $D/site.conf;
}
CONF

echo "== nginx -t"; NG -t
NG
echo "== checks"
FAIL=0
check() { if eval "$2"; then echo "PASS  $1"; else echo "FAIL  $1"; FAIL=1; fi; }
H="lemonaid.serranolab.org"; R=(--resolve "$H:8443:127.0.0.1" -k -s)
HTTP=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $H" http://127.0.0.1:8080/)
ROOT=$(curl "${R[@]}" -o /dev/null -w '%{http_code} %{redirect_url}' "https://$H:8443/")
APPH=$(curl "${R[@]}" -D - -o /dev/null "https://$H:8443/LemonAId.html" | tr -d '\r')
BODY=$(curl "${R[@]}" "https://$H:8443/LemonAId.html" | shasum -a 256 | cut -d' ' -f1)
VER=$(curl "${R[@]}" "https://$H:8443/VERSION")
MISS=$(curl "${R[@]}" -o /dev/null -w '%{http_code}' "https://$H:8443/src/data.js")
check "http redirects to https (301)"                 '[[ "$HTTP" == 301 ]]'
check "root redirects to /LemonAId.html (302)"        '[[ "$ROOT" == "302 "*"/LemonAId.html" ]]'
check "app file served (200, text/html)"              'grep -qi "^HTTP/.* 200" <<<"$APPH" && grep -qi "^content-type: text/html" <<<"$APPH"'
check "app file: Content-Security-Policy, connect-src none" 'grep -qi "^content-security-policy:.*connect-src .none." <<<"$APPH"'
check "app file: Strict-Transport-Security"           'grep -qi "^strict-transport-security:" <<<"$APPH"'
check "app file: X-Content-Type-Options nosniff"      'grep -qi "^x-content-type-options: nosniff" <<<"$APPH"'
check "app file: Referrer-Policy no-referrer"         'grep -qi "^referrer-policy: no-referrer" <<<"$APPH"'
check "app file: Cache-Control no-cache"              'grep -qi "^cache-control: no-cache" <<<"$APPH"'
check "served file matches the build (SHA-256)"       '[[ "$BODY" == "$SHA" ]]'
check "VERSION names the same SHA-256"                '[[ "$VER" == *"$SHA"* ]]'
check "anything else is 404 (src/data.js)"            '[[ "$MISS" == 404 ]]'
check "server header hides the nginx version"        'grep -qi "^server: nginx$" <<<"$APPH"'

# Close the gate to everyone, including this machine: the app must answer 403, and the
# certificate path on port 80 must still be reachable (404 here, because no challenge file exists).
printf 'deny all;\n' > "$D/access.conf"; NG -s reload; sleep 1
GATED=$(curl "${R[@]}" -o /dev/null -w '%{http_code}' "https://$H:8443/LemonAId.html")
ACME=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $H" http://127.0.0.1:8080/.well-known/acme-challenge/probe)
check "gate closed: app answers 403"                 '[[ "$GATED" == 403 ]]'
check "gate closed: renewal path still open (404, not 403)" '[[ "$ACME" == 404 ]]'
printf 'allow 127.0.0.1;\ndeny all;\n' > "$D/access.conf"; NG -s reload; sleep 1

echo
echo "SHA-256 $SHA"
echo "Browser test: https://localhost:8443/LemonAId.html (self-signed: Advanced, then Proceed)."
echo "Stop with: deploy/local-test.sh stop"
exit $FAIL
