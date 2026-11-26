/* Synthetic demo for ChartKit.transitionGraph: screen-to-screen transitions of a generic travel booking site, all sessions vs sessions with a booking. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const SCREENS = ['home', 'search form', 'results list', 'hotel page', 'booking form', 'trips & profile', 'pause'];
  const POS = { 'home': [80, 330], 'search form': [360, 110], 'results list': [360, 550], 'hotel page': [600, 330], 'booking form': [860, 110], 'trips & profile': [860, 550], 'pause': [1100, 330] };
  const COLORS = { 'home': '#334155', 'search form': '#2563EB', 'results list': '#A78BFA', 'hotel page': '#6D28D9', 'booking form': '#059669', 'trips & profile': '#CA8A04', 'pause': '#94A3B8' };
  const DWELL = { 'home': 9, 'search form': 24, 'results list': 41, 'hotel page': 58, 'booking form': 92, 'trips & profile': 31, 'pause': 240 };
  // weights of the next step from each screen: [the 7 screens..., left without booking, left with booking]
  const W_ALL = [
    [0, 41, 12, 7, 2, 6, 4, 28, 0],
    [3, 0, 61, 5, 1, 1, 4, 25, 0],
    [4, 15, 0, 52, 2, 1, 5, 21, 0],
    [3, 5, 33, 0, 30, 2, 6, 21, 0],
    [3, 4, 9, 22, 0, 6, 7, 23, 26],
    [9, 8, 4, 6, 3, 0, 7, 44, 19],
    [10, 12, 12, 23, 19, 4, 0, 20, 0],
  ];
  // sessions with a booking: more traffic towards the booking form, and every exit comes after the booking
  const W_BOOK = [
    [0, 47, 13, 9, 5, 6, 5, 0, 15],
    [2, 0, 70, 7, 2, 1, 5, 0, 13],
    [3, 13, 0, 64, 3, 1, 5, 0, 11],
    [2, 4, 29, 0, 49, 2, 6, 0, 8],
    [2, 3, 6, 15, 0, 11, 6, 0, 57],
    [8, 7, 4, 6, 4, 0, 7, 0, 64],
    [8, 11, 15, 22, 29, 5, 0, 0, 10],
  ];
  const ENTRIES = [24000, 17800, 19400, 21100, 7300, 2600, 5200];
  function links(weights, scale, seed) {
    const rand = rng(seed), out = [], targets = SCREENS.concat(['left without booking', 'left with booking']);
    SCREENS.forEach((s, i) => { const total = Math.round(ENTRIES[i] * scale * (0.9 + 0.2 * rand())), sum = weights[i].reduce((a, b) => a + b, 0);
      weights[i].forEach((wt, j) => { if (wt > 0) out.push({ source: s, target: targets[j], count: Math.round(total * wt / sum * (0.92 + 0.16 * rand())) }); }); });
    return out;
  }
  global.DEMO.transitionGraph = function () {
    return { nodes: SCREENS.map((s, i) => ({ name: s, x: POS[s][0], y: POS[s][1], entries: ENTRIES[i], dwell: DWELL[s], color: COLORS[s], labelPosition: s === 'hotel page' ? 'right' : undefined })),
      links: links(W_ALL, 1, 8), links2: links(W_BOOK, 0.27, 13), goodEnds: ['left with booking'], minShare: 15, matrix: true, matrixMode: 'links',
      words: { good: 'with a booking' } };
  };
})(window);
