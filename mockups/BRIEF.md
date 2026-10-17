# Vexilo redesign — shared mockup brief

Vexilo (vexilo.org) is a community flag encyclopedia: 15,000+ flags (countries, regions, cities, orgs, history, fiction). Features: search + tag filters, flag cards with favorite counts, Flag of the Day, contributor leaderboard, quiz, post/edit flags, Google sign-in.

## What the owner dislikes about the current UI
- Feels amateur. Glossy 2008 skeuomorphism (gradient "gel" buttons, inset wells) falls flat.
- Icons don't match (lucide + react-icons + red emoji-ish hearts + coloured Google G).
- Light and dark modes are both bland (cold blue-grey).
- Flags are shown badly: flag → inside an inset well → inside a card → name below. Box-in-box-in-box. Wildly different flag proportions (Nepal is taller than wide, Switzerland square, Qatar 11:28) get letterboxed awkwardly.

## What they want
Personality and taste. NOT ultra-minimal sleek SaaS. Skeuomorphism is allowed if it's done with taste. Vexilo is the only modern-looking flag site, so it can set the bar.

## Hard rules for every mockup
- One self-contained HTML file at `mockups/<NN>-<slug>.html` (inline <style>/<script>). Desktop canvas ~1440px wide; it must look good at 1280–1600.
- Load sample data with `<script src="./shared/flags.js"></script>` → `window.FLAGS`, `window.FLAG_IMG(code)`, `window.FOTD`, `window.DETAIL`, `window.TAGS`. Render the grid/detail from this data with a small script. Read the file first. Flag images come from flagcdn SVG URLs; that's the only external imagery allowed (no stock photos).
- **Icons: ONE family only** — Phosphor via `<script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>`, used as `<i class="ph ph-heart"></i>` (regular), `ph-light`, `ph-thin`, `ph-bold`, `ph-fill`, `ph-duotone` (e.g. `<i class="ph-duotone ph-heart"></i>`). Pick ONE weight for the whole mockup (fill allowed only for "active" states like a favorited heart). No emoji, no other icon sets. The Google sign-in button should use `ph-google-logo` in the same weight, monochrome.
- Fonts from Google Fonts only. Be deliberate: max 2–3 families.
- **Light AND dark mode**, both designed (not just inverted). A visible toggle in the header switches a class on <html>; implement via CSS custom properties. Default to light.
- Real hover states on cards and buttons (CSS).
- Flags must respect their true proportions (`ratio` in data). Never crop a flag. Thin hairline edge/shadow so white flags (Japan) don't vanish on light backgrounds.

## Page content (top to bottom)
1. **Header**: logo wordmark "Vexilo" (design a type-based wordmark fitting the direction; a tiny flag glyph is fine), nav: Browse, Quiz, Leaderboard, Donate; "Post flag" primary action; theme toggle; "Sign in".
2. **Home hero**: Flag of the Day (FOTD: Bhutan) featured prominently with its blurb, + a big search field ("Search 15,284 flags…"), + popular tag chips (TAGS) with counts. Optionally a tiny "Top contributors" strip.
3. **Browse grid**: section title + sort control (Popular / Newest / A–Z) + all 16 FLAGS as cards: flag image, name, catalogue index (#412), favorite count, and a favorite action on hover. Show the hover state on one card permanently (add a class) so it's visible in a static screenshot. Make sure Nepal (0.82), Switzerland (1.0) and Qatar (2.545) look intentional.
4. **Flag detail page preview** (separate section labelled e.g. "Flag page" with a divider): DETAIL (Canada) — big flag presentation, name, index, description, tags, colour swatches (hex), facts table, "traits" with rarity %, actions (Favorite / Edit / Report), related flags row.
5. Tiny footer.

Quality bar: this should look like a real, opinionated, shipped product by a strong designer — consistent spacing scale, type scale, radii, and one coherent icon weight. Avoid generic AI-looking gradients and purple. Avoid lorem ipsum.

Do not try to open a browser; just write the file carefully. When done, reply with a 4–6 line summary: palette (light + dark hex), fonts, icon weight, and the one signature idea of how flags are displayed.
