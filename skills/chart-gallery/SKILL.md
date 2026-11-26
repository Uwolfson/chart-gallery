---
name: chart-gallery
description: Draw report charts for survey and behavioural analysis with the chart-gallery library (window.ChartKit on Apache ECharts 5) — 26 recipes: penalty-reward map, contribution waterfall, bar with wave dots, rank bump, dumbbell, forest plot, clustered heatmap, network graph, risk map, event density, state timeline / stack / butterfly, sequence index, session anatomy, segment tree, segmentation panel, diverging and grouped bars, flow sankey, transition graph, segment map, semantic map, coverage chart, ladder, heat table. Use whenever a report, deck or HTML page needs one of these charts, when the user says "draw it like in the chart gallery", or when the task is to show what a segment means over time, how rule-based segments split, what moves a metric, or where people flow between groupings.
---

# chart-gallery — how to draw these charts

The library lives in this repository: `lib/charts.js` (exposes `window.ChartKit`), `lib/charts.css` (theme
variables and the styles of the HTML charts). Rendered examples with code: `index.html` (English) and
`review.html` (Russian, with feedback buttons). Synthetic demo data: `examples/demo-data.js`.
Read the comment block above a function in `lib/charts.js` whenever an option is unclear — it is the source of truth.

## 1. Set up the page

Copy `lib/charts.js` and `lib/charts.css` into the project (or reference them from a cloned copy of this
repository). Load ECharts 5 first; the library has no other dependency and no build step.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js"></script>
<link rel="stylesheet" href="lib/charts.css">
<script src="lib/charts.js"></script>
<div id="tree" style="height: 600px"></div>
<script>ChartKit.segmentTree('tree', { /* opts */ });</script>
```

- Every ECharts chart needs a container with an explicit height. `ladder`, `heatTable` and `sequenceIndex`
  size themselves — do not set a height on them.
- Shares and values are percentages on a 0–100 scale unless the chart says otherwise.
- For an offline, single-file deliverable inline `dist/echarts.min.js`, `lib/charts.css` and `lib/charts.js`
  into the page (that is how `dist/chart-gallery-single.html` was made).
- Theme: colours come from CSS variables `--ck-bg`, `--ck-surface`, `--ck-text`, `--ck-muted`, `--ck-line`,
  `--ck-accent`, `--ck-loss`. Override them on `:root` to match a brand; the charts follow.
  `ChartKit.PALETTE` is the default categorical palette.

## 2. Pick the chart

| Question the slide answers | Chart | Function |
|---|---|---|
| What does this segment *mean*: where are its members at each moment? | State timeline (small multiples) | `stateTimeline` |
| Where is everyone at each moment, and how big is any single state? | State stack (100% area, click to isolate a layer) | `stateStack` |
| What do the individual paths behind the aggregate look like? | Sequence index (one strip per session) | `sequenceIndex` |
| How do rule-based segments split, and what does each split add? | Segment tree | `segmentTree` |
| What moves the metric up and down? | Diverging bars | `divergingBars` |
| Compare 2–3 numbers per category (share vs outcome) | Grouped bars | `groupedBars` |
| How do three groupings connect (start → what happened → how it ended)? | Flow sankey | `flowSankey` |
| All segments on one picture: size against outcome | Segment map | `segmentMap` |
| The spine of the report: of 100 who started, N reached each step | Ladder | `ladder` |
| Describe segments by variables, highlight only real differences | Heat table | `heatTable` |

More charts (ported later):

| Question the slide answers | Chart | Function |
|---|---|---|
| Use it to show what an attribute does to a choice from both sides: x = penalty (how much a badly delivered attribute pushes people away, in percentage points), y = reward (how much a well delivered one pulls them in) | Penalty–reward map | `penaltyRewardMap` |
| Use it to explain a gap: how a group gets from a reference value (the average hotel) to its own value, one horizontal step per factor | Contribution waterfall | `contributionWaterfall` |
| One number per item has to be shown together with its stability: the bar is the effect on the full base (blue raises the outcome, orange lowers it; one colour when the measure is unsigned), the dots are the same measure in each wave, light to dark | Bar with dots | `barWithDots` |
| Use it to show whether the order of items holds from wave to wave: y = rank (1 on top), one line per item across the waves | Rank bump | `rankBump` |
| Every row has two values of the same measure to compare — before and after, in the first search and in the last, users and non-users | Dumbbell | `dumbbell` |
| Use it to show what a model says each factor does on its own, holding the rest constant: one row per coefficient, a point at the estimate and a whisker for the 95% interval, sorted so the largest effect is on top | Forest plot | `forestPlot` |
| Use it to see which groups resemble each other in a profile of many variables — hotel types by the attributes their guests value, segments by the behaviours they show | Clustered heatmap | `clusteredHeatmap` |
| Use it to show a fitted network of binary behaviours — a bayesian network, a path model — in the "tetrad + gephi" style: every node is a behaviour, its size is the share of people who show it (6 + 34·sqrt(share / max)), its colour is the community found by a greedy modularity pass (or passed per node), and the label reads "name n%" | Network graph | `networkGraph` |
| Use it to rank the things that go wrong on the way to an outcome: x = how common the event is (share of sessions, log scale), y = how often people leave without the outcome right after it | Risk map | `riskMap` |
| Use it to show when things happen after a key moment (a booking, a sign-up, a first visit): one smoothed curve per channel on a log time axis with readable ticks (30 s, 1 min,  | Event density | `eventDensity` |
| The "gone" mass matters as much as the active one: a 100% stacked area over time mirrored around zero — states that mean left or paused grow upwards, active screens sit below the line, the y axis runs 0–100 both ways | State butterfly | `stateButterfly` |
| Use it as the first table after a segmentation: one row per segment with its name, a share-of-base bar, the outcome bar with its value and a sparkline of the state timeline — a tiny 100% stacked column per time mark, colour = state | Segmentation panel | `segmentationPanel` |
| Use it to show one session as a story: a shared time axis (linear or log; pauses longer than `pauseafter` are hatched and shortened), lanes = screens as coloured segments with a tick at every transition, a row of selection actions — what was added to a shortlist or a trip (numbered dot = new item, small dot = one more of an item, red cross = removed), a query row (diamond at the query start, red when nothing was found, a bar while the results stayed on screen), small diamonds where a card was opened, dashed highlight window, event pins and an optional step-line value track (balance, trip total) on top | Session anatomy | `sessionAnatomy` |
| Use it to show where people go from each screen | Transition graph | `transitionGraph` |
| Use it to explore a 2-d embedding (t-sne, umap) of texts or items: every point is one unit, coloured when it belongs to one of the top groups, grey when it belongs to another group, a ring when it has no group | Semantic map | `semanticMap` |
| Use it to show how far a set of items (tags, rules, features) reaches into the base and where adding more stops paying: one column per item in greedy order, grey = already covered by the items before it, blue = newly covered by this one, "+n" on top, the y axis in percent of the base | Coverage chart | `coverageChart` |

## 3. Data shapes (minimal working calls)

```js
// State timeline — one panel per segment, 100% bar per time mark
ChartKit.stateTimeline(el, {
  segments: [{ name: 'Searches by dates first', share: 25, value: 39 }],   // value = outcome; panels sort by it when present
  marks: [0, 10, 20, 120], states: ['home', 'search form', 'left'],
  data: { 'Searches by dates first': { home: [100, 40, 22, 8], 'search form': [0, 60, 78, 90], left: [0, 0, 0, 2] } }, // % per mark, sums to 100
  colors: { home: '#0F172A' }, base: 27, valueLabel: 'booking rate', shareLabel: 'of visits', columns: 4, unit: 's' });

// State stack — returns a controller
const st = ChartKit.stateStack(el, {
  labels: ['0', '1 s', '10 s', '1 min'], states: ['home', 'search form', 'booking form'],     // bottom to top
  data: { home: [100, 92, 46, 18], 'search form': [0, 7, 42, 52], 'booking form': [0, 1, 12, 30] },  // normalize: true rescales each mark to 100
  base: [5000, 4900, 3200, 1100], minBase: 250, lowBaseLabel: 'small base', baseLabel: 'sessions still going on:',
  onIsolate: state => {} });
st.isolate('search form'); st.isolate(null); st.redraw({ /* patch */ }); st.dispose();

// Sequence index — rows are individual units; time in seconds
const sq = ChartKit.sequenceIndex(el, {
  rows: [{ group: 'booked', end: 271, mark: 240, segments: [[0, 33, 0], [33, 60, 1], [60, 271, 2]] }], // [from, to, stateIndex]
  states: ['home', 'search form', 'booking form'], groups: [{ key: 'no booking', label: 'did not book' }, { key: 'booked', label: 'booked' }],
  markLabel: 'booking', scale: 'log' });           // 'log' = log10(t + 1); redraw({ scale: 'linear', maxTime: 600 })

// Segment tree — nested rules; every node carries share and value
ChartKit.segmentTree(el, { tree: { name: 'All visits', share: 100, value: 27, children: [
  { name: 'Came from a price alert', share: 5, value: 61 },
  { name: 'Booked here before', share: 24, value: 41, children: [ /* ... */ ] } ] },
  base: 27, valueLabel: 'booking rate', shareLabel: 'of visits' });

// Diverging bars — with vs without a factor, percentage points
ChartKit.divergingBars(el, { items: [{ name: 'Booked here before', withValue: 41, withoutValue: 23, share: 24 }] });

// Grouped bars — several metrics per category on ONE scale
ChartKit.groupedBars(el, { names: ['A', 'B'], series: [{ name: 'share of visits', values: [25, 13] }, { name: 'booking rate', values: [39, 34] }] });

// Flow sankey — exactly three columns; nodes reordered to reduce crossings
ChartKit.flowSankey(el, { columns: [['Searches by dates first'], ['compared in the results list'], ['Decisive booker']],
  links: [{ source: 'Searches by dates first', target: 'compared in the results list', value: 661 }, { source: 'compared in the results list', target: 'Decisive booker', value: 240 }],
  colors: { 'Searches by dates first': '#2563EB' }, pinLast: ['Saved nothing'], onNodeClick: name => {} });

// Segment map — x = size, y = outcome; labels never overlap
ChartKit.segmentMap(el, { points: [{ name: 'Searches by dates first', x: 25, y: 39, group: 'first two minutes', color: '#2563EB' }],
  xName: 'share of all visits, %', yName: 'booking rate, %', reference: { y: 27, label: 'average 27%' } });

// Ladder — plain HTML
ChartKit.ladder(el, { steps: [{ name: 'Opened the site', value: 100 }, { name: 'Ran a search', value: 64, loss: 'left from the home page', href: '#step-1' }] });

// Heat table — plain HTML; shaded only when |v − overall| ≥ minAbs (3) and relative ≥ minRel (0.15)
ChartKit.heatTable(el, { rows: ['Booked here before'], columns: [{ name: 'Searches by dates first', sub: '25% of visits' }],
  values: { 'Booked here before': [24] }, overall: { 'Booked here before': 24 } });
```

```js
// Penalty–reward map
ChartKit.penaltyRewardMap(el, {
  points: [{ name, x: penalty, y: reward, xCi?, yCi? }, ...],
  xName: 'penalty, pp', yName: 'reward, pp',
  zones: { topLeft: 'attract', topRight: 'key', bottomRight: 'basic', bottomLeft: 'secondary' },
  ci: true, table: true,            // highlight: name, compact: true, xRange/yRange for small multiples
});

// Contribution waterfall
ChartKit.contributionWaterfall(el, {
  start: { label: 'Average', value: 54 }, end: { label: 'Group D', value: 62.1 },
  steps: [{ name: 'Factor', value: 3.8, ci?: 1.0 }, ...],   // residual = end - start - sum(steps)
  unit: '%', stepUnit: 'pp', summaryLabel: 'All factors together', residualLabel: 'Not explained'
});

// Bar with dots
ChartKit.barWithDots(el, {
  items: [{ name, value, ci?, waves: [v1, v2, v3] }, ...],
  waveNames: ['wave 1', 'wave 2', 'wave 3'], unit: ' pp',
  signed: true, ci: true,            // signed: false + reference: color for a one-colour score
});

// Rank bump
ChartKit.rankBump(el, {
  waves: ['wave 1', 'wave 2', 'wave 3'],
  items: [{ name, values: [v per wave] } | { name, ranks: [r per wave] }, ...],
  minMove: 5, color: '#7C3AED'      // lines that moved >= minMove places are coloured
});

// Dumbbell
ChartKit.dumbbell(el, {
  rows: [{ name, a, b, reference?, dim? }],   // a, b = the two values; reference = base tick (number or [refA, refB]); dim = fade the row
  aLabel: 'before', bLabel: 'after', referenceLabel: 'all',
  format: v => Math.round(v) + '%', min: 0, sort: false | 'a' | 'b' | 'diff'
});

// Forest plot
ChartKit.forestPlot(el, {
  rows: [{ name, est, lo, hi, p?, sig? }],      // 95% interval [lo; hi]; significance from sig, else p < alpha, else the interval
  scale: 'diff' | 'ratio',                      // 'ratio' = multipliers on a log axis, reference line at 1
  unit: 'pp', alpha: 0.05, nsLabel: '(n.s.)', xName: 'effect, pp'
});

// Clustered heatmap
ChartKit.clusteredHeatmap(el, {
  rows: [names], columns: [names], values: [[per row, per column]], overall?: [per row],
  cluster: { rows: true, cols: true },    // Ward clustering, dendrograms drawn as graphic polylines
  orderBy?: 'column name',                // alternative: columns sorted by Euclidean distance to that column
  labelMin: 0.5, unit: 'pp'
});

// Network graph
ChartKit.networkGraph(el, {
  nodes: [{ name, prevalence (0–100), community?, column? }],   // community: colour group; column: 0-based column for layout 'columns'
  edges: [{ source, target, coef }],                           // coef may be negative
  layout: 'force' | 'columns', columns: ['caption 0', 'caption 1', ...], target: 'Booked'
});

// Risk map
ChartKit.riskMap(el, {
  events: [{ name, note?, category?, x: % of sessions, n: occurrences, k: lost }],
  background: 9.5, minN: 100, colors: { [category]: color },
  quadrants: { topLeft: 'rare but deadly', topRight: 'mass killers' },
  xName: 'share of sessions (log) →', yName: '↑ lost within a minute, %'
});

// Event density
ChartKit.eventDensity(el, {
  channels: [{ name, times: [minutes], color?, area?: true }],
  tMin: 0.5, tMax: 43200, milestones: [{ t: 360, label: 'reminder e-mail' }],
  xName: 'time since booking'
});

// State butterfly
ChartKit.stateButterfly(el, {
  labels: ['0', '1 s', '10 s', '1 min', ...], states: [...all states],
  up: ['paused', 'left'], data: { [state]: [% per mark] }, colors: { [state]: color }
});

// Segmentation panel
ChartKit.segmentationPanel(el, {
  rows: [{ name, share, value, color?, overall?: true }],
  valueLabel: 'booking rate', shareLabel: 'share of visits',
  mini: { marks, states, colors, data: { [row]: { [state]: [% per mark] } } }   // optional
});

// Session anatomy
ChartKit.sessionAnatomy(el, {
  lanes: ['home', 'search form', 'hotel page', 'booking form'], segments: [[0, 14, 0], [14, 52, 1], [52, 71, 2], [71, 90, 3]], end: 90,
  adds: [{ t: 44, n: 1, name: 'item A' }], removes: [], cards: [{ t: 54, name: 'item A' }],
  queries: [{ t: 16, text: 'seaside town', found: 86, until: 52 }],
  highlight: { from: 0, to: 60, label: 'first minute' }, scale: 'linear', compressPauses: true
});   // returns { redraw(patch), dispose(), node }; needs lib/parts/session-anatomy.css

// Transition graph
ChartKit.transitionGraph(el, {
  nodes: [{ name: 'home', x: 0, y: 100, entries: 2000, dwell: 7 }, { name: 'search form', x: 200, y: 0, entries: 1500, dwell: 24 }, { name: 'booking form', x: 400, y: 100, entries: 800, dwell: 90 }],
  links: [{ source: 'home', target: 'search form', count: 900 }, { source: 'search form', target: 'booking form', count: 500 }, { source: 'booking form', target: 'booked', count: 450 }, { source: 'home', target: 'left', count: 700 }],
  goodEnds: ['booked'], minShare: 15, matrix: true
});   // returns { chart, redraw(patch), dispose() }; container needs a height (~560px)

// Semantic map
ChartKit.semanticMap(el, {
  points: [{ x: 1.2, y: -0.4, group: 'price', sub: 'too expensive', cluster: 'c1', text: 'too pricey for the season' }, { x: 0.3, y: 2.1, group: null, sub: null, cluster: null }],
  levels: [{ zoom: 1, field: 'group' }, { zoom: 2.2, field: 'sub' }, { zoom: 5, field: 'cluster' }],
  words: { group: { price: ['expensive', 'fee'] }, sub: { 'too expensive': ['expensive', 'price'] }, cluster: { c1: ['pricey'] } },
  onClick: (point, label) => console.log(point || label)
});   // canvas, sizes itself (0.62 x width); needs lib/parts/semantic-map.css; returns { redraw, focus, reset, dispose }

// Coverage chart
ChartKit.coverageChart(el, {
  sets: { 'tag A': [1, 2, 3, 4, 5], 'tag B': [4, 5, 6, 7], 'tag C': [1, 8], 'tag D': [2, 3] },   // or items / covered / added
  total: 10, minGain: 0.05,
  coveredLabel: 'already covered', addedLabel: 'newly covered', onClick: item => console.log(item)
});   // ECharts instance; container needs a height (~440px)
```

Python helpers for data preparation: `python/tree_segments.py` (sklearn decision tree on 0/1 drivers →
nested `tree` for `segmentTree`, plus an out-of-fold check) and `python/flow_order.py` (row-level table with
three categorical columns → `columns` and `links` for `flowSankey`).

## 4. Presentation rules these charts were built around

Apply them when composing a report page, not only when calling a function.

1. **If two numbers must be compared, put them side by side on one scale** — never in separate panels.
2. **Write each condition once.** Long labels that repeat the same prefix mean the chart should be a tree.
3. **Segments defined by rules are drawn as a tree**, built on the metric (decision tree, leaf ≥ ~4% of the base;
   a rare but strong factor can be split off first) — not clustered "by similarity".
4. **Before any breakdown by model-found segments, show the chart that explains the segmentation** (what the
   segments are built on — usually a state timeline). A tree explains itself and needs no such chart.
5. **Sort segments by the outcome and print the outcome next to the segment name.** Give the size with every share
   and say what the denominator is.
6. **Shade only differences that are large enough to matter** (heat table defaults: 3 points and 15% relative).
7. **Time charts: the default base is "still active"**, not "all sessions"; show the base size and dim marks with
   a small base. Prefer a logarithmic time axis so the first seconds and the long tail are both readable.
8. **Opening slide of a step = total by situations**: mutually exclusive situations covering 100%, each with its
   outcome share. Then drivers (diverging bars) → segments → segments against the outcome (grouped bars).
9. **Supplementary analyses expand downwards on the same page** (`<details>`), not in a modal or a new window.
10. **Subject is a person, verb is an action**: "entered the dates → opened a hotel", not "search gets tired".

## 5. Checklist before handing the page over

- Every chart container has a height (except ladder, heat table, sequence index).
- Every share has its denominator in the subtitle or axis name; outcome label and share label are set
  (`valueLabel`, `shareLabel`).
- Colours of states are the same across all charts on the page (pass the same `colors` map everywhere).
- Numbers in the page are the project's real aggregates; no row-level personal data is embedded.
- The page opens from a file without a server (no module imports, relative paths only) and the ECharts
  `<script>` is loaded before `lib/charts.js`.
