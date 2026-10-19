# Emblem triage

We're building the emblem library for a flag editor: clip-art emblems people drop onto their own flag designs (stars, eagles, crescents, coats of arms, suns, trees, ships, crowns, seals and so on). The candidates were cut automatically out of ~15,000 real flags, so many are junk.

Each contact sheet `triage/sheet-NNN.png` (from `npm run emblems:cluster`) has up to 64 numbered tiles (8 columns) on a grey background. `triage/sheet-NNN.json` lists, per tile number `n`, the cluster `id`, the `flag` it was cut from and how many `flags` it appears on. Open the PNG with the Read tool. The flag names help you understand what a tile is.

Score every tile:

- **0 = junk.** It is a fragment of a larger design (half an emblem, a piece of a seal, an outline ring without its contents), a stripe, border, triangle or canton offcut, a Union Jack or other complete flag/canton, lettering, words, numbers or a text ring on its own, a simple geometric shape the editor's layouts already make (rectangles, bars, plain triangles, plain discs, plain crosses that fill the flag), blurry/jagged/low-resolution/scan-artifact art, an image with a background box baked in, an empty or near-invisible tile, or a photo.
- **1 = runner-up.** Complete and usable but weak: an obscure, generic or unremarkable design; a municipal coat of arms or seal that turns into noise at small size; a very busy seal with lots of small text; an emblem that is mostly lettering with a small graphic; a slightly messy cutout.
- **2 = good.** Clean, complete, readable at small size, and something a flag designer would actually want to use.
- **3 = excellent.** An iconic or famous symbol (a national emblem, a well-known historical symbol), or an especially beautiful and versatile piece of clip art.

More rules:

- **Groups of repeated shapes** (a row, arc or ring of separate stars, a scatter of stars, three identical birds side by side) score 0 with note "group": the editor repeats a single shape itself. A famous arrangement that is one connected design is not a group.
- **Near-duplicates on the same sheet** (the same emblem slightly rotated, recoloured or re-drawn, often next to each other): score the best copy normally and every other copy 1 with note "dup of N".
- **Single letters, words, and pieces of a text ring** are 0 ("lettering"). Arabic calligraphy such as the Shahada or Takbir is a complete emblem: score it like any other.
- **Textile/pattern strips** (ornament bands, pixel patterns from a hoist stripe) are 0 ("pattern").

Be strict about 0 (when it is clearly broken or not an emblem) and generous between 1 and 2 (when in doubt about quality, 1). Plain simple stars, crescents and suns are fine: give a clean one 2. Japanese municipal symbols (mon-like stylised logos) are complete emblems; score them on how clean and distinctive they look.

Output one JSON file per sheet at `triage/result-NNN.json`: an array with one object per tile, in tile order:

```json
[{ "n": 1, "id": "p123-1", "score": 2, "note": "eagle with shield" }]
```

`note` is a few words saying what it is (for 0, why it's junk: "fragment", "lettering", "stripe offcut", "union jack", "blurry"...). Include every tile on the sheet.
