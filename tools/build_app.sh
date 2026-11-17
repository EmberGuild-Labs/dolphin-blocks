#!/bin/bash
# Build DolphinBlocks.app and package it as a .dmg.
# Requires Xcode Command Line Tools (swiftc, hdiutil, sips, iconutil).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
APP="$BUILD/DolphinBlocks.app"
DMG="$ROOT/dist/DolphinBlocks.dmg"
APP_NAME="Dolphin Blocks"

echo "==> Refreshing embedded runtime bundle"
python3 "$ROOT/tools/bundle_runtime.py"

echo "==> Cleaning"
rm -rf "$BUILD" "$DMG"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$ROOT/dist"

echo "==> Compiling Swift wrapper"
swiftc -O \
    -o "$APP/Contents/MacOS/DolphinBlocks" \
    "$ROOT/app/main.swift" \
    -framework Cocoa -framework WebKit

echo "==> Info.plist"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>$APP_NAME</string>
    <key>CFBundleDisplayName</key><string>$APP_NAME</string>
    <key>CFBundleIdentifier</key><string>com.dolphinblocks.editor</string>
    <key>CFBundleVersion</key><string>1.0</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleExecutable</key><string>DolphinBlocks</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>LSMinimumSystemVersion</key><string>11.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSHumanReadableCopyright</key><string>Dolphin Blocks</string>
</dict>
</plist>
PLIST

echo "==> App icon"
ICON_SRC="$ROOT/app/icon.png"
if [ -f "$ICON_SRC" ]; then
    ICONSET="$BUILD/AppIcon.iconset"
    mkdir -p "$ICONSET"
    for s in 16 32 64 128 256 512 1024; do
        sips -z $s $s "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    done
    # Retina names
    cp "$ICONSET/icon_32x32.png"   "$ICONSET/icon_16x16@2x.png"
    cp "$ICONSET/icon_64x64.png"   "$ICONSET/icon_32x32@2x.png"
    cp "$ICONSET/icon_256x256.png" "$ICONSET/icon_128x128@2x.png"
    cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_256x256@2x.png"
    cp "$ICONSET/icon_1024x1024.png" "$ICONSET/icon_512x512@2x.png"
    iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
else
    echo "    (no app/icon.png — skipping icon)"
fi

echo "==> Copying editor"
cp -R "$ROOT/editor" "$APP/Contents/Resources/editor"
# The app embeds the runtime via runtime_sources.js, so the raw runtime/ copy
# that fetch() would use is not needed inside the bundle.

echo "==> Ad-hoc codesign"
codesign --force --deep --sign - "$APP" || echo "    (codesign failed; app still runs locally)"

echo "==> Building DMG"
STAGE="$BUILD/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null

echo ""
echo "Done:"
echo "  App: $APP"
echo "  DMG: $DMG"
