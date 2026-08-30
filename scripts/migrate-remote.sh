#!/usr/bin/env bash
#
# Applies pending migrations to the server's database, through an SSH tunnel.
#
#   npm run db:migrate:remote            # dry run — says what would happen
#   npm run db:migrate:remote -- --apply # back up, then apply
#
#   npm run db:migrate:remote -- --baseline-through <tag> --apply
#
# The last form is for a migration whose effects are already in the database
# because somebody applied its SQL by hand. It records that migration as done
# *without running it*, which is the only way past a `CREATE TABLE` for a table
# that already exists. Check first that the database really does match the
# migration you are skipping: recording one whose changes are not actually there
# leaves a schema that silently disagrees with the code, and no later migration
# will notice.
#
# The scripts in this directory cannot run on the server: the deploy ships only
# `build/` and there is no `npm install` there. So the tunnel exists to run the
# *tested* code path — `scripts/migrate.ts`, the same one the local database
# takes — against production, rather than hand-writing SQL that nothing covers.
#
# Two gotchas are baked in below. The control-socket path has to be short, since
# a Unix socket path is capped at 108 bytes and a scratch directory blows past
# it; and the password out of `.env` is URL-encoded before going into a
# connection string, because a `@` or `/` in it silently truncates the host.
#
# `--apply` takes a `mariadb-dump` first. Restoring is
# `mariadb --skip-ssl -u<user> -p<pw> creator < <dump>` on the server — note the
# `--skip-ssl`, which the CLI needs through the tunnel and mysql2 does not.
set -euo pipefail

HOST="${DEPLOY_HOST:-digital}"
APP="${DEPLOY_PATH:-/home/admin/apps/creator-network}"
DUMPS="${DEPLOY_DUMPS:-/home/admin/apps/creator-network-deploy}"
SOCKET="$HOME/.ssh/ctl-migrate-$$"
PORT="${TUNNEL_PORT:-13307}"

APPLY=0
BASELINE=""
while [ $# -gt 0 ]; do
	case "$1" in
	--apply) APPLY=1 ;;
	--baseline-through)
		shift
		BASELINE="${1:-}"
		[ -n "$BASELINE" ] || {
			echo "--baseline-through needs a migration tag" >&2
			exit 2
		}
		;;
	*)
		echo "unknown option: $1" >&2
		exit 2
		;;
	esac
	shift
done

say() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }

cleanup() { ssh -S "$SOCKET" -O exit "$HOST" >/dev/null 2>&1 || true; }
trap cleanup EXIT

say "Opening a tunnel to $HOST"
ssh -f -N -M -S "$SOCKET" -L "$PORT:127.0.0.1:3306" "$HOST"
echo "   127.0.0.1:$PORT → $HOST:3306"

DB_USER="$(ssh -S "$SOCKET" "$HOST" "grep '^DATABASE_URL' '$APP/.env' | sed 's|.*mysql://||;s|:.*||'")"
DB_PASS="$(ssh -S "$SOCKET" "$HOST" "grep '^DATABASE_URL' '$APP/.env' | sed 's|.*mysql://[^:]*:||;s|@.*||'")"
DB_ENC="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$DB_PASS")"
export DATABASE_URL="mysql://$DB_USER:$DB_ENC@127.0.0.1:$PORT/creator"

say "What the server has now"
npx tsx scripts/migration-status.mjs

if [ "$APPLY" != 1 ]; then
	say "Dry run — nothing was changed"
	echo "   Re-run with --apply to back up and migrate."
	exit 0
fi

say "Backing up first"
TS="$(date +%Y%m%d-%H%M%S)"
ssh -S "$SOCKET" "$HOST" "mkdir -p '$DUMPS' && mariadb-dump --skip-ssl -u'$DB_USER' -p'$DB_PASS' creator > '$DUMPS/creator-before-migrate-$TS.sql'"
ssh -S "$SOCKET" "$HOST" "ls -lh '$DUMPS/creator-before-migrate-$TS.sql'"

if [ -n "$BASELINE" ]; then
	say "Recording migrations through $BASELINE as applied, without running them"
	npx tsx scripts/baseline.ts "$BASELINE"
fi

say "Applying"
npx tsx scripts/migrate.ts

say "Done"
echo "   Rollback: ssh $HOST \"mariadb --skip-ssl -u$DB_USER -p'<password>' creator < $DUMPS/creator-before-migrate-$TS.sql\""
echo "   The app reads the database live — no restart needed."
