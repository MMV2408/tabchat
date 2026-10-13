#!/bin/bash
# Builds the native helper (helper/, Rust) into helper/dist/<arch>/tabchat-helper.
# electron-builder puts it next to the app (resources/helper/), see "extraResources" in package.json.
# With cargo-zigbuild installed: x64 and arm64 (Raspberry Pi) from one PC, for glibc 2.28 and newer.
# Without it: only for the architecture of this machine (used on the GitHub runners for the snap).
set -e
cd "$(dirname "$0")/../helper"

if ! command -v cargo >/dev/null; then
  echo "Rust (cargo) not found. Install it with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

put() { # $1 = built file, $2 = electron-builder arch (x64 or arm64)
  mkdir -p "dist/$2"
  cp "$1" "dist/$2/tabchat-helper"
  echo "helper: dist/$2/tabchat-helper ($(du -h "$1" | cut -f1))"
}

if cargo zigbuild --help >/dev/null 2>&1; then
  if command -v rustup >/dev/null && ! rustup target list --installed | grep -q aarch64-unknown-linux-gnu; then
    echo "The ARM64 target is missing. Add it with: rustup target add aarch64-unknown-linux-gnu"
    exit 1
  fi
  cargo zigbuild --release --target x86_64-unknown-linux-gnu.2.28
  cargo zigbuild --release --target aarch64-unknown-linux-gnu.2.28
  put target/x86_64-unknown-linux-gnu/release/tabchat-helper x64
  put target/aarch64-unknown-linux-gnu/release/tabchat-helper arm64
else
  cargo build --release
  case "$(uname -m)" in
    x86_64) put target/release/tabchat-helper x64 ;;
    aarch64) put target/release/tabchat-helper arm64 ;;
    *) echo "Unknown architecture $(uname -m)"; exit 1 ;;
  esac
fi
