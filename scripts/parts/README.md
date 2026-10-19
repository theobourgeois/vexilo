# Cached flag parts

`npm run parts:backfill` processes SVGs. `npm run parts:raster` processes raster sources separately. Both store editor designs in `vexilo_flag_parts`; original catalogue images and user-created designs are preserved.

## Raster pilot

```sh
# Local review of 50 unprocessed flags, sampled across file extensions.
npm run parts:raster -- --limit 50 --seed 42 --report /tmp/raster-review

# Reproduce the October 19 pilot (50 explicit catalogue indices).
npm run parts:raster -- --only "$(cat scripts/parts/raster-pilot-indices.txt)" --force --report /tmp/raster-review

# Persist validated parts and review failures for that same bounded pilot.
npm run parts:raster -- --only "$(cat scripts/parts/raster-pilot-indices.txt)" --force --write --report /tmp/raster-review

npm run parts:raster:test
```

Default limit is 50. Nothing is uploaded or written to the database without `--write`. `--only` uses catalogue indices, `--force` retries current records (including review failures), and `--sources DIR` permits local source fixtures named by index, but cannot be combined with `--write`. The runner requires `DATABASE_URL`; publishing additionally uses the existing S3 variables. Every run produces `index.html`, `manifest.json`, and per-flag source/field/object/reconstruction files. Open `index.html` to compare the original, reconstruction, clean field, and transparent objects.

The pilot selected examples across PNG/JPEG/GIF/WebP file names and catalogue index ranges, including the reported American Muslim Socialists failure. It is a development sample, not an unbiased accuracy benchmark. Results are recorded in `docs/raster-pilot-results.json`: **50 processed; 25 accepted designs containing 35 objects; 25 held for review.** Two accepted designs contain only a field. All 50 records were stored; only the 25 accepted designs have extracted assets/designs enabled. No full raster backfill has been run.

## How extraction works

This is a flag-specific colour/geometry extractor, not a learned semantic segmentation model. It fits the editor's field layouts using dominant colours and agreement at the perimeter; unequal straight bands can use an inferred image field. The remainder becomes connected masks. Nearby pieces and nested shapes can be grouped; thin details are not eroded. Masks are generated once at up to 1600 pixels on the longest side, saved as transparent PNGs, and edges are unmixed from their old background. Antialias colours are excluded from editable paint slots where they are mixtures of the object and field.

A part contains its own pixels rather than a rectangle cut from the original. Removing or moving it reveals the reconstructed field. Colour that matches the local field is transparent, including holes inside a crescent or outline. This also means an intentional interior painted in the same colour as the field can become transparent; geometry alone cannot always distinguish that from a hole. Complex grouping and same-colour interiors still need visual review.

Every candidate design is reconstructed and compared against the source. Gates reject more than 1.5% of pixels differing by RGB distance 64, mean error above 4%, unreliable/texture-heavy fields, broad objects spanning field edges, too many fragments, nonrectangular transparency, animated/multipage sources, excessive source pixels/bytes, and unsupported dimensions. Reconstruction checks appearance, not semantic grouping. Unusual geometry, photographs, scans, low-contrast emblems, and complex coats of arms may need a model-assisted or manual pass.

## Cache and fallback

Raster versioning is independent of SVG versioning. Assets use `flags/raster-parts/{index}/{sourceHash12}-r{version}/...` with immutable caching. A row is current when its image URL and raster version match. Use `--force` to detect changed bytes at the same URL or retry held sources; bump `RASTER_VERSION` when changing mask pixels. Publishing always fetches the catalogue's current URL.

The editor uses the cached design immediately. A current raster record held for review opens as the original image field, with its original aspect ratio, rather than retrying the older live cutout. Existing user drafts remain intact; use Reset to load newly cached parts for a flag with an older draft. SVG failures retain their existing fallback behavior.

The pilot was checked in the production editor: Honduras stars move independently; the American Muslim Socialists emblem moves/deletes without carrying green or leaving a hole, and its star recolours without changing the stripes; Box Elder County opens as the unsplit original. Tests cover separate stars, a one-pixel beam, compressed crescent/star extraction without the field, palette edge blends, and transparent-source rejection.
