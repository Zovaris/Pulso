#!/usr/bin/env bash
# Pulso installer — fetch the latest release build and put it in /Applications.
#
#   curl -fsSL https://raw.githubusercontent.com/Zovaris/Pulso/main/install.sh | bash
#
# Options (env):
#   PULSO_VERSION=0.2.1          pin a version (without the leading v)
#   PULSO_APPDIR=/Applications   where Pulso.app lands
set -euo pipefail

REPO="${PULSO_REPO:-Zovaris/Pulso}"
APP_NAME="Pulso"
BASE_URL="https://github.com/${REPO}/releases"
API_URL="https://api.github.com/repos/${REPO}/releases"
APPDIR="${PULSO_APPDIR:-/Applications}"
TMP_DIR=""
MOUNTPOINT=""
STAGING=""
BACKUP=""
DEST_APP=""

# ── colors (only if tty) ──────────────────────────────────────────
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

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

cleanup() {
  if [[ -n "$BACKUP" && -e "$BACKUP" && -n "$DEST_APP" && ! -e "$DEST_APP" ]]; then
    if ! mv "$BACKUP" "$DEST_APP"; then
      warn "restore the previous copy from ${BACKUP}"
      STAGING=""
    fi
  fi
  if [[ -n "$STAGING" && -d "$STAGING" ]]; then
    rm -rf "$STAGING"
  fi
  if [[ -n "$MOUNTPOINT" ]]; then
    hdiutil detach "$MOUNTPOINT" >/dev/null 2>&1 || true
  fi
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
  return 0
}
trap cleanup EXIT

banner() {
  printf '\n%sPulso%s %sinstaller%s\n\n' "$BOLD$CYAN" "$RESET" "$DIM" "$RESET"
}

# ── platform ──────────────────────────────────────────────────────
require_macos() {
  local kernel
  kernel="$(uname -s)"
  [[ "$kernel" == "Darwin" ]] || \
    fail "Pulso is macOS only for now (this is ${kernel}). Build from source if you want to port it."
}

require_arm64() {
  local machine
  machine="$(uname -m)"
  [[ "$machine" == "arm64" ]] || fail "macOS ${machine} is not published yet (only Apple Silicon, aarch64).
  Download manually from ${BASE_URL} or build from source."
}

# ── version / download ────────────────────────────────────────────
resolve_version() {
  if [[ -n "${PULSO_VERSION:-}" ]]; then
    echo "${PULSO_VERSION#v}"
    return
  fi

  need_cmd curl
  local tag
  # Follow the /releases/latest redirect; no jq required.
  tag="$(
    curl -fsSLI -o /dev/null -w '%{url_effective}' \
      "${BASE_URL}/latest" 2>/dev/null \
      | sed -n 's|.*/tag/v\{0,1\}||p'
  )"
  if [[ -z "$tag" ]]; then
    # Fallback: GitHub API
    tag="$(
      curl -fsSL "${API_URL}/latest" \
        | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' \
        | head -n1
    )"
  fi
  [[ -n "$tag" ]] || fail "could not resolve the latest release (is the repo public?)"
  echo "$tag"
}

download() {
  local url="$1" dest="$2"
  info "downloading ${BOLD}$(basename "$dest")${RESET}"
  if ! curl -fsSL --progress-bar -o "$dest" "$url"; then
    fail "download failed: ${url}
  check that the asset exists on ${BASE_URL}/tag/v${VERSION}"
  fi
  [[ -s "$dest" ]] || fail "downloaded file is empty: $dest"
}

verify_checksum() {
  local url="$1" dest="$2"
  local sums="${dest}.sha256"
  if ! curl -fsSL -o "$sums" "${url}.sha256" 2>/dev/null; then
    warn "no checksum published for this release, skipping verification"
    return 0
  fi
  info "verifying the checksum"
  if (cd "$(dirname "$dest")" && shasum -a 256 -c "$(basename "$sums")" >/dev/null 2>&1); then
    ok "the checksum matches"
    return 0
  fi
  fail "checksum mismatch: the download may be tampered with, aborting"
}

# ── signature / quarantine ────────────────────────────────────────
# A downloaded copy carries the quarantine flag and Gatekeeper refuses it. The
# release build is ad-hoc signed (no Apple Developer account involved), and that
# signature is enough to open the app once the flag is gone: macOS offers
# "Open Anyway" in System Settings instead of calling the app damaged.
strip_quarantine() {
  local app="$1"
  command -v xattr >/dev/null 2>&1 || return 0
  xattr -cr "$app" 2>/dev/null || true
}

check_signature() {
  local app="$1"
  if codesign --verify --deep --strict "$app" >/dev/null 2>&1; then
    ok "the bundle signature checks out (ad-hoc, not notarized)"
    return 0
  fi

  fail "the bundle signature is broken, aborting instead of re-signing a damaged bundle"
}

# ── running copy ──────────────────────────────────────────────────
running() {
  pgrep -f "${APP_NAME}.app/Contents/MacOS" >/dev/null 2>&1
}

quit_running() {
  running || return 0
  info "quitting the copy that is running"
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
  local _
  for _ in 1 2 3 4 5; do
    running || break
    sleep 1
  done
  running && warn "it is still running; reopen it by hand once this finishes"
  return 0
}

# ── install ───────────────────────────────────────────────────────
install_macos() {
  local version="$1"
  local name="${APP_NAME}_${version}_aarch64.dmg"
  local dest="${TMP_DIR}/${name}"
  local mountpoint app_src device attach_out

  download "${BASE_URL}/download/v${version}/${name}" "$dest"
  verify_checksum "${BASE_URL}/download/v${version}/${name}" "$dest"

  mountpoint="$(mktemp -d "${TMP_DIR}/dmg.XXXXXX")"
  MOUNTPOINT="$mountpoint"
  info "mounting ${name}"
  attach_out="$(hdiutil attach -nobrowse -readonly -mountpoint "$mountpoint" "$dest")"
  device="$(echo "$attach_out" | awk 'NR==1{print $1}')"

  app_src="$(find "$mountpoint" -maxdepth 2 -name '*.app' -type d | head -n1)"
  if [[ -z "$app_src" ]]; then
    hdiutil detach "$mountpoint" >/dev/null 2>&1 || true
    fail "no .app found inside ${name}"
  fi

  local dest_app="${APPDIR}/${APP_NAME}.app"
  DEST_APP="$dest_app"
  check_signature "$app_src"

  mkdir -p "$APPDIR"
  STAGING="$(mktemp -d "${APPDIR}/.pulso-install.XXXXXX")"
  local staged_app="${STAGING}/${APP_NAME}.app"
  info "installing to ${BOLD}${dest_app}${RESET}"
  ditto "$app_src" "$staged_app"
  strip_quarantine "$staged_app"
  check_signature "$staged_app"

  if [[ -e "$dest_app" ]]; then
    warn "replacing the copy already in ${APPDIR}"
    quit_running
    running && fail "the current copy is still running; close it before installing"
    BACKUP="${STAGING}/${APP_NAME}.previous.app"
    mv "$dest_app" "$BACKUP"
  fi

  if ! mv "$staged_app" "$dest_app"; then
    fail "installation failed; restoring the previous copy"
  fi
  BACKUP=""

  hdiutil detach "$mountpoint" >/dev/null 2>&1 || \
    hdiutil detach "$device" >/dev/null 2>&1 || true

  printf '\n'
  ok "Pulso v${version} is in ${APPDIR}"
  info "open it with: ${BOLD}open -a ${APP_NAME}${RESET}"
  info "it lives in the menu bar, so look at the top right of the screen"
  warn "not notarized yet — the first open may ask for confirmation in"
  printf '    %sPrivacy & Security%s, or via right click > Open\n' "$BOLD" "$RESET"
  info "to remove it again: ${BOLD}./uninstall.sh${RESET}"
}

# ── main ──────────────────────────────────────────────────────────
main() {
  banner
  require_macos
  need_cmd curl
  need_cmd uname
  require_arm64

  local version
  version="$(resolve_version)"
  VERSION="$version" # used in error messages

  info "macOS arch ${BOLD}arm64${RESET}  version ${BOLD}v${version}${RESET}  appdir ${BOLD}${APPDIR}${RESET}"
  printf '\n'

  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pulso-install.XXXXXX")"

  need_cmd hdiutil
  need_cmd ditto
  install_macos "$version"

  printf '\n'
  ok "done"
  printf '\n'
}

main "$@"
