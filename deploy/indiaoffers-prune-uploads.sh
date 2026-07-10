#!/bin/bash
# Monthly: move orphaned admin uploads (files in public/uploads no DB row
# references) into a dated backup folder. Runs from /etc/cron.d on the VPS;
# install: cp to /usr/local/bin/ && chmod +x.
set -euo pipefail

UPLOADS=/var/www/indiaoffers/public/uploads
KEEP=/var/backups/indiaoffers/uploads-pruned-$(date +%Y%m%d)
SCAN=$(mktemp)
trap 'rm -f "$SCAN"' EXIT

mysqldump --single-transaction indiaoffers > "$SCAN"

moved=0
cd "$UPLOADS"
# -mtime +2: never touch files under ~3 days old — the admin may have uploaded
# them but not saved the form row yet.
while IFS= read -r f; do
  grep -qF "$f" "$SCAN" && continue
  mkdir -p "$KEEP"
  mv "$f" "$KEEP/"
  moved=$((moved+1))
done < <(find . -maxdepth 1 -type f ! -name '.gitkeep' -mtime +2 -printf '%f\n')

# drop pruned-backup folders older than ~6 months
find /var/backups/indiaoffers -maxdepth 1 -type d -name 'uploads-pruned-*' -mtime +180 -exec rm -rf {} +

echo "$(date -Is) pruned $moved orphaned upload(s)$([ $moved -gt 0 ] && echo " -> $KEEP")"
