# Deploying LemonAId

LemonAId is one static HTML file. It needs a web server that can serve a file over HTTPS and nothing
else: no runtime, no database, no API. That is the whole security model, and the deployment keeps it.

## The situation on the Serrano Lab droplet

The droplet runs EpiFlow D3 (`/opt/epiflow-d3`) with Docker Compose. Its nginx runs inside a container
and owns ports 80 and 443 for `epiflow.serranolab.org`. Anything else that wants port 443 on that
machine has to go through that container. There are two honest ways to add LemonAId.

### Option A. Second server block inside EpiFlow's nginx container (same droplet, no new cost)

What it takes: a second nginx conf file and a static directory mounted into the EpiFlow nginx
container, which means a two-line change to `epiflow-d3/docker-compose.yml` and a new conf under
`epiflow-d3/deploy/`, committed to the EpiFlow repository and pulled on the droplet, plus a certbot
certificate for the new name using the existing webroot.

What it costs: every LemonAId deploy touches the container that serves EpiFlow, and a mistake in the
LemonAId conf takes EpiFlow down with it. The EpiFlow repository has to carry LemonAId's configuration.

### Option B. A separate small droplet for LemonAId (recommended)

What it takes: a DigitalOcean Basic droplet (1 GB, about 6 USD a month), Ubuntu, nginx from apt,
certbot, one DNS record. Forty minutes once. The deploy script in this folder targets this layout.

What it buys: EpiFlow is never touched. LemonAId's deploy, rollback and log are its own. When a
server-side component ever exists (shared sessions), it has a home that cannot disturb EpiFlow.

Decision: Option B unless the 6 USD a month is a problem; recorded in docs/DECISIONS.md when chosen.

## Option B, step by step

Each step says who does it and what proves it worked. Do them in order; do not skip the proof.
The droplet comes before DNS because the DNS record needs the droplet's IP. Commands marked
"Mac" run in a terminal in this repository; commands marked "droplet" run after `ssh root@IP`.

0. **Local test** (Angie, on the Mac, before any server step): `brew install nginx` once, then
   `deploy/local-test.sh`. It serves the build through this folder's server blocks on ports 8080 and
   8443 with a self-signed certificate and checks the redirects, the security headers on the app file,
   the checksum and the 404. Proof: every line says PASS; the five journeys work in the browser at
   `https://localhost:8443/LemonAId.html` with no Content-Security-Policy errors in the console.
   Stop with `deploy/local-test.sh stop`.
1. **Create the droplet** (Angie, cloud.digitalocean.com). Ubuntu 24.04 LTS, Basic, Regular SSD,
   1 GB, $6 a month, SSH key authentication (not password), hostname `lemonaid`, project LemonAId. Any
   region that offers the Basic plan; on 30 October 2026 NYC3 (EpiFlow's) offered none, so NYC1 was used.
   Take the image from the OS tab: the Backups tab would clone EpiFlow and the Agents tab preselects an
   agent image. Check the Summary panel before creating. Proof (Mac): `ssh root@IP` logs in without asking for a password.
2. **DNS** (Angie, at Porkbun: the registrar and DNS host for serranolab.org, not DigitalOcean;
   `dig +short NS serranolab.org` shows `*.ns.porkbun.com`). Account, Domain Management, serranolab.org,
   DNS. Add an A record, host `lemonaid`, answer the droplet's IP, TTL 600. Leave the other records alone;
   a wildcard `*.serranolab.org` points unknown names at Porkbun's parking page, and the specific record
   takes precedence over it. Proof (Mac):
   `dig +short lemonaid.serranolab.org` returns the droplet's IP.
3. **Harden** (droplet):
   `apt update && apt upgrade -y && apt install -y nginx certbot ufw`
   `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable`
   Proof: `ufw status` lists only OpenSSH (22) and Nginx Full (80, 443), each for v4 and v6.
4. **Directories** (droplet):
   `mkdir -p /var/www/lemonaid/releases /var/www/certbot && chown -R www-data:www-data /var/www/lemonaid`
5. **nginx, port 80 only** (Mac, then droplet). Mac:
   `scp deploy/lemonaid.serranolab.org.bootstrap.conf deploy/lemonaid.serranolab.org.conf root@IP:/etc/nginx/sites-available/`
   `scp deploy/access-gated.conf.example deploy/access-open.conf root@IP:/etc/nginx/`
   Droplet: `rm /etc/nginx/sites-enabled/default && ln -s /etc/nginx/sites-available/lemonaid.serranolab.org.bootstrap.conf /etc/nginx/sites-enabled/lemonaid && nginx -t && systemctl reload nginx`
   Proof (Mac): `curl -I http://lemonaid.serranolab.org` returns `301` to https.
6. **Gate, certificate and full config** (Mac, then droplet). The gate decides who may see the site
   (see "The gate" below). Droplet:
   `cp /etc/nginx/access-gated.conf.example /etc/nginx/lemonaid-access.conf && nano /etc/nginx/lemonaid-access.conf`
   and replace `203.0.113.10` with that address. Then the certificate, in webroot mode, so certbot never
   edits the nginx files:
   `certbot certonly --webroot -w /var/www/certbot -d lemonaid.serranolab.org -m maserr@bu.edu --agree-tos -n --deploy-hook "systemctl reload nginx"`
   `ln -sfn /etc/nginx/sites-available/lemonaid.serranolab.org.conf /etc/nginx/sites-enabled/lemonaid && nginx -t && systemctl reload nginx`
   Proof: `systemctl list-timers | grep certbot` shows the renewal timer (twice a day);
   `grep -E "authenticator|webroot_path|renew_hook" /etc/letsencrypt/renewal/lemonaid.serranolab.org.conf`
   shows `webroot`, `/var/www/certbot` and the `systemctl reload nginx` hook, so a renewal is served
   without a manual reload; `certbot renew --dry-run` ends with "Congratulations, all simulated renewals
   succeeded"; (Mac) `curl -I https://lemonaid.serranolab.org` returns `302` to `/LemonAId.html`.
   Let's Encrypt no longer emails before a certificate expires, so step 8 also reads the expiry date:
   `echo | openssl s_client -connect lemonaid.serranolab.org:443 -servername lemonaid.serranolab.org 2>/dev/null | openssl x509 -noout -enddate`
   should always be 30 or more days away (certbot renews at 30 days left).
   Before the first deploy, `/LemonAId.html` itself returns 404; that is expected. Gate proof:
   `curl -sI https://lemonaid.serranolab.org/LemonAId.html` from a phone hotspot or any network outside BU
   returns `403`. The bare address returns 302 to everyone, because nginx answers a redirect before it
   checks the gate; the gate guards the files, which is everything there is to see.
7. **First deploy** (Angie, on the Mac, from a clean checkout of the tag; the first one is v0.7.2):
   `git checkout v0.7.2 && deploy/deploy.sh v0.7.2 root@lemonaid.serranolab.org`
   Proof: the script prints `ok`, the tag and the SHA-256; the same SHA-256 is in the GitHub Release;
   `deploy/DEPLOY_LOG.md` gained one line. Then `git switch main` (the log line comes along) and commit it.
8. **Hand check** (someone other than the deployer): open the URL in one browser, run the five
   journeys on the example CSV, confirm `https://lemonaid.serranolab.org/VERSION` names the tag
   and the SHA-256 in the log, and read the certificate expiry date with the openssl command in step 6.
   The app shows a hand-written "v0.7" in its sidebar, not the tag; /VERSION is the check until the
   build stamps the tag (v0.8.0, general build).

9. **Rollback drill** (once, before the beta). Needs two releases on the server, so deploy the same
   tag a second time first (a new release directory), then roll back and deploy again:
   `deploy/deploy.sh TAG root@lemonaid.serranolab.org` (second release),
   `deploy/deploy.sh --rollback root@lemonaid.serranolab.org`,
   `deploy/deploy.sh TAG root@lemonaid.serranolab.org`.
   Proof: each command prints `ok`; `curl -s https://lemonaid.serranolab.org/VERSION` names the
   release in force after each; `deploy/DEPLOY_LOG.md` gained one line per command, the rollback
   marked `ok (rollback)`. Commit the log.

## The gate

Until the open release, after Carlos's review, the site is visible only from Boston University's two
public address ranges (128.197.0.0/16 and 168.122.0.0/16, campus and BU VPN); everyone else gets 403
Forbidden. A single address is not enough: BU traffic leaves through many, and on 2 Nov 2026 a reviewer on
campus was refused until the ranges replaced the one address. A reviewer at home without VPN needs their
address added by hand (name and date in the comment), and those lines come out when the site opens. This follows the order of record (private until reviewed, then public, then the
droplet) while letting the deploy, hand check and rollback drill run on the real server.
`/etc/nginx/lemonaid-access.conf` holds the allow and deny lines and exists only on the droplet, so no
address enters the repository. Port 80 is not gated, so certificate renewal is unaffected.
`deploy/local-test.sh` checks both states: allowed (200) and closed (403, with the renewal path still open).

To open the site (a decision recorded in docs/DECISIONS.md first), on the droplet:
`cp /etc/nginx/access-open.conf /etc/nginx/lemonaid-access.conf && nginx -t && systemctl reload nginx`
Proof: `curl -I` from outside BU returns 302, then 200 for /LemonAId.html.

## What is never deployed

The registry build (`dist/*_registry.html`, `dist/*CReM*.html`) and any file under `src/data.js`.
The deploy script only ever copies `dist/LemonAId.html`, the blank build.

## Until the droplet exists

The blank build in the GitHub Release is the deployment. Anyone can download and open it.
