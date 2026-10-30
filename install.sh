#!/usr/bin/env bash
# Quill installer.
#
#   curl -fsSL https://raw.githubusercontent.com/IcyRelic/Quill/main/install.sh | sudo bash
#
# Asks a few questions, then installs Docker if needed, downloads Quill, builds it, starts it (with Caddy in
# front for HTTPS when asked) and makes the first admin account. Afterwards, manage it with the `quill` command.
#
# QUILL_DIR sets where it goes (default /opt/quill), for example: curl ... | sudo QUILL_DIR=/srv/docs bash
# QUILL_REPO and QUILL_BRANCH set where Quill comes from.

# Everything is inside main(), so a download cut short can't run half a script.
main() {
  set -euo pipefail

  REPO="${QUILL_REPO:-https://github.com/IcyRelic/Quill.git}"
  BRANCH="${QUILL_BRANCH:-main}"
  DIR="${QUILL_DIR:-/opt/quill}"
  LOG="/tmp/quill-install.log"

  setup_colours
  preflight
  welcome
  ask_access
  ask_account
  confirm_plan

  : >"$LOG"
  install_packages
  ensure_memory
  fetch_code
  write_config
  build_and_start
  create_accounts
  install_command
  finish
}

# ---------- output and questions ----------

setup_colours() {
  if [ -t 1 ]; then
    BOLD=$'\e[1m' DIM=$'\e[2m' RED=$'\e[31m' GREEN=$'\e[32m' YELLOW=$'\e[33m' CYAN=$'\e[36m' RESET=$'\e[0m'
  else
    BOLD="" DIM="" RED="" GREEN="" YELLOW="" CYAN="" RESET=""
  fi
}

say() { printf '%s\n' "$*"; }
step() { printf '\n%s==>%s %s%s%s\n' "$CYAN" "$RESET" "$BOLD" "$*" "$RESET"; }
done_() { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die() {
  printf '\n%sError:%s %s\n' "$RED" "$RESET" "$*" >&2
  exit 1
}

# Questions come from the terminal, not stdin: stdin is this script when it's piped from curl.
ask() { # ask VAR "Question" [default]
  local answer prompt="$2"
  [ -n "${3:-}" ] && prompt="$prompt ${DIM}[$3]${RESET}"
  printf '%s: ' "$prompt" >/dev/tty
  IFS= read -r answer </dev/tty || die "No terminal to answer questions on. Run the installer from an interactive shell."
  printf -v "$1" '%s' "${answer:-${3:-}}"
}

ask_secret() { # ask_secret VAR "Question"
  local answer
  printf '%s: ' "$2" >/dev/tty
  IFS= read -r -s answer </dev/tty || die "No terminal to answer questions on."
  printf '\n' >/dev/tty
  printf -v "$1" '%s' "$answer"
}

ask_yes() { # ask_yes "Question" y|n  -> status 0 for yes
  local answer hint="[Y/n]"
  [ "$2" = n ] && hint="[y/N]"
  printf '%s %s%s%s: ' "$1" "$DIM" "$hint" "$RESET" >/dev/tty
  IFS= read -r answer </dev/tty || die "No terminal to answer questions on."
  answer="$(printf '%s' "${answer:-$2}" | tr '[:upper:]' '[:lower:]')"
  [ "$answer" = y ] || [ "$answer" = yes ]
}

# ---------- checks ----------

preflight() {
  [ "$(uname -s)" = Linux ] || die "Quill's installer runs on Linux servers."
  [ "$(id -u)" -eq 0 ] || die "Run the installer as root, for example: curl -fsSL <installer address> | sudo bash"
  { : </dev/tty; } 2>/dev/null || die "No terminal to answer questions on. Run the installer from an interactive shell."
  if [ -f "$DIR/quill.env" ]; then
    say "Quill is already installed in $DIR."
    say ""
    say "  quill update      get the latest version"
    say "  quill user add    add an account"
    say "  quill help        everything else"
    exit 0
  fi
  OS_NAME="Linux"
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_NAME="${PRETTY_NAME:-Linux}"
  fi
  choose_names
}

# Each install is its own Docker Compose project, named after its folder, so two Quills (or a Quill set up by
# hand) on one server never share containers or content. A run that failed part way keeps the name it chose.
choose_names() {
  if [ -f "$DIR/docker-compose.yml" ]; then
    PROJECT="$(sed -n 's/^name: *//p' "$DIR/docker-compose.yml" | head -1)"
  fi
  if [ -z "${PROJECT:-}" ]; then
    PROJECT="$(basename "$DIR" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_\n-' '-' | sed 's/^[-_]*//; s/[-_]*$//')"
    [ -n "$PROJECT" ] || PROJECT=quill
    if command -v docker >/dev/null 2>&1; then
      local base="$PROJECT" n=2
      while project_taken "$PROJECT"; do
        PROJECT="$base-$n"
        n=$((n + 1))
      done
    fi
  fi
  # The quill command, unless another install already has it.
  CMD=quill
  if [ -e /usr/local/bin/quill ] && ! grep -qF "$DIR/app/scripts/quill.sh" /usr/local/bin/quill; then
    case "$PROJECT" in quill*) CMD="$PROJECT" ;; *) CMD="quill-$PROJECT" ;; esac
  fi
}

project_taken() { # project_taken NAME -> status 0 if a compose project or its content volume exists
  docker volume inspect "${1}_quill-data" >/dev/null 2>&1 && return 0
  [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$1" 2>/dev/null)" ]
}

port_in_use() { # port_in_use PORT -> prints what is listening, status 0 if busy
  if ! command -v ss >/dev/null 2>&1; then
    # No ss: see whether anything answers on the port instead.
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
    return
  fi
  local line
  line="$(ss -Hltnp "sport = :$1" 2>/dev/null | head -1)"
  [ -n "$line" ] || return 1
  printf '%s' "$line" | grep -o 'users:(("[^"]*"' | cut -d'"' -f2 || true
  return 0
}

# The address people will use. Before curl is installed, the server's own first address will do.
public_ip() {
  local ip=""
  command -v curl >/dev/null 2>&1 && ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  [ -n "$ip" ] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '%s' "$ip"
}

# ---------- the questions ----------

welcome() {
  say ""
  say "${BOLD}Quill installer${RESET}"
  say "Self-hosted docs with an admin portal and an API. Installing on $OS_NAME into $DIR."
  say "A few questions first; after that it runs by itself for a few minutes."
}

ask_access() {
  step "How will people reach Quill?"
  say "  1) My own domain, with automatic HTTPS ${DIM}(free certificate from Let's Encrypt; needs ports 80 and 443)${RESET}"
  say "  2) My own domain, behind Cloudflare ${DIM}(Cloudflare handles HTTPS; the domain's DNS record is proxied)${RESET}"
  say "  3) I have a web server or proxy on this machine ${DIM}(nginx, Apache...; Quill listens on a local port)${RESET}"
  say "  4) Just try it on this server's IP address ${DIM}(plain HTTP, no domain)${RESET}"
  local busy suggested=1
  if busy="$(port_in_use 80)" || busy="$(port_in_use 443)"; then
    warn "Port 80 or 443 is already used${busy:+ by $busy}. Option 3 puts Quill behind that instead."
    suggested=3
  fi
  while :; do
    ask MODE "Choose 1-4" "$suggested"
    case "$MODE" in 1 | 2 | 3 | 4) ;; *) warn "Type 1, 2, 3 or 4." && continue ;; esac
    if [ "$MODE" = 1 ] || [ "$MODE" = 2 ]; then
      local p bad=""
      for p in 80 443; do
        if busy="$(port_in_use "$p")"; then bad="$bad $p${busy:+ ($busy)}"; fi
      done
      if [ -n "$bad" ]; then
        warn "Option $MODE needs ports 80 and 443, but these are in use:$bad. Choose 3 to use your existing web server."
        continue
      fi
    fi
    break
  done

  DOMAIN="" PORT="" BASE_PATH=""
  if [ "$MODE" = 1 ] || [ "$MODE" = 2 ]; then
    while :; do
      ask DOMAIN "Domain for the docs, for example docs.example.com"
      DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##')"
      printf '%s' "$DOMAIN" | grep -Eq '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' && break
      warn "That doesn't look like a domain. Type just the name, such as docs.example.com."
    done
    if [ "$MODE" = 1 ]; then
      # Compared only when curl can look up the public address; a fresh server may not have it yet.
      local ip="" resolved
      command -v curl >/dev/null 2>&1 && ip="$(public_ip)"
      resolved="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')"
      if [ -z "$resolved" ]; then
        warn "$DOMAIN doesn't resolve yet. Point an A record at ${ip:-this server}; HTTPS starts working once it does."
      elif [ -n "$ip" ] && [ "$resolved" != "$ip" ]; then
        warn "$DOMAIN points at $resolved, but this server is $ip. HTTPS starts working once the A record points here."
      fi
    fi
  else
    while :; do
      ask PORT "Port for Quill" "3000"
      if ! printf '%s' "$PORT" | grep -Eq '^[0-9]+$' || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
        warn "Type a port number, such as 3000."
        continue
      fi
      if busy="$(port_in_use "$PORT")"; then
        warn "Port $PORT is in use${busy:+ by $busy}. Pick another."
        continue
      fi
      break
    done
    if [ "$MODE" = 3 ]; then
      say "Quill can live at the root of a domain, or under a path such as /docs next to another site."
      while :; do
        ask BASE_PATH "Path (leave empty for the root)" ""
        BASE_PATH="$(printf '%s' "$BASE_PATH" | sed -E 's#/+$##')"
        [ -z "$BASE_PATH" ] && break
        BASE_PATH="/${BASE_PATH#/}"
        printf '%s' "$BASE_PATH" | grep -Eq '^(/[A-Za-z0-9._-]+)+$' && break
        warn "Use letters, numbers, dots, dashes and underscores, such as /docs."
      done
    fi
  fi
}

# Whether this install's content (from a run that stopped part way) already has accounts.
has_accounts() {
  command -v docker >/dev/null 2>&1 || return 1
  local volume
  volume="$(docker volume inspect -f '{{.Mountpoint}}' "${PROJECT}_quill-data" 2>/dev/null)" || return 1
  grep -q '"username"' "$volume/content/users.json" 2>/dev/null
}

ask_account() {
  step "Your admin account"
  HAVE_ACCOUNTS=false
  if has_accounts; then
    HAVE_ACCOUNTS=true
    say "This install already has accounts from an earlier run, so you'll sign in with one of those."
    return
  fi
  say "This is who signs in to the admin portal. You can add more accounts afterwards."
  while :; do
    ask ADMIN_USER "Username" "admin"
    ADMIN_USER="$(printf '%s' "$ADMIN_USER" | tr '[:upper:]' '[:lower:]')"
    printf '%s' "$ADMIN_USER" | grep -Eq '^[a-z0-9][a-z0-9._-]{1,31}$' && break
    warn "Usernames are 2 to 32 characters: letters, numbers, dots, dashes and underscores."
  done
  ask ADMIN_NAME "Your name, shown on pages you edit" "$ADMIN_USER"
  ask_password ADMIN_PASSWORD
}

ask_password() { # ask_password VAR [indent]
  local first second
  while :; do
    ask_secret first "${2:-}Password (at least 8 characters)"
    if [ "${#first}" -lt 8 ]; then
      warn "That's ${#first} characters. Use at least 8."
      continue
    fi
    ask_secret second "${2:-}Password again"
    [ "$first" = "$second" ] && break
    warn "The passwords don't match. Try again."
  done
  printf -v "$1" '%s' "$first"
}

site_url() {
  case "$MODE" in
    1 | 2) printf 'https://%s' "$DOMAIN" ;;
    3) printf 'http://127.0.0.1:%s%s' "$PORT" "$BASE_PATH" ;;
    4) printf 'http://%s:%s' "${SERVER_IP:-$(public_ip)}" "$PORT" ;;
  esac
}

confirm_plan() {
  [ "$MODE" = 4 ] && SERVER_IP="$(public_ip)"
  step "Ready to install"
  case "$MODE" in
    1) say "  Address:  https://$DOMAIN ${DIM}(HTTPS from Let's Encrypt, through Caddy)${RESET}" ;;
    2) say "  Address:  https://$DOMAIN ${DIM}(HTTPS from Cloudflare; Caddy answers on ports 80 and 443)${RESET}" ;;
    3) say "  Address:  127.0.0.1:$PORT${BASE_PATH} ${DIM}(your web server sends visitors here)${RESET}" ;;
    4) say "  Address:  $(site_url)" ;;
  esac
  if $HAVE_ACCOUNTS; then say "  Admin:    the accounts it already has"; else say "  Admin:    $ADMIN_USER ($ADMIN_NAME)"; fi
  say "  Folder:   $DIR"
  [ "$CMD" = quill ] || say "  Command:  $CMD ${DIM}(quill is already used by another install)${RESET}"
  command -v docker >/dev/null 2>&1 || say "  Also:     installs Docker"
  ask_yes "Install now?" y || die "Nothing was installed."
}

# ---------- the install ----------

install_packages() {
  step "Installing what Quill needs"
  local missing=()
  local tool
  for tool in curl git openssl; do command -v "$tool" >/dev/null 2>&1 || missing+=("$tool"); done
  if [ "${#missing[@]}" -gt 0 ]; then
    command -v apt-get >/dev/null 2>&1 || die "Install ${missing[*]} with your package manager, then run the installer again."
    say "    Installing ${missing[*]}..."
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >>"$LOG" 2>&1
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates "${missing[@]}" >>"$LOG" 2>&1 || die "Couldn't install ${missing[*]}. See $LOG."
  fi
  if ! command -v docker >/dev/null 2>&1; then
    say "    Installing Docker (a minute or two)..."
    curl -fsSL https://get.docker.com | sh >>"$LOG" 2>&1 || die "Couldn't install Docker. See $LOG."
  fi
  if ! docker compose version >/dev/null 2>&1; then
    command -v apt-get >/dev/null 2>&1 && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-compose-plugin >>"$LOG" 2>&1 || true
    docker compose version >/dev/null 2>&1 || die "Docker is installed but the compose plugin isn't. Install docker-compose-plugin, then run the installer again."
  fi
  if ! docker info >/dev/null 2>&1; then
    systemctl enable --now docker >>"$LOG" 2>&1 || service docker start >>"$LOG" 2>&1 || true
    local i
    for i in $(seq 1 20); do docker info >/dev/null 2>&1 && break || sleep 1; done
    docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start it (systemctl start docker), then run the installer again."
  fi
  done_ "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null), $(docker compose version --short 2>/dev/null | sed 's/^v//;s/^/compose /')"
}

# Building Quill needs about 2 GB of memory. Small servers get a swap file so the build isn't killed.
ensure_memory() {
  local mem swap
  mem="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  swap="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)"
  if [ "$((mem + swap))" -lt 2000000 ] && [ ! -e /swapfile ]; then
    say "    This server has under 2 GB of memory. Adding a 2 GB swap file so the build has room..."
    if { fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048; } >>"$LOG" 2>&1 &&
      chmod 600 /swapfile && mkswap /swapfile >>"$LOG" 2>&1 && swapon /swapfile >>"$LOG" 2>&1; then
      grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
      done_ "Swap file added at /swapfile"
    else
      rm -f /swapfile
      warn "Couldn't add swap. If the build stops with \"Killed\", add memory or swap and run the installer again."
    fi
  fi
}

fetch_code() {
  step "Downloading Quill"
  mkdir -p "$DIR"
  if [ -d "$DIR/app/.git" ]; then
    git -C "$DIR/app" fetch -q --depth 1 origin "$BRANCH" >>"$LOG" 2>&1 && git -C "$DIR/app" reset -q --hard FETCH_HEAD >>"$LOG" 2>&1 || die "Couldn't update $DIR/app. See $LOG."
  else
    git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR/app" >>"$LOG" 2>&1 || die "Couldn't download Quill from $REPO. See $LOG."
  fi
  done_ "$(git -C "$DIR/app" log -1 --format='%h %s' | cut -c1-70)"
}

# Cloudflare's addresses, so Caddy trusts the X-Forwarded-Proto it sends (the visitor's https).
cloudflare_ranges() {
  local list
  list="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 2>/dev/null; echo; curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6 2>/dev/null)"
  list="$(printf '%s\n' "$list" | grep -E '^[0-9a-f.:]+/[0-9]+$' || true)"
  if [ -z "$list" ]; then
    list="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22 2400:cb00::/29 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32"
  fi
  printf '%s' "$list" | tr '\n' ' ' | sed 's/ *$//'
}

write_config() {
  step "Writing settings"
  umask 077
  if [ ! -f "$DIR/.env" ] || ! grep -q '^QUILL_SESSION_SECRET=.\{16,\}' "$DIR/.env"; then
    printf '# Signs admin sessions. Changing it signs everyone out.\nQUILL_SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >"$DIR/.env"
  fi
  umask 022

  local caddy=false
  if [ "$MODE" = 1 ] || [ "$MODE" = 2 ]; then caddy=true; fi
  {
    cat <<EOF
# Written by the Quill installer. Manage it with the \`quill\` command.
name: $PROJECT

services:
  quill:
    build:
      context: ./app
      args:
        QUILL_BASE_PATH: "$BASE_PATH"
    image: $PROJECT:local
    env_file: .env
    volumes:
      - quill-data:/data
EOF
    case "$MODE" in
      3) printf '    ports:\n      - "127.0.0.1:%s:3000"\n' "$PORT" ;;
      4) printf '    ports:\n      - "%s:3000"\n' "$PORT" ;;
    esac
    echo "    restart: unless-stopped"
    if $caddy; then
      cat <<'EOF'

  caddy:
    image: caddy:2
    depends_on: [quill]
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped
EOF
    fi
    printf '\nvolumes:\n  # Pages, settings, uploads, accounts and API keys.\n  quill-data:\n'
    if $caddy; then printf '  caddy-data:\n  caddy-config:\n'; fi
  } >"$DIR/docker-compose.yml"

  if [ "$MODE" = 1 ]; then
    cat >"$DIR/Caddyfile" <<EOF
# Written by the Quill installer. Caddy gets and renews the certificate for $DOMAIN.
$DOMAIN {
	encode gzip
	reverse_proxy quill:3000
}
EOF
  elif [ "$MODE" = 2 ]; then
    cat >"$DIR/Caddyfile" <<EOF
# Written by the Quill installer. Cloudflare handles HTTPS for visitors.
# Port 80 answers Cloudflare's "Flexible" SSL mode; port 443 (with a self-signed certificate) answers "Full".
{
	skip_install_trust
	servers {
		trusted_proxies static $(cloudflare_ranges)
	}
}

$DOMAIN {
	tls internal
	encode gzip
	reverse_proxy quill:3000
}

http://$DOMAIN {
	encode gzip
	reverse_proxy quill:3000
}
EOF
  fi

  if [ "$MODE" = 3 ]; then
    cat >"$DIR/nginx-example.conf" <<EOF
# An example for nginx: put these lines inside your site's server { } block, then reload nginx.
# Quill is built for ${BASE_PATH:-the root}, so the address is passed on unchanged. ^~ keeps the site's own
# rules for .js, .css or images from catching Quill's files.
location ^~ ${BASE_PATH:-/} {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    client_max_body_size 16m;
}
EOF
  fi

  # Becomes quill.env when the install finishes, so a failed run can simply be run again.
  cat >"$DIR/.quill.env.pending" <<EOF
# Written by the Quill installer; read by the quill command.
QUILL_MODE=$MODE
QUILL_DOMAIN=$DOMAIN
QUILL_PORT=$PORT
QUILL_BASE_PATH=$BASE_PATH
QUILL_REPO=$REPO
QUILL_BRANCH=$BRANCH
QUILL_URL=$(site_url)
EOF
  done_ "Settings in $DIR"
}

compose() { docker compose --project-directory "$DIR" -f "$DIR/docker-compose.yml" "$@"; }

build_and_start() {
  step "Building Quill"
  say "    This takes a few minutes. Progress is in $LOG."
  compose build >>"$LOG" 2>&1 || {
    tail -n 25 "$LOG" >&2
    die "The build failed. The full log is in $LOG."
  }
  done_ "Built"
  step "Starting Quill"
  compose up -d >>"$LOG" 2>&1 || {
    tail -n 25 "$LOG" >&2
    die "Quill didn't start. The full log is in $LOG."
  }
  local i ready=false
  for i in $(seq 1 60); do
    if compose exec -T quill node -e "fetch('http://127.0.0.1:3000${BASE_PATH}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 2
  done
  $ready || die "Quill started but isn't answering. See what it says with: docker compose --project-directory $DIR logs quill"
  done_ "Running"
}

add_account() { # add_account USER NAME ROLE PASSWORD
  printf '%s\n' "$4" | compose exec -T quill node quill-user.mjs add --username "$1" --name "$2" --role "$3"
}

create_accounts() {
  step "Creating accounts"
  local existing
  existing="$(compose exec -T quill node quill-user.mjs count 2>/dev/null | tr -dc '0-9')"
  if $HAVE_ACCOUNTS || [ "${existing:-0}" -gt 0 ]; then
    HAVE_ACCOUNTS=true
    done_ "Kept the accounts this install already has"
  else
    add_account "$ADMIN_USER" "$ADMIN_NAME" admin "$ADMIN_PASSWORD" >>"$LOG" 2>&1 || die "Couldn't create the admin account. See $LOG."
    done_ "Admin account: $ADMIN_USER"
  fi
  unset ADMIN_PASSWORD

  say "    Editors can change pages, navigation, the home page and files. Admins can do everything."
  while ask_yes "    Add another account?" n; do
    local user name role password out
    while :; do
      ask user "    Username"
      user="$(printf '%s' "$user" | tr '[:upper:]' '[:lower:]')"
      printf '%s' "$user" | grep -Eq '^[a-z0-9][a-z0-9._-]{1,31}$' && break
      warn "Usernames are 2 to 32 characters: letters, numbers, dots, dashes and underscores."
    done
    ask name "    Name shown on their edits" "$user"
    while :; do
      ask role "    Role (editor or admin)" "editor"
      [ "$role" = editor ] || [ "$role" = admin ] && break
      warn "Type editor or admin."
    done
    ask_password password "    "
    if out="$(add_account "$user" "$name" "$role" "$password" 2>&1)"; then
      done_ "$out"
    else
      warn "$out"
    fi
  done
}

install_command() {
  cat >"/usr/local/bin/$CMD" <<EOF
#!/bin/sh
# The Quill command for $DIR. The real script comes with Quill, so \`$CMD update\` keeps it current.
exec bash "$DIR/app/scripts/quill.sh" "\$@"
EOF
  chmod 755 "/usr/local/bin/$CMD"
  mv "$DIR/.quill.env.pending" "$DIR/quill.env"
}

finish() {
  local url
  # Asked again now that curl is surely installed: before, it may only have had a local address.
  [ "$MODE" = 2 ] || [ "$MODE" = 4 ] && SERVER_IP="$(public_ip)"
  url="$(site_url)"
  sed -i "s#^QUILL_URL=.*#QUILL_URL=$url#" "$DIR/quill.env"
  step "${GREEN}Quill is installed${RESET}"
  case "$MODE" in
    1)
      say "  Docs:   $url"
      say "  Admin:  $url/admin"
      say ""
      say "  HTTPS starts once $DOMAIN points at this server (an A record) and ports 80 and 443 are open."
      ;;
    2)
      say "  Docs:   $url"
      say "  Admin:  $url/admin"
      say ""
      say "  In Cloudflare: add an A record for $DOMAIN pointing at ${SERVER_IP:-$(public_ip)}, with the orange cloud on."
      say "  The SSL/TLS mode can be Flexible or Full."
      ;;
    3)
      say "  Quill is answering on 127.0.0.1:$PORT$BASE_PATH, for your web server only."
      say "  Send ${BASE_PATH:-your domain} to it. An nginx example is in $DIR/nginx-example.conf:"
      say ""
      sed 's/^/    /' "$DIR/nginx-example.conf" | grep -v '^    #'
      say ""
      say "  Then sign in at <your address>${BASE_PATH}/admin."
      ;;
    4)
      say "  Docs:   $url"
      say "  Admin:  $url/admin"
      say ""
      say "  This is plain HTTP: fine for trying Quill out, but use a domain with HTTPS for real use."
      ;;
  esac
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
    case "$MODE" in
      1 | 2) warn "The ufw firewall is on. Let web traffic in with: ufw allow 80,443/tcp" ;;
      4) warn "The ufw firewall is on. Let Quill's port in with: ufw allow $PORT/tcp" ;;
    esac
  fi
  say ""
  if $HAVE_ACCOUNTS; then
    say "  Sign in with your existing account. Manage Quill with the ${BOLD}$CMD${RESET} command:"
  else
    say "  Sign in as ${BOLD}$ADMIN_USER${RESET}. Manage Quill with the ${BOLD}$CMD${RESET} command:"
  fi
  printf '    %-19s %-23s %-16s %s\n' "$CMD user add" "add an account" "$CMD update" "get the latest version"
  printf '    %-19s %-23s %-16s %s\n' "$CMD user passwd" "reset a password" "$CMD logs" "see what Quill is doing"
  printf '    %-19s %-23s %-16s %s\n' "$CMD backup" "save the docs content" "$CMD help" "everything else"
  say ""
}

main "$@"
