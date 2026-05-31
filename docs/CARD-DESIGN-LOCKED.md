# Card Image Design — LOCKED (final)

**Status:** FINAL — the 2D card image design is locked as of this document.
Do not change layout proportions, section positions, or sizing without an
explicit request. The reference is `bhuvis_qr.png` / `bhuvi_qr.png`.

## Canvas
- One universal layout for **all 6 QR types** (UPI, URL, WhatsApp, Instagram,
  Google Review, WiFi), rendered by `buildUpiCard` in `public/app.js` driven by
  `CARD_CFG` (per-type action text + info pill; payment badges UPI-only).
- Logical `W=500 × H=1100`, margin `M=12`, retina `SC=2` → output **1048×2248**
  (5"×11" @ 100px/in × 2). Real-print scale ≈ 0.254 mm per logical px (~285mm
  plaque long edge by default).

## Locked section bands (top → bottom)
| Section | Position (locked) |
|---|---|
| Card border | brand-colour, 7px, top + sides down to footer (footer excluded) |
| Header band | `M+22` → `qbY-12`; emblem **top-anchored** when a logo is uploaded |
| Emblem (logo) | dynamic height — fills the band left after the text, cap 360; never overflows the QR |
| Brand name | 900 weight, 1 line (≤32px) or auto-wrap to 2 lines |
| Tagline | 800 / 18px, full opacity, flanking lines |
| Action (SCAN …) | 800 / 21px, flanking lines |
| QR box | **LOCKED** `QS=410` (field 430) at `qbX=M+(W-qbSz)/2, qbY=M+466`; white field + 7px brand-colour frame at a 4px gap; centre logo (circle/square) |
| Below block (pill [+ badges]) | centred in the gap between QR and footer |
| Info pill | 900 / 25px, height 46, dark-on-light / white-on-dark |
| Payment badges (UPI) | real logos, 48px pills |
| Footer | filled brand-colour band, 56px; SECURE \| FAST \| RELIABLE, 800/14 + tinted icons |

**Invariant:** the QR top is fixed regardless of logo presence or brand-name
length (verified identical across all 6 types). The emblem grows/shrinks to fill
the header; it can never push into the QR.

## Print readiness (0.4mm nozzle)
All text uses heavy weights at sizes whose stroke widths exceed the 0.4mm nozzle
minimum at the default ~285mm plaque (smallest = "ALL UPI APPS ACCEPTED" ≈
0.46mm). Larger plaque size (3D "Plaque size" slider) adds margin.

## User options that don't break the lock
- **Embed logo in QR centre** toggle (default on); empty reserved centre if no logo.
- **Logo shape** circle / square.
- **Vertically centre header** toggle (for no-logo cards).
- Colours: `primaryColor` (frame/pill/footer), `bgColor`, `qrColor` — all adapt.

## Assets (`public/logos/`)
- Payment: `gpay/phonepe/paytm` (.png card + .svg for 3D).
- Service centre/top logos: `whatsapp/instagram/google/wifi/url` (.png + .svg).
- Trust icons: `trust-secure/fast/reliable.png` (tinted at render; SVG to come).
