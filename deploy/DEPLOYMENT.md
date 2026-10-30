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
   1 GB, SSH key authentication (not password), the same region as the EpiFlow droplet, hostname
   `lemonaid`. Proof (Mac): `ssh root@IP` logs in without asking for a password.
2. **DNS** (Angie, DigitalOcean Networking, Domains, serranolab.org). Add an A record, hostname
   `lemonaid`, pointing at the new droplet, TTL 3600. Proof (Mac):
   `dig +short lemonaid.serranolab.org` returns the droplet's IP.
3. **Harden** (droplet):
   `apt update && apt upgrade -y && apt install -y nginx certbot ufw`
   `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable`
   Proof: `ufw status` lists only OpenSSH (22) and Nginx Full (80, 443), each for v4 and v6.
4. **Directories** (droplet):
   `mkdir -p /var/www/lemonaid/releases /var/www/certbot && chown -R www-data:www-data /var/www/lemonaid`
5. **nginx, port 80 only** (Mac, then droplet). Mac:
   `scp deploy/lemonaid.serranolab.org.bootstrap.conf deploy/lemonaid.serranolab.org.conf root@IP:/etc/nginx/sites-available/`
   Droplet: `rm /etc/nginx/sites-enabled/default && ln -s /etc/nginx/sites-available/lemonaid.serranolab.org.bootstrap.conf /etc/nginx/sites-enabled/lemonaid && nginx -t && systemctl reload nginx`
   Proof (Mac): `curl -I http://lemonaid.serranolab.org` returns `301` to https.
6. **Certificate and full config** (droplet). Webroot mode: certbot never edits the nginx files.
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
   Before the first deploy, `/LemonAId.html` itself returns 404; that is expected.
7. **First deploy** (Angie, on the Mac, from a clean checkout of the tag):
   `git checkout v0.8.0 && deploy/deploy.sh v0.8.0 root@lemonaid.serranolab.org`
   Proof: the script prints `ok`, the tag and the SHA-256; the same SHA-256 is in the GitHub Release;
   `deploy/DEPLOY_LOG.md` gained one line (commit it).
8. **Hand check** (someone other than the deployer): open the URL in one browser, run the five
   journeys on the example CSV, confirm the footer shows the tag, and read the certificate expiry
   date with the openssl command in step 6.
9. **Rollback drill** (once, before the beta). Needs two releases on the server, so deploy the same
   tag a second time first (a new release directory), then roll back and deploy again:
   `deploy/deploy.sh TAG root@lemonaid.serranolab.org` (second release),
   `deploy/deploy.sh --rollback root@lemonaid.serranolab.org`,
   `deploy/deploy.sh TAG root@lemonaid.serranolab.org`.
   Proof: each command prints `ok`; `curl -s https://lemonaid.serranolab.org/VERSION` names the
   release in force after each; `deploy/DEPLOY_LOG.md` gained one line per command, the rollback
   marked `ok (rollback)`. Commit the log.

## What is never deployed

The registry build (`dist/*_registry.html`, `dist/*CReM*.html`) and any file under `src/data.js`.
The deploy script only ever copies `dist/LemonAId.html`, the blank build.

## Until the droplet exists

The blank build in the GitHub Release is the deployment. Anyone can download and open it.
