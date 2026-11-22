#!/bin/sh
set -eu

BASE_URL="https://github.com/andreabuttarelli/feega/releases/download/desktop-latest"
DOWNLOAD_PAGE="https://www.feega.app/download"
APP_NAME="Feega"

fail() {
  printf 'feega: %s\n' "$1" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not installed"
}

unsupported() {
  fail "unsupported system. download feega at $DOWNLOAD_PAGE"
}

install_mac() {
  need curl
  need ditto

  case "$(uname -m)" in
    arm64) arch="arm64" ;;
    x86_64) arch="x64" ;;
    *) unsupported ;;
  esac

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT INT TERM

  printf 'downloading feega for mac (%s)\n' "$arch"
  curl -fSL --progress-bar -o "$tmp/feega.zip" "$BASE_URL/$APP_NAME-mac-$arch.zip" || fail "download failed. try $DOWNLOAD_PAGE"

  ditto -x -k "$tmp/feega.zip" "$tmp" || fail "could not unzip the download"
  [ -d "$tmp/$APP_NAME.app" ] || fail "the download has no $APP_NAME.app"

  if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
    osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
    sleep 2
  fi

  target="/Applications"
  if [ ! -w "$target" ]; then
    target="$HOME/Applications"
    mkdir -p "$target"
  fi

  rm -rf "${target:?}/$APP_NAME.app"
  ditto "$tmp/$APP_NAME.app" "$target/$APP_NAME.app" || fail "could not copy $APP_NAME.app to $target"

  printf 'feega installed in %s\n' "$target"
  open "$target/$APP_NAME.app"
}

install_linux() {
  need curl

  case "$(uname -m)" in
    x86_64) ;;
    *) unsupported ;;
  esac

  bin="$HOME/.local/bin"
  mkdir -p "$bin"

  printf 'downloading feega for linux\n'
  curl -fSL --progress-bar -o "$bin/feega.part" "$BASE_URL/$APP_NAME-linux-x64.AppImage" || fail "download failed. try $DOWNLOAD_PAGE"

  chmod +x "$bin/feega.part"
  mv -f "$bin/feega.part" "$bin/feega"

  printf 'feega installed at %s/feega\n' "$bin"
}

case "$(uname -s)" in
  Darwin) install_mac ;;
  Linux) install_linux ;;
  *) unsupported ;;
esac
