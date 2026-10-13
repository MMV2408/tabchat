#!/bin/bash
# Builds the snap: first the app with electron-builder, then packs it with snapcraft.
# Needed once: sudo snap install snapcraft --classic, and LXD (see README.md).
# With --stage-only only dist/snap-stage is prepared (used by GitHub Actions).
# Builds for the architecture of this machine (amd64 on a PC, arm64 on a Pi or ARM runner).
set -e
cd "$(dirname "$0")/../.."

VERSION=$(node -p "require('./package.json').version")
STAGE=dist/snap-stage

ARCH=$(dpkg --print-architecture)       # amd64 or arm64
npx electron-builder --linux dir          # -> dist/linux-unpacked or dist/linux-arm64-unpacked
UNPACKED=dist/linux-unpacked
[ "$ARCH" = "arm64" ] && UNPACKED=dist/linux-arm64-unpacked
rm -rf "$STAGE"
mkdir -p "$STAGE/snap/gui"
mkdir -p "$STAGE/src"
cp -r "$UNPACKED" "$STAGE/src/app"
sed "s/^version: .*/version: '$VERSION'/" packaging/snap/snapcraft.yaml > "$STAGE/snap/snapcraft.yaml"
# snap/gui/ = shortcut and icon for the app menu
cp packaging/snap/tabchat.desktop "$STAGE/snap/gui/"
cp assets/icon.png "$STAGE/snap/gui/tabchat.png"

# Only prepare (GitHub Actions packs the folder itself)
if [ "$1" = "--stage-only" ]; then echo "Staged: $STAGE ($ARCH)"; exit 0; fi

cd "$STAGE"
rm -f ./*.snap
snapcraft pack                            # snapcraft wants to create the snap inside this folder
mv ./*.snap "../tabchat_${VERSION}_${ARCH}.snap"
echo
echo "Done: dist/tabchat_${VERSION}_${ARCH}.snap"
