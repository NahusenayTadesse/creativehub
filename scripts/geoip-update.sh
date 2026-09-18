#!/usr/bin/env bash
#
# Fetches DB-IP's free "IP to Country Lite" database — what
# src/lib/server/geoip.ts reads to place signed-out readers in a country.
#
# Usage:
#   bash scripts/geoip-update.sh [target]
#
# `target` defaults to `$GEOIP_DB_PATH`, then `$FILES_DIR/geoip/…`, then the
# development `.tempFiles/geoip/…` — the same order the app resolves it in.
#
# Nothing here needs node, so it runs on the server as it is:
#   ssh digital 'bash -s -- /path/to/files/geoip/dbip-country-lite.mmdb' < scripts/geoip-update.sh
#
# DB-IP publishes a new edition at the start of each month. Run this monthly;
# the app notices the replaced file within ten minutes, with no restart. The
# file is swapped in with a rename, so a reader never sees half of one.
#
# Licensed CC BY 4.0 — the privacy page carries the credit.

set -euo pipefail

target="${1:-${GEOIP_DB_PATH:-${FILES_DIR:-.tempFiles}/geoip/dbip-country-lite.mmdb}}"
mkdir -p "$(dirname "$target")"

tmp="$(mktemp "$(dirname "$target")/.dbip-XXXXXX")"
trap 'rm -f "$tmp" "$tmp.gz"' EXIT

# This month's edition, or last month's in the first days of a month before
# the new one is up.
for month in "$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-01) -1 month" +%Y-%m)"; do
	url="https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz"
	if curl -fsSL --retry 2 -o "$tmp.gz" "$url"; then
		gunzip -c "$tmp.gz" > "$tmp"
		# A MaxMind DB ends with its metadata marker; anything else is an error
		# page or a truncated download, and must not replace a working file.
		if ! grep -aq $'\xab\xcd\xefMaxMind.com' "$tmp"; then
			echo "geoip: $url did not unpack to a MaxMind database" >&2
			exit 1
		fi
		chmod 644 "$tmp"
		mv -f "$tmp" "$target"
		echo "geoip: $month edition → $target ($(du -h "$target" | cut -f1))"
		exit 0
	fi
done

echo "geoip: no edition could be downloaded" >&2
exit 1
