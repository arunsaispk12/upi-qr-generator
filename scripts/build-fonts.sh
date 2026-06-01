#!/usr/bin/env bash
# Regenerate the outline fonts used by the pure-vector SVG export (public/svg-export.js).
#
# opentype.js outlines text → paths so CAD tools (Fusion / FreeCAD / Blender /
# OpenSCAD) can extrude it. But opentype.js can't parse some GSUB lookups Google
# fonts ship, and we don't need shaping — so we subset to Latin and DROP the
# GSUB/GPOS/GDEF layout tables, emitting small clean TTFs opentype parses fine.
#
# Requires: python -m pip install fonttools brotli
#           npm i -D @fontsource/archivo @fontsource/jetbrains-mono opentype.js
#
# Run from the repo root:  bash scripts/build-fonts.sh
set -euo pipefail

UNI="U+0020-00FF,U+2018-201F,U+2026,U+20B9,U+2022"   # Latin-1 + smart quotes, …, ₹, •
A=node_modules/@fontsource/archivo/files
J=node_modules/@fontsource/jetbrains-mono/files
mkdir -p public/fonts

subset () { # <src-woff2> <out-name>
  python -m fontTools.subset "$1" \
    --unicodes="$UNI" \
    --drop-tables+=GSUB,GPOS,GDEF \
    --no-layout-closure \
    --output-file="public/fonts/$2.ttf"
}

subset "$A/archivo-latin-700-normal.woff2"            archivo-700
subset "$A/archivo-latin-800-normal.woff2"            archivo-800
subset "$A/archivo-latin-900-normal.woff2"            archivo-900
subset "$J/jetbrains-mono-latin-800-normal.woff2"     jetbrainsmono-800

# Vendor the opentype.js UMD build for the browser (window.opentype).
cp node_modules/opentype.js/dist/opentype.min.js public/vendor/opentype.min.js

echo "Fonts + opentype vendored into public/fonts and public/vendor."
