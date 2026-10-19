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
npm run emblems:review -- --out ~/code/vexilo-emblem-work/v2 --target 1500
cd ~/code/vexilo-emblem-work/v2 && python3 -m http.server 8765   # open localhost:8765/review/
```

The review page keeps decisions in the browser and downloads them as `emblem-decisions.json` (`reject`, `add`, and per-emblem `edits` of name, tags and category).

Re-running `emblems:cluster` keeps the triage sheets already drawn and only adds sheets for clusters that haven't been triaged, so earlier scores stay valid.

`import-emblems.ts` uploads a library to S3 and upserts it. It still reads the first library's `library.json` format; teaching it names, tags and categories is the step after the review.
