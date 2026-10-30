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

1. **DNS** (Angie, at the registrar for serranolab.org). Add an A record `lemonaid` pointing at the new
   droplet's IP. Proof: `dig +short lemonaid.serranolab.org` returns the IP.
2. **Create the droplet** (Angie, cloud.digitalocean.com). Ubuntu 24.04 LTS, Basic, 1 GB, SSH key
   authentication (not password), the same region as the EpiFlow droplet. Proof: `ssh root@IP` works.
3. **Harden** (Angie, on the droplet):
   `apt update && apt upgrade -y && apt install -y nginx certbot python3-certbot-nginx ufw`
   `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable`
   Proof: `ufw status` shows only 22, 80, 443.
4. **Directories** (Angie, on the droplet):
   `mkdir -p /var/www/lemonaid/releases /var/www/certbot && chown -R www-data:www-data /var/www/lemonaid`
5. **nginx** (Angie, on the droplet). Copy `deploy/lemonaid.serranolab.org.conf` to
   `/etc/nginx/sites-available/`, symlink into `sites-enabled`, remove the `default` site. Temporarily
   comment out the two `ssl_certificate` lines and the 443 block, run `nginx -t && systemctl reload nginx`.
   Proof: `curl -I http://lemonaid.serranolab.org` returns a 301.
6. **Certificate** (Angie, on the droplet): `certbot --nginx -d lemonaid.serranolab.org`. Restore the
   443 block (certbot writes the ssl lines). `nginx -t && systemctl reload nginx`.
   Proof: `curl -I https://lemonaid.serranolab.org` returns a 302 to /LemonAId.html, and
   `systemctl list-timers | grep certbot` shows the renewal timer.
7. **First deploy** (Angie, on the Mac, from a clean checkout of the tag):
   `git checkout v0.8.0 && deploy/deploy.sh v0.8.0 root@lemonaid.serranolab.org`
   Proof: the script prints `ok`, the tag and the SHA-256; the same SHA-256 is in the GitHub Release;
   `deploy/DEPLOY_LOG.md` gained one line (commit it).
8. **Hand check** (someone other than the deployer): open the URL in one browser, run the five
   journeys on the example CSV, confirm the footer shows the tag.
9. **Rollback drill** (once, before the beta): `deploy/deploy.sh --rollback root@host`, confirm the
   previous build is served, deploy again. Proof: two more lines in the log.

## What is never deployed

The registry build (`dist/*_registry.html`, `dist/*CReM*.html`) and any file under `src/data.js`.
The deploy script only ever copies `dist/LemonAId.html`, the blank build.

## Until the droplet exists

The blank build in the GitHub Release is the deployment. Anyone can download and open it.
