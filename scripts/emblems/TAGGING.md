# Emblem naming and tagging

These emblems were picked for a flag editor's emblem library. People find them by typing into a search box, so every emblem needs a clear name, one category and good search tags. Someone typing "star" must find every star, including the red star with a gold border from Yugoslavia; someone typing "eagle", "bird", "lion", "communist", "islam", "sun", "tree" or "ship" must find what they mean.

Each sheet `tag/sheet-NNN.png` (from `npm run emblems:tag-sheets`) has up to 20 numbered tiles (5 columns). `tag/sheet-NNN.json` lists, per tile number `n`, the emblem `id`, the `flag` it was cut from and `flags`: up to 12 names of flags it appears on. Use the flag names to recognise what it is (the Ashoka Chakra, the Mexican eagle, the Kazakh sun and eagle, the Yugoslav star, the Albanian double-headed eagle, the cedar of Lebanon).

For every tile write:

- **name**: 2–6 words in sentence case, describing what it *is*, most specific first. Use the proper name of a famous symbol when there is one, and keep the visible description: "Ashoka Chakra wheel", "Double-headed eagle", "Red star with gold border", "Crescent and star", "Hammer and sickle", "Coat of arms of Mexico", "Maple leaf", "Sun with face", "Tudor rose". Don't put the flag's name in the name unless it is the symbol's actual name ("Coat of arms of Albania" is fine for a full achievement of arms; a plain eagle is "Black double-headed eagle").
- **category**: exactly one of
  `stars`, `sun-moon` (suns, crescents, moons, sky, planets), `animals` (mammals, reptiles, fish, mythical beasts, dragons), `birds`, `plants` (trees, leaves, flowers, wreaths, crops), `arms` (shields and full coats of arms), `seals` (round seals, badges, roundels, logos with rings), `faith` (crosses as charges, religious symbols, holy books, Star of David, dharma wheel), `crowns` (crowns, regalia, thrones), `tools` (weapons, tools, swords, spears, hammer and sickle, keys, gears), `buildings` (castles, towers, gates, landmarks, mountains, landscapes), `sea` (ships, boats, anchors, waves), `people` (human figures, heads, hands), `symbols` (geometric and abstract designs, Japanese mon and municipal logos, knots, wheels, monograms that are mostly graphic).
- **tags**: 5–12 lowercase search words. Include: the objects in it ("eagle", "shield", "crown"), broader words people would type ("bird" for an eagle, "star" for a pentagram or a sun-in-star, "animal" for a lion), notable details ("five-pointed", "double-headed", "eight-rayed", "rampant"), what it stands for when well-known ("communist", "socialist", "islam", "monarchy", "buddhism"), and one or two country or region names it's associated with. Don't tag colours (the editor recolours emblems). Avoid filler words like "emblem", "symbol", "design", "flag".
- **rank**: 1–5. How likely someone is to want it: 5 = famous/very useful (plain star, crescent and star, maple leaf, eagle, sun), 4 = strong national or historical symbols, 3 = good general clip art, 2 = niche, 1 = very niche.
- **dup**: lookalikes are placed next to each other. Set `"dup": N` on the worse copy only when it repeats the same drawing as tile N (including a recolour or rotated copy). Different drawing styles, outlines, faces, ray counts, leaf shapes or heraldic details are useful variants; keep them even when they share a name. Still name and tag duplicates. A later visual review can override a duplicate flag in `keep.json`.
- **reject**: `true` only if the tile is broken after all (a fragment, lettering only, a canton or flag, blurry), with `note` saying why. Otherwise omit.

Output one JSON file per sheet at `tag/result-NNN.json`: an array with one object per tile, in tile order:

```json
[{ "n": 1, "id": "p2281-1", "name": "Red star with gold border", "category": "stars", "tags": ["star", "five-pointed", "communist", "socialist", "yugoslavia", "partisan"], "rank": 4 }]
```

Include every tile on the sheet. Be consistent across tiles: the same kind of thing gets the same words.
