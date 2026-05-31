# Payment badge logo guidelines (G Pay · PhonePe · Paytm)

These three logos render in the white rounded pills on the **UPI** card (the
"ALL UPI APPS ACCEPTED" row). Follow these specs so they print crisp and balanced.

## Where they go / file names

Drop the files in `public/logos/` with these exact names (drop-in replace):

| Brand   | File (current loader)        | Notes |
|---------|------------------------------|-------|
| G Pay   | `gpay.png`                   | official "G Pay" lockup |
| PhonePe | `phonepe.png`                | loader currently expects `.webp` — see note |
| Paytm   | `paytm.png`                  | official "Paytm" wordmark |

> The loader is `BADGE_EXT = { gpay:'png', phonepe:'webp', paytm:'png' }` in
> `public/app.js`. Tell me the format you supply and I'll set all three to match
> (recommend standardising on **PNG**, or **SVG** for best crispness).

## Format

- **PNG-24 with transparent background** (alpha), or **SVG** (preferred — vector
  stays sharp at any size). **Not JPG** (no transparency).
- The **official horizontal lockup** (icon + wordmark) in full brand colour.
- Must read on **white** (the app draws each on a white pill) — the official
  light-background versions are correct.

## Size / resolution

- On the exported card each badge is ~**56 px tall** (≈ 7 mm at the card's 200 DPI).
- Supply at **≥ 4×**: **height ≥ 240 px, ideally 400–512 px** for PNG. SVG = ideal.
- Keep each logo's **native aspect ratio** — the app preserves width/height and
  fits by height. Do **not** pad to a square.

## Cropping / safe area

- **Tight-crop** to the logo's bounding box; trim all surrounding transparent or
  white margin. The app adds its own padding (the pill). Baked-in margin makes
  the logo look small and uneven next to the others.

## Balance across the three

- The three pills are made **equal width** (based on the widest logo) and each
  logo is **centred**. For a balanced row, trim each lockup so the glyph
  cap-heights are visually similar.

## Trademark

Use each brand's official assets from their brand/press kits (Google Pay,
PhonePe, Paytm). Don't recolour, stretch, or alter proportions.

---

Once you drop the files in, I'll (a) align the loader extensions, (b) bump the
cache-buster (`?v=`), and (c) regenerate a card so we can confirm they're crisp.
