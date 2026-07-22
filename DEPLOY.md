# Deploying IndiaOffers.in

Target: **Ubuntu/Debian VPS · Node 20 via systemd · MySQL 8 · reverse proxy with automatic TLS.**

Artifacts live in [`deploy/`](deploy/): a systemd unit, an nginx site config, and the
monthly uploads-prune script. Copy-paste the steps below.

> **How production actually runs (verified 22 July 2026).** `indiaoffers.in` lives on a
> **shared** VPS (`161.97.97.34`) alongside other projects, so two things differ from a
> greenfield install:
>
> - **MySQL 8 runs on the same host** (`127.0.0.1:3306`), not a managed instance.
> - **TLS/proxying is handled by an existing Caddy container**, not the nginx config in
>   [`deploy/nginx.conf`](deploy/nginx.conf). See [§5](#5-reverse-proxy--tls).
>
> Everything else — the systemd unit, the `.env`, the schema step — is exactly as written
> here. The deployed unit and [`deploy/indiaoffers.service`](deploy/indiaoffers.service)
> are identical.
>
> Server-wide operations across *all* the sites on that box (Caddy routing, disk cleanup,
> package upgrades) are documented separately in `~/workspace/VPS-GUIDE.md`.

---

## 0. Prerequisites

- A VPS (Ubuntu 22.04+/Debian 12+) with a public IP.
- DNS A/AAAA records for `indiaoffers.in` (and `www`) pointing at the VPS.
- **MySQL 8** — either on the host (what production uses) or a managed instance:
  ```bash
  sudo apt-get install -y mysql-server        # host install
  ```
  For a managed instance instead, note the host/db/user/password and allow the VPS IP.
- Node.js 20 LTS on the VPS (production runs v20.20.2):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential
  ```
  `build-essential` is only needed if `better-sqlite3` has no prebuilt binary for your
  platform — the app uses MySQL in prod, but the dependency is still compiled at install.

---

## 1. Get the code onto the server

```bash
sudo useradd --system --home /var/www/indiaoffers --shell /usr/sbin/nologin indiaoffers
sudo mkdir -p /var/www/indiaoffers
sudo chown indiaoffers:indiaoffers /var/www/indiaoffers

# as the deploy user (or clone then chown):
sudo -u indiaoffers git clone git@github.com:gaganggoyal/indiaoffers.git /var/www/indiaoffers
cd /var/www/indiaoffers
sudo -u indiaoffers npm ci --omit=dev
```

**The GitHub repo is private**, so the server authenticates with a read-only **deploy key**
at `/var/www/indiaoffers/.ssh/id_ed25519`, wired up in the repo's own git config:

```bash
git config core.sshCommand 'ssh -i /var/www/indiaoffers/.ssh/id_ed25519 -o IdentitiesOnly=yes'
```

If that ever breaks, the fallback is a bundle: `git bundle create` locally → `scp` → then
`git pull --ff-only /tmp/deploy.bundle main` as the `indiaoffers` user.

## 2. Configure the environment

```bash
sudo -u indiaoffers cp .env.example .env
sudo -u indiaoffers nano .env
```

Fill in — at minimum:

- `NODE_ENV=production`
- `SITE_URL=https://indiaoffers.in`
- `JWT_SECRET=` → `openssl rand -hex 32` (**required** — the app exits on boot if this is missing or left at the default)
- `DB_DRIVER=mysql`, `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`
- `AMAZON_ASSOCIATE_TAG=indiaoffers0c-21`
- `ADMIN_PASSWORD=` a strong password (used once by the seed)
- Optional: `GEMINI_API_KEY` (Quick Add), `SMTP_*` + `ALERTS_AUTO_SEND` (email alerts)

`.env` is gitignored — keep it that way, and `chmod 600` it.

> Production note: the DB user authenticates with `mysql_native_password` from
> `127.0.0.1`. `GEMINI_API_KEY` is deliberately left unset on the server, so Quick Add
> falls back to its rule-based parser. Mail goes out through Zoho on `smtp.zoho.com:465`
> — the `.in` host rejects this account.

## 3. Create the database schema + seed the first admin

The MySQL schema does **not** auto-apply (only SQLite does). Run it once — the file
creates the database itself, so you don't need to create it first:

```bash
# On the production box root logs in via auth_socket, so no password is needed:
sudo mysql < src/db/schema.mysql.sql

# With a managed instance, connect explicitly instead:
mysql -h <DB_HOST> -u <DB_USER> -p < src/db/schema.mysql.sql

# the seed loads .env itself (via dotenv), so no need to export anything:
sudo -u indiaoffers npm run db:seed
```

The seed is idempotent (`INSERT IGNORE`) and creates the admin
`admin@indiaoffers.in` with your `ADMIN_PASSWORD`. **Change the password after first login.**

## 4. Install the systemd service

```bash
sudo cp deploy/indiaoffers.service /etc/systemd/system/indiaoffers.service
sudo systemctl daemon-reload
sudo systemctl enable --now indiaoffers
systemctl status indiaoffers
```

Logs: `journalctl -u indiaoffers -f`. The app now listens on **port 3000 on all
interfaces** (`*:3000`) — `app.listen()` in [src/server.js](src/server.js) takes no bind
address. That is required in production so the proxy can reach it across the Docker
bridge, which means **port 3000 is not protected by its binding — the firewall is what
closes it.** See [§5](#5-reverse-proxy--tls).

Sanity check before wiring the proxy:
```bash
curl -s localhost:3000/api/health   # → {"status":"ok","driver":"mysql"}
```

## 5. Reverse proxy + TLS

Pick whichever matches your box.

### Option A — existing Caddy container (what production uses)

The shared VPS already runs a Caddy container that owns ports 80/443 and manages
certificates for every site on the box. IndiaOffers is published by appending two blocks
to `/root/cricketverse_deploy/deployment/vps/Caddyfile`:

```
www.indiaoffers.in {
    redir https://indiaoffers.in{uri} permanent
}

indiaoffers.in {
    encode gzip
    reverse_proxy 172.18.0.1:3000
}
```

`172.18.0.1` is the compose network's **bridge gateway** — how the container reaches the
host. Apply with a graceful, zero-downtime reload:

```bash
docker exec cricketverse_deploy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec cricketverse_deploy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

Because the app binds all interfaces (§4), a scoped firewall rule is what keeps port 3000
off the internet — only the Docker bridge may reach it:

```bash
sudo ufw allow from 172.16.0.0/12 to any port 3000 proto tcp comment 'indiaoffers app: docker bridge to host'
```

ufw otherwise allows only 22/80/443 publicly. **Verify with `sudo ufw status` after any
firewall change** — without that rule the site 502s; without the *scoping*, port 3000 is
world-open.

> ⚠️ **Fragility:** if that Docker network is ever recreated, the `172.18.0.1` gateway IP
> can change and silently break the proxy. Fix by updating the IP in the Caddyfile, or
> permanently by adding `host.docker.internal:host-gateway` to Caddy's compose
> `extra_hosts` and recreating the container.

### Option B — nginx + certbot (standalone box)

For a VPS where nothing else owns 80/443, use the config in [`deploy/`](deploy/):

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/indiaoffers
sudo ln -s /etc/nginx/sites-available/indiaoffers /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d indiaoffers.in -d www.indiaoffers.in
```

certbot rewrites the nginx file to add the 443 block and the http→https redirect.

Either way, visit `https://indiaoffers.in` — secure cookies and the PWA "Install" prompt
now work (both require HTTPS).

---

## Updating / redeploying

```bash
cd /var/www/indiaoffers
sudo -u indiaoffers HOME=/var/www/indiaoffers git pull
sudo -u indiaoffers HOME=/var/www/indiaoffers npm ci --omit=dev   # only if deps changed
# If the schema changed, re-apply the relevant statements to MySQL by hand.
sudo systemctl restart indiaoffers
```

> Run git as the **`indiaoffers` owner**, not root — root hits git's "dubious ownership"
> error. `HOME=` is needed too, or ssh can't find the deploy key.

## Scheduled jobs

Both scripts are installed to `/usr/local/bin/` and driven from `/etc/cron.d/`:

| Job | When | What it does |
|-----|------|--------------|
| `indiaoffers-backup.sh` | daily 03:30 | `mysqldump` → gzip into `/var/backups/indiaoffers`, keeping the **last 14** |
| [`indiaoffers-prune-uploads.sh`](deploy/indiaoffers-prune-uploads.sh) | monthly, 1st at 04:10 | Moves orphaned `public/uploads` files (no DB row references them, older than 3 days) into a dated folder; drops those folders after ~6 months |

Restore a backup with:

```bash
gunzip -c /var/backups/indiaoffers/indiaoffers-YYYYMMDD-HHMMSS.sql.gz | sudo mysql indiaoffers
```

## Operations cheatsheet

| Task | Command |
|------|---------|
| Tail logs | `journalctl -u indiaoffers -f` |
| Restart | `sudo systemctl restart indiaoffers` |
| Health | `curl -s localhost:3000/api/health` |
| Public health | `curl -s -o /dev/null -w '%{http_code}\n' https://indiaoffers.in` |
| Rotate JWT secret | edit `.env` → `systemctl restart` (logs everyone out) |
| Send queued alerts now | Admin → Alerts → **Send now**, or set `ALERTS_AUTO_SEND=1` |
| Back up now | `sudo /usr/local/bin/indiaoffers-backup.sh` |

## Notes

- **`trust proxy` is on** ([src/app.js](src/app.js)). The proxy passes `X-Forwarded-Proto`
  so the app knows it's behind HTTPS and marks cookies `secure` — Caddy's `reverse_proxy`
  sets those headers by default; the nginx config in `deploy/` sets them explicitly.
- **CSP is disabled** ([src/app.js](src/app.js)) so inline handlers, the manifest and
  the service worker load. If you tighten this later, allow-list them first.
- **Backups** come in two layers. The nightly cron above is the automatic one. On top of
  that, Admin → Dashboard → **Download full backup** streams a `.tar.gz` with a full SQL
  dump plus `public/uploads/` — everything not in git. The archive's README has restore
  steps; `.env` secrets are intentionally excluded and must be re-entered on a fresh
  deploy.
