#!/bin/bash
# Bouwt de snap: eerst de app met electron-builder, dan inpakken met snapcraft.
# Nodig (eenmalig): sudo snap install snapcraft --classic, en LXD (zie README.md).
# Met --stage-only wordt alleen dist/snap-stage klaargezet (gebruikt door GitHub Actions).
set -e
cd "$(dirname "$0")/../.."

VERSION=$(node -p "require('./package.json').version")
STAGE=dist/snap-stage

npx electron-builder --linux dir          # -> dist/linux-unpacked
rm -rf "$STAGE"
mkdir -p "$STAGE/snap/gui"
mkdir -p "$STAGE/src"
cp -r dist/linux-unpacked "$STAGE/src/app"
sed "s/^version: .*/version: '$VERSION'/" packaging/snap/snapcraft.yaml > "$STAGE/snap/snapcraft.yaml"
# snap/gui/ = snelkoppeling en icoon voor het app-menu
cp packaging/snap/tabchat.desktop "$STAGE/snap/gui/"
cp assets/icon.png "$STAGE/snap/gui/tabchat.png"

# Alleen klaarzetten (GitHub Actions pakt de map daarna zelf in)
if [ "$1" = "--stage-only" ]; then echo "Klaargezet: $STAGE"; exit 0; fi

cd "$STAGE"
rm -f ./*.snap
snapcraft pack                            # snapcraft wil de snap binnen deze map maken
mv ./*.snap "../tabchat_${VERSION}_amd64.snap"
echo
echo "Klaar: dist/tabchat_${VERSION}_amd64.snap"
