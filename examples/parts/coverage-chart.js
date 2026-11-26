/* Synthetic demo for ChartKit.coverageChart: 18 tags over 1,500 open-ended survey answers about a trip; memberships are seeded random with nested overlaps. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // tag: [share of the base it marks, share of its members that ALSO carry the first tag] — the second number makes later tags overlap earlier ones
  const TAGS = [['general praise', 0.31, 0], ['price', 0.2, 0.28], ['location', 0.17, 0.38], ['cleanliness', 0.13, 0.42], ['booking process', 0.1, 0.4],
    ['staff friendliness', 0.09, 0.62], ['photos accuracy', 0.075, 0.48], ['support', 0.065, 0.5], ['breakfast', 0.055, 0.58], ['cancellation policy', 0.045, 0.55],
    ['check-in', 0.05, 0.72], ['noise', 0.04, 0.66], ['hidden fees', 0.03, 0.78], ['refund', 0.025, 0.7], ['wi-fi', 0.022, 0.82],
    ['parking', 0.018, 0.84], ['late arrival', 0.014, 0.8], ['thin walls', 0.011, 0.9]];
  global.DEMO.coverageChart = function () {
    const rand = rng(57), N = 1500, sets = {}, first = [];
    for (let id = 1; id <= N; id++) if (rand() < TAGS[0][1]) first.push(id);
    sets[TAGS[0][0]] = first;
    const firstSet = new Set(first), others = []; for (let id = 1; id <= N; id++) if (!firstSet.has(id)) others.push(id);
    TAGS.slice(1).forEach(([name, share, overlap]) => { const k = Math.round(N * share), out = [];
      for (let i = 0; i < k; i++) { const pool = rand() < overlap ? first : others; out.push(pool[Math.floor(rand() * pool.length)]); }
      sets[name] = [...new Set(out)]; });
    return { sets, total: N, coveredLabel: 'already covered by earlier tags', addedLabel: 'newly covered by this tag', minGain: 0.005 };
  };
})(window);
