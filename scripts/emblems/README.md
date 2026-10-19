# Emblem library

The flag maker's emblems (`vexilo_flag_emblem`) are picked from the objects `scripts/parts` cut out of every flag. Picking is part script, part looking: scripts measure, merge and lay out contact sheets; the sheets are scored and named by eye (Claude, following `TRIAGE.md` and `TAGGING.md`); then a person reviews the result on a local page.

All steps take `--out <work directory>`, which holds the downloads and every decision. Keep it outside `/tmp`. The October 2026 run lives in `~/code/vexilo-emblem-work/v2`.

```sh
# 1. Download every flag part and current library emblem, render 256px thumbnails, measure them.
npm run emblems:harvest -- --out ~/code/vexilo-emblem-work/v2
# 2. Merge copies of the same emblem, drop slivers/blocks/specks, draw triage sheets.
npm run emblems:cluster -- --out ~/code/vexilo-emblem-work/v2
#    → score triage/sheet-NNN.png into triage/result-NNN.json (TRIAGE.md)
# 3. Draw naming sheets for the current library plus everything scored 2–3.
npm run emblems:tag-sheets -- --out ~/code/vexilo-emblem-work/v2
#    → name, categorise and tag tag/sheet-NNN.png into tag/result-NNN.json (TAGGING.md)
# 4. Build the review page; curation.json ({ id: reason }) holds picks to start rejected.
npm run emblems:review -- --out ~/code/vexilo-emblem-work/v2
cd ~/code/vexilo-emblem-work/v2 && python3 -m http.server 8765   # open localhost:8765/review/
```

The review page keeps decisions in the browser and downloads them as `emblem-decisions.json` (`reject`, `add`, and per-emblem `edits` of name, tags and category).

The shortlist defaults to rank 3–5, plus visually reviewed inclusions from `keep.json` (`{ id: reason }`), with a ceiling of 3,500 including the current library. `--min-rank` and `--target` adjust those limits. There is no name cap by default: different drawings of a fleur-de-lis, maple leaf or sun are welcome. Selection removes only byte-identical rendered thumbnails; the earlier clustering pass merges near-identical copies. Tagger duplicate flags can be overruled in `keep.json`; broken candidates still require their reject flag to be fixed. `curation.json` supplies suggested cuts.

The October 19 variant review is backed up in `curation/2026-10-19/`. To restore that run, copy its JSON files into the work directory before building. `duplicate-of.json` records the retained emblem ID for confirmed duplicate pairs, so the page can show the actual matching artwork. All 1,201 newly shortlisted candidates, 706 tagged runners-up and the previous duplicate comparisons were visually reviewed in this revision.

The page stores recommendations separately from user choices so rebuilding does not leave stale automatic rejection marks. `legacy-suggestions.json` records old defaults to migrate the v2 browser state. Since v2 did not distinguish default marks from clicks, marks matching old defaults become recommendations; other cuts, explicit restores, additions and edits carry forward. The original v2 state remains available through “Download previous decisions”. Exported decisions include the effective final cuts and additions, including current suggestions.

Re-running `emblems:cluster` keeps the triage sheets already drawn and only adds sheets for clusters that haven't been triaged, so earlier scores stay valid.

After approval, import the reviewed selection:

```sh
# Load the project's DATABASE_URL and S3 settings (DOTENV_CONFIG_PATH can point to another checkout's .env).
npm run emblems:import-reviewed -- --out ~/code/vexilo-emblem-work/v2 --dry-run
npm run emblems:import-reviewed -- --out ~/code/vexilo-emblem-work/v2 --apply-schema
# To apply the downloaded final decisions instead of the default recommendations:
npm run emblems:import-reviewed -- --out ~/code/vexilo-emblem-work/v2 --decisions ~/Downloads/emblem-decisions.json
```

The reviewed importer validates the full selection, backs up database rows and the approved manifest under `imports/<timestamp>/`, and prepares up to 1,024px transparent PNGs under `import-assets/`. Upload keys include the PNG content hash; `uploaded.json` checkpoints completed uploads. Source SVGs already hosted on the CDN are retained. Existing library keys lose only the `lib-` review prefix, preserving their database IDs, image URLs and remix placements. All uploads must finish before the metadata migration, upserts and archive status commit in one database transaction. `--apply-schema` applies `drizzle/0015_add_emblem_metadata.sql` inside that transaction; it can also be applied separately. Dry runs prepare files and backups but never upload or change the database.

Only approved drawings are active in the editor. Other rows are archived with `is_active = false`; their assets and remix records remain available. The editor reads descriptive names, tags, categories and ranks, searches names before tags and source flag names, and loads another 120 results automatically near the bottom of the scrolling grid. All browsing alternates categories to spread out similar subjects; searches retain relevance ranking. Imported metadata uses the `studio-emblems-v2` cache; subsequent imports appear after its one-hour expiry or invalidation of the `studio-emblems` cache tag.

`import-emblems.ts` remains available for the first library's `library.json` format.

Run the selection, geometry and search checks with `npx tsx --test scripts/emblems/import-reviewed.test.ts`.
