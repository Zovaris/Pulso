#!/usr/bin/env bash
# Pulso uninstaller — remove the app, the login item and, if you say so, your data.
#
#   curl -fsSL https://raw.githubusercontent.com/Zovaris/Pulso/main/uninstall.sh | bash
#
# Options (env):
#   PULSO_APPDIR=/Applications   where the app was installed
#
# Options:
#   --all             remove the database and settings too, without asking
#   --keep-settings   keep them
#   --yes             do not ask for the final confirmation
set -euo pipefail

IDENTIFIER="com.justcallmebryan.pulso"
APP_NAME="Pulso"
APPDIR="${PULSO_APPDIR:-/Applications}"
WIPE=""
ASSUME_YES=""

for word in "$@"; do
  case "$word" in
    --all) WIPE="yes" ;;
    --keep-settings) WIPE="no" ;;
    --yes) ASSUME_YES="yes" ;;
    *) printf 'unknown option: %s\n' "$word" >&2; exit 2 ;;
  esac
done

if [[ -t 1 ]] || [[ -n "${FORCE_COLOR:-}" ]]; then
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  RED=$'\033[31m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  CYAN=$'\033[36m'
  RESET=$'\033[0m'
else
  BOLD="" DIM="" RED="" GREEN="" YELLOW="" CYAN="" RESET=""
fi

info()  { printf '%s●%s %s\n' "$CYAN" "$RESET" "$*"; }
ok()    { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
fail()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

banner() {
  printf '\n%sPulso%s %suninstaller%s\n\n' "$BOLD$CYAN" "$RESET" "$DIM" "$RESET"
}

# ── what is there ─────────────────────────────────────────────────
running() {
  pgrep -f "${APP_NAME}.app/Contents/MacOS" >/dev/null 2>&1
}

app_paths() {
  local found=()
  [[ -e "${APPDIR}/${APP_NAME}.app" ]] && found+=("${APPDIR}/${APP_NAME}.app")
  [[ -e "${HOME}/Applications/${APP_NAME}.app" ]] && found+=("${HOME}/Applications/${APP_NAME}.app")
  printf '%s\n' "${found[@]+"${found[@]}"}"
}

data_paths() {
  local found=()
  local candidates=(
    "${HOME}/Library/Application Support/${IDENTIFIER}"
    "${HOME}/Library/Caches/${IDENTIFIER}"
    "${HOME}/Library/WebKit/${IDENTIFIER}"
    "${HOME}/Library/HTTPStorages/${IDENTIFIER}"
    "${HOME}/Library/Preferences/${IDENTIFIER}.plist"
    "${HOME}/Library/Saved Application State/${IDENTIFIER}.savedState"
    "${HOME}/.config/${IDENTIFIER}"
    "${HOME}/.cache/${IDENTIFIER}"
    "${HOME}/.local/share/${IDENTIFIER}"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    [[ -e "$candidate" ]] && found+=("$candidate")
  done
  printf '%s\n' "${found[@]+"${found[@]}"}"
}

ask_about_settings() {
  if [[ -n "$WIPE" ]]; then
    return
  fi
  printf 'Also remove your projects, history and settings? [y/N] '
  local said
  read -r said </dev/tty || said=""
  case "$said" in
    y|Y|yes) WIPE="yes" ;;
    *) WIPE="no" ;;
  esac
}

erase() {
  local path="$1"
  [[ -n "$path" ]] || return 0
  rm -rf "$path"
}

# ── teardown ──────────────────────────────────────────────────────
# The login item Pulso writes when you turn on "start at login". It points at
# the binary inside the bundle, so it has to go even when you keep your data.
remove_login_item() {
  local plist="${HOME}/Library/LaunchAgents/${IDENTIFIER}.plist"
  if [[ -f "$plist" ]]; then
    info "removing the login item"
    launchctl bootout "gui/$(id -u)" "$plist" >/dev/null 2>&1 || true
    erase "$plist"
    ok "the login item is gone"
  elif launchctl print "gui/$(id -u)/${IDENTIFIER}" >/dev/null 2>&1; then
    info "unloading the login item"
    launchctl bootout "gui/$(id -u)/${IDENTIFIER}" >/dev/null 2>&1 || true
  fi
}

stop_app() {
  running || return 0
  info "quitting Pulso"
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
  local _
  for _ in 1 2 3 4 5; do
    running || break
    sleep 1
  done
  if running; then
    warn "Pulso is still up, leaving it alone. Quit it yourself and run this again."
    return 1
  fi
  ok "Pulso is not running"
}

# Homebrew keeps its own copy in the Caskroom and installs the app from there,
# so deleting the bundle by hand would leave brew thinking it is still there.
brew_managed() {
  command -v brew >/dev/null 2>&1 && brew list --cask pulso >/dev/null 2>&1
}

# ── main ──────────────────────────────────────────────────────────
main() {
  banner

  local doomed=()
  local path
  while IFS= read -r path; do
    [[ -n "$path" ]] && doomed+=("$path")
  done < <(app_paths)

  ask_about_settings

  if [[ "$WIPE" == "yes" ]]; then
    while IFS= read -r path; do
      [[ -n "$path" ]] && doomed+=("$path")
    done < <(data_paths)
  fi

  if [[ ${#doomed[@]} -eq 0 ]]; then
    info "there is nothing left to remove"
  else
    printf '\nthis will delete:\n'
    for path in "${doomed[@]}"; do
      printf '  %s\n' "$path"
    done
    printf '\n'
  fi

  if [[ -z "$ASSUME_YES" ]]; then
    printf 'type %suninstall%s to go ahead: ' "$BOLD" "$RESET"
    local said
    read -r said </dev/tty || said=""
    if [[ "$said" != "uninstall" ]]; then
      info "nothing was touched"
      exit 1
    fi
  fi

  stop_app || exit 1
  remove_login_item

  for path in "${doomed[@]+"${doomed[@]}"}"; do
    erase "$path"
  done

  if brew_managed; then
    warn "Pulso was installed with Homebrew, tell brew it is gone with:"
    printf '    %sbrew uninstall --cask pulso%s\n' "$BOLD" "$RESET"
  fi

  ok "Pulso is gone"
  if [[ "$WIPE" != "yes" ]]; then
    info "your projects and history are still in ${BOLD}~/Library/Application Support/${IDENTIFIER}${RESET}"
  fi
}

main "$@"
