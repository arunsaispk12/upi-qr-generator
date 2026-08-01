# UPI QR Card — Fusion 360 Add-in

A native Fusion 360 command that builds a parametric raised-QR plaque
directly inside Fusion — no more `Save SVG → import → manually extrude`.
It's a from-scratch Python port of this repo's OpenSCAD generator
(`src/scad-builder.js` + `scad/scadqr_library.scad`), using Fusion's own
solid-modeling features (extrude/fillet/join/cut) instead of OpenSCAD CSG,
and Fusion's own command dialog instead of a web page — no Node.js or
browser dependency at runtime.

See the plan this was built from for the full design rationale
(`checkout-the-current-version-splendid-candle.md` in this session's plan
history) — the short version: `svg-export.js`'s 2D card layout is locked and
print-oriented, but `scad-builder.js` already defines exactly the multi-level
relief (base + raised QR + raised badge + raised label) this add-in builds,
so that's what got ported, param-for-param.

## What's in here

```
UpiQrCardAddin/
├── UpiQrCardAddin.py        entry point (run/stop)
├── UpiQrCardAddin.manifest
├── commands/
│   └── CreateQrPlateCommand.py   dialog (4 tabs: Content/Plaque/QR/Centre) + execute handler
├── core/
│   ├── qr_types.py    ported src/qr-types.js + src/upi.js + src/wifi.js (string builders)
│   ├── qr_matrix.py   wraps the vendored qrcode lib → module grid (ported src/qr-matrix.js)
│   ├── qr_union.py    ported public/svg-export.js's qrUnionPath() boundary-walk
│   └── geometry.py    all the adsk.fusion calls — base/keyring/QR layer/badge/text
├── lib/qrcode/         vendored pure-Python `qrcode` (MIT), matrix-only use — trimmed of
│                       bin/, tests/, and the PNG-rendering bits that need pypng/PIL
└── resources/          empty — drop 16x16.png/32x32.png/64x64.png here for a custom
                        toolbar icon (optional; addButtonDefinition falls back to a
                        default icon if this stays empty)
```

## Install

1. Copy (or symlink) `UpiQrCardAddin/` into:
   `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`
   (confirmed present and empty on a standard install — that's the folder
   Fusion's Add-Ins dialog scans.)
2. In Fusion: **Utilities → Add-Ins → Scripts and Add-Ins → Add-Ins tab**,
   select **UpiQrCardAddin**, click **Run**. (Check "Run on Startup" there if
   you want it to auto-load — the manifest ships with `runOnStartup: false`.)
3. A **UPI QR Card** button appears in the **Solid → Create** panel.

If Fusion doesn't pick up the hand-written `.manifest`, the safest fallback
is: use Fusion's own **Create** wizard in that same Add-Ins dialog to scaffold
a fresh add-in (guarantees a manifest your installed API version accepts),
then copy this repo's `commands/`, `core/`, `lib/` folders in and replace the
wizard's generated `.py` entry point with this repo's `UpiQrCardAddin.py`
(update the file/class names to match whatever the wizard named things).

## Using it

Click **UPI QR Card**, fill in the dialog:
- **Content** — QR mode (UPI/Website/WhatsApp/Instagram/Google Review/WiFi)
  and that mode's fields.
- **Plaque** — base size/thickness, rounded corners, keyring hole + position.
- **QR** — QR field size and raised-layer height.
- **Centre** — the centre badge + label text (or a logo, see limitations).
- **Card** — goes beyond `scad-builder.js`'s original schema (added after
  seeing a fuller reference design): an optional brand-name header raised
  above the QR (reserves a strip across the top of the card and re-centres
  the QR field in the space below it), an outer card border frame flush
  with the plate's edge, and a border frame around just the QR field. All
  off/on and sized independently — leave brand name empty and both border
  toggles off to get exactly the original bare-plaque layout.

OK builds a new component containing one solid body: base plate → (keyring
boss/hole) → (corner fillet) → (outer border) → raised QR layer → (QR
frame) → (header text) → centre badge → (badge frame) → centre label, as
separate ordinary timeline features (not a single reparametrizable Custom
Feature yet — see Follow-ups).

## How the QR geometry actually becomes a solid

The interesting part, worth understanding before touching `core/geometry.py`:
`qr_union.py` traces the QR module grid into closed boundary loops (ported
1:1 from `svg-export.js`'s `qrUnionPath()` — verified byte-identical against
the original JS for several QR strings, see Verification below). Those loops
get drawn into one Fusion sketch as plain straight lines. The problem: Fusion
decomposes a sketch into **one Profile per disjoint planar region**, not by
even-odd fill parity — so a QR finder pattern's white ring becomes its own
extractable Profile that must be *excluded*, while the black ring around it
and the black dot inside it must be *included*. `geometry.py` resolves this
by computing each loop's nesting depth directly in Python (count how many
other loops contain it — even depth = solid/dark, odd = hole/light), then
matches each Fusion Profile back to the loop that produced its outer boundary
(via the sketch line's `entityToken`) to decide whether to extrude it. This
is exercised by the depth-classification check described below — if you
change `qr_union.py`'s loop format, re-run that check before trusting new
geometry.

## Verification

Only the pure-Python pieces (`qr_types`, `qr_matrix`, `qr_union`, and the
loop-classification logic duplicated from `geometry.py`) could be tested in
this environment — Fusion's `adsk` API only exists inside Fusion itself, so
none of `geometry.py`'s or `CreateQrPlateCommand.py`'s actual API calls have
been run yet. Method/property names there were checked against Autodesk's
current API docs (not just recalled from memory), but **the in-app smoke
test below is still required** before trusting this on a real print.

Already done, this session:
1. **String-builder parity** — `qr_types.py`'s UPI/WiFi builders produce
   byte-identical output to `src/upi.js`/`src/wifi.js` on inputs with
   special characters (apostrophes, `é`, `&`, `#`, WiFi escape chars).
2. **Matrix parity** — `qr_matrix.py` (vendored `qrcode` lib, `border=0`)
   matched `src/qr-matrix.js`'s `getQrMatrix()` byte-for-byte on a first
   test string. On other strings the two libraries picked *different QR
   mask patterns* (both spec-compliant — mask selection is a heuristic, and
   forcing the same `mask_pattern` on both sides reproduced an exact match).
   This is expected and harmless: nothing here needs cross-tool byte parity,
   only that each is internally a valid, scannable QR code.
3. **Union-loop ground truth** — independently re-derived, for every grid
   cell across several QR strings (including a centre-logo cutout), whether
   it should be dark from `qr_union_loops()`'s output alone (point-in-polygon
   parity counting against all loops) and compared against the source
   matrix: zero mismatches.
4. **Loop dark/light classification** (the exact logic in `geometry.py`'s
   `_loops_are_dark`) — verified per-loop against the source matrix using a
   geometrically robust interior-point probe (0.5 grid units in from an
   edge midpoint, guaranteed not to overshoot into a nested region): zero
   mismatches, including 3-level-nested finder-pattern loops.

Still to do, in the actual app:
5. **In-Fusion smoke test** — run the command with default UPI values,
   confirm the timeline shows base extrude → fillet → (keyring join/cut) →
   QR join extrude → badge join → text join, and the result is a single
   manifold solid body (Inspect, or just export STL and check for errors).
6. **Scannability** — export STL, render/screenshot the top view, scan with
   a phone to confirm it still decodes to the intended string — same bar the
   existing Node test gate (`jsQR`, see `test/`) holds the browser relief to.

## Known limitations / follow-ups

- No Custom Feature API yet — the plaque is a fixed sequence of ordinary
  timeline features, not one reparametrizable feature you can double-click
  and re-edit as a whole.
- Centre logo: vector SVG only (raster PNG/JPG isn't converted to relief —
  that's a much bigger feature, see the browser's k-means/d3-contour relief
  in `qr3d.js`/`relief.js` for what that would take). The Centre tab has a
  "Browse for logo SVG..." button (`ui.createFileDialog()`, filtered to
  `*.svg`) that fills in a path field; geometry.py fit-scales it into the
  badge footprint from the SVG's own viewBox/width/height (best-effort regex
  parse, same idea as svg-export.js's `nestSvg()`) and extrudes it in place
  of the text label when set.
- No color — matches `scad-builder.js`, which also hardcodes base/QR/label
  colors rather than exposing them as parameters.
- `fontName` is a small fixed dropdown (Arial/Arial Black/Calibri/Verdana/
  Times New Roman) rather than every installed font, since there's no simple
  API call to enumerate installed system fonts from a command dialog.
- Multi-color badge/logo relief (the browser's `three.js` relief flattens
  badges to ~4 colors via k-means) has no equivalent here yet.
