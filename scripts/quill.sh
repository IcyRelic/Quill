#!/usr/bin/env bash
# The `quill` command, for servers set up with install.sh. /usr/local/bin/quill runs this file.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  exec sudo bash "${BASH_SOURCE[0]}" "$@"
fi
[ -f "$DIR/quill.env" ] || {
  echo "Quill isn't set up in $DIR. Run the installer first." >&2
  exit 1
}
# shellcheck disable=SC1091
. "$DIR/quill.env"

compose() { docker compose --project-directory "$DIR" -f "$DIR/docker-compose.yml" "$@"; }

# Interactive account commands need a terminal inside the container; scripts piping a password don't.
exec_quill() {
  if [ -t 0 ] && [ -t 1 ]; then compose exec quill "$@"; else compose exec -T quill "$@"; fi
}

usage() {
  cat <<EOF
Usage: quill <command>

  status                     whether Quill is running, and its address
  update                     download the latest Quill and restart with it
  restart | stop | start     restart, stop or start Quill
  logs [-f]                  what Quill has been doing (-f keeps following)

  user add                   add an account (asks for the details)
  user list                  list accounts
  user passwd <username>     set a new password (signs them out everywhere)
  user role <username> <admin|editor>
  user remove <username>

  backup [file]              save pages, settings, uploads and accounts to a .tar.gz
  restore <file>             replace them with a backup (asks first)

Quill lives in $DIR. Its address: ${QUILL_URL:-unknown}
EOF
}

case "${1:-help}" in
  status)
    compose ps
    echo
    echo "Address: ${QUILL_URL:-unknown}"
    ;;
  update)
    echo "Downloading the latest Quill..."
    git -C "$DIR/app" fetch -q --depth 1 origin "${QUILL_BRANCH:-main}"
    before="$(git -C "$DIR/app" rev-parse HEAD)"
    git -C "$DIR/app" reset -q --hard FETCH_HEAD
    if [ "$before" = "$(git -C "$DIR/app" rev-parse HEAD)" ] && [ "${2:-}" != "--force" ]; then
      echo "Already up to date. (quill update --force rebuilds anyway.)"
      exit 0
    fi
    git -C "$DIR/app" log -1 --format='Now at %h: %s'
    echo "Building (a few minutes)..."
    compose build --pull quill
    compose up -d
    docker image prune -f >/dev/null
    echo "Updated. Your content and accounts are unchanged."
    ;;
  restart) compose restart ;;
  stop) compose stop ;;
  start) compose up -d ;;
  logs)
    shift
    compose logs --tail 200 "$@" quill
    ;;
  user)
    shift
    [ $# -gt 0 ] || set -- help
    exec_quill node quill-user.mjs "$@"
    ;;
  backup)
    file="${2:-quill-backup-$(date +%Y%m%d-%H%M%S).tar.gz}"
    case "$file" in /*) ;; *) file="$PWD/$file" ;; esac
    compose exec -T quill tar czf - -C /data content >"$file"
    echo "Saved to $file"
    ;;
  restore)
    file="${2:-}"
    [ -f "$file" ] || {
      echo "Usage: quill restore <file.tar.gz>" >&2
      exit 1
    }
    read -r -p "Replace all pages, settings, uploads and accounts with $file? Type yes: " answer </dev/tty
    [ "$answer" = yes ] || {
      echo "Nothing changed."
      exit 1
    }
    compose exec -T quill sh -c 'rm -rf /data/content.old && mv /data/content /data/content.old && tar xzf - -C /data && rm -rf /data/content.old' <"$file"
    compose restart quill
    echo "Restored from $file"
    ;;
  help | -h | --help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
