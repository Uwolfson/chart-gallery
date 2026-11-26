# Porting brief — adding charts to chart-gallery

Repository: chart-gallery (git, GitHub Uwolfson/chart-gallery); all paths below are relative to its root.
You are porting a chart that already exists in an existing project page into this reusable library.

## Hard rules of the repository

1. **English only** — code, comments, labels, demo data, docs. Not a single Cyrillic character in the files you write.
2. **No brands, product names, company names, people, ticket numbers.** The demo settings are "a generic travel booking site",
   "a survey of hotel guests", "a language-learning app", "hotels A..D" — invent neutral names.
3. **Only synthetic data.** Never copy a number from a real project page. Generate demo data by formulas with a
   seeded RNG (see `rng()` in `examples/demo-data.js`) or write plausible hand-made values.
4. Do not edit `lib/charts.js`, `lib/charts.css`, `index.html`, `review.html`, `README.md`, `examples/demo-data.js`,
   `skills/`. You only ADD files in the places listed below. The lead merges them.
5. No git commands.

## Read first

- `lib/charts.js` — the style you must follow: ECharts 5 via the global `echarts`, SVG renderer through `mount()`,
  theme colours through CSS variables (`theme()` helper reads `--ck-text`, `--ck-muted`, `--ck-line`, `--ck-bg`),
  palette `ChartKit.PALETTE`, option comment block above every function, HTML charts use classes `ck-*` from
  `lib/charts.css`. The helpers `el$`, `theme`, `mount`, `mix`, `pct`, `labelWidth` are NOT exported; copy the
  few you need into your part (keep them local to your IIFE).
- `examples/demo-data.js` — how demo generators are written (`DEMO.timeline()`, `DEMO.sessions()`).
- `index.html` — how a gallery section looks (title, `.fn`, `.use` paragraph, container with height, code snippet).

## What you deliver, per chart `<name>` (camelCase function name, kebab-case file name)

1. `lib/parts/<name>.js` — an IIFE that defines the function and registers it:
   ```js
   (function (global) {
     const el$ = id => (typeof id === 'string' ? document.getElementById(id) : id);
     /** <Chart name> — one-line purpose.
      *  opts: { ... every option, with ? for optional and defaults ... }
      *  Returns ... */
     function <name>(el, o) { ... }
     global.ChartKit = global.ChartKit || {}; global.ChartKit.<name> = <name>;
   })(window);
   ```
   Any extra CSS the chart needs goes into `lib/parts/<name>.css` (class prefix `ck-<name>-`); most charts need none.
2. `examples/parts/<name>.js` — `DEMO.<name> = function () { return { ...opts ready to pass... }; }` (assume `DEMO`
   exists as a global object; create it if missing: `window.DEMO = window.DEMO || {}`).
3. `docs/parts/<name>.json` — the gallery section spec, UTF-8:
   ```json
   { "id": "<kebab-id>", "fn": "<name>", "height": 480 | null,
     "title_en": "...", "use_en": "One paragraph: use it when ...; what is encoded where; what the click does.",
     "title_ru": "...", "use_ru": "The same paragraph in Russian (ONLY this field and title_ru may be Russian).",
     "init": "JS that draws the demo into the container id 'c-<id>' using DEMO.<name>()",
     "snippet": "short illustrative call with the data shape, shown in the <pre> block",
     "skill": "3-8 line minimal working call for SKILL.md (English)" }
   ```
   `height: null` for charts that size themselves (plain HTML / canvas); otherwise the container gets that height.
4. `test/<name>.html` — a standalone page that loads `../dist/echarts.min.js`, `../lib/charts.css`, `../lib/charts.js`,
   your part, `../examples/demo-data.js`, your demo part, and runs `init`. Open it with Playwright, make sure the
   console has no errors, and save a screenshot of the chart to `docs/img/<kebab-id>.png` (width 1100 px, crop to the
   chart element). Use any Python environment with Playwright installed (`pip install playwright`, then
   `playwright install chromium`; `from playwright.sync_api import sync_playwright`; use `page.goto('file:///...')`, `page.wait_for_timeout(800)`,
   `page.locator('#c-<id>').screenshot(path=...)`). If the SVG renderer fails on screenshots, fall back to full page.

## Quality bar

- The chart must look like the original: same encodings, same interactions, same reading order. Simplify only what
  is tied to the original data.
- Options are documented in the comment block; defaults are sensible; labels are passed in by the caller
  (`valueLabel`, `xName`, ...), never hard-coded in Russian or English prose inside the library beyond defaults.
- Works from a `file://` page with no server. Light and dark theme through the CSS variables.
- Keep each part roughly the size of the comparable function in `lib/charts.js` (60–180 lines).

## Report back

List the files you created, the function signature, anything you could not reproduce from the original, and the
screenshot path. Keep it short.
