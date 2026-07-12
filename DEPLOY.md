# Deploying IndiaOffers.in

Target: **Ubuntu/Debian VPS · Node via systemd · nginx + Let's Encrypt TLS · managed MySQL.**

Artifacts live in [`deploy/`](deploy/): a systemd unit and an nginx site config. Copy‑paste the steps below.

---

## 0. Prerequisites

- A VPS (Ubuntu 22.04+/Debian 12+) with a public IP.
- DNS A/AAAA records for `indiaoffers.in` (and `www`) pointing at the VPS.
- A **managed MySQL 8** instance (host, db, user, password). Allow the VPS IP.
- Node.js 20 LTS on the VPS:
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

`.env` is gitignored — keep it that way.

## 3. Create the database schema + seed the first admin

The MySQL schema does **not** auto-apply (only SQLite does). Run it once:

```bash
# reads DB_* from .env; enter the DB password when prompted:
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < src/db/schema.mysql.sql
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

Logs: `journalctl -u indiaoffers -f`. The app now listens on `127.0.0.1:3000`.

Sanity check before wiring nginx:
```bash
curl -s localhost:3000/api/health   # → {"status":"ok","driver":"mysql"}
```

## 5. nginx reverse proxy + TLS

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/indiaoffers
sudo ln -s /etc/nginx/sites-available/indiaoffers /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Then issue the certificate (certbot rewrites the nginx file to add the 443 block
and the http→https redirect):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d indiaoffers.in -d www.indiaoffers.in
```

Visit `https://indiaoffers.in` — secure cookies and the PWA "Install" prompt now work
(both require HTTPS).

---

## Updating / redeploying

```bash
cd /var/www/indiaoffers
sudo -u indiaoffers git pull
sudo -u indiaoffers npm ci --omit=dev
# If the schema changed, re-apply the relevant statements to MySQL by hand.
sudo systemctl restart indiaoffers
```

## Operations cheatsheet

| Task | Command |
|------|---------|
| Tail logs | `journalctl -u indiaoffers -f` |
| Restart | `sudo systemctl restart indiaoffers` |
| Health | `curl -s localhost:3000/api/health` |
| Rotate JWT secret | edit `.env` → `systemctl restart` (logs everyone out) |
| Send queued alerts now | Admin → Alerts → **Send now**, or set `ALERTS_AUTO_SEND=1` |

## Notes

- **`trust proxy` is on** ([src/app.js](src/app.js)); nginx passes `X-Forwarded-Proto`
  so the app knows it's behind HTTPS and marks cookies `secure`.
- **CSP is disabled** ([src/app.js](src/app.js)) so inline handlers, the manifest and
  the service worker load. If you tighten this later, allow-list them first.
- **Backups**: Admin → Dashboard → **Download full backup** streams a `.tar.gz` with a
  full SQL data dump plus `public/uploads/` — everything not in git. The archive's
  README has restore steps; `.env` secrets are intentionally excluded and must be
  re-entered on a fresh deploy. With managed MySQL, the provider's automated backups
  are a good second layer.
