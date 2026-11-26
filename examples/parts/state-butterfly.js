/* Demo data for ChartKit.stateButterfly — a seeded walk over the screens of a generic travel booking site, counted among ALL sessions at
   log-spaced marks: sessions that ended are "left with booking" / "left without booking", long gaps are "paused". Everything is invented. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const ACTIVE = ['home', 'search form', 'results list', 'hotel page', 'booking form', 'trip page'];
  const UP = ['paused', 'left without booking', 'left with booking'];
  const COLORS = { 'home': '#334155', 'search form': '#2563EB', 'results list': '#A78BFA', 'hotel page': '#6D28D9', 'booking form': '#059669', 'trip page': '#CA8A04',
    'paused': '#CBD5E1', 'left without booking': '#F3D9CC', 'left with booking': '#86EFAC' };
  const NEXT = [[0, 45, 16, 9, 3, 27], [4, 0, 64, 7, 2, 23], [5, 13, 0, 61, 3, 18], [3, 6, 29, 0, 43, 19], [4, 5, 13, 39, 0, 39]];   // weights to [home, search form, results list, hotel page, booking form, leave]
  const DWELL = [[8, 0.9], [22, 0.7], [38, 0.9], [55, 0.8], [85, 0.6], [45, 1.0]], P_BOOK = 0.58, P_PAUSE = 0.08, PAUSED = 6;
  const MARKS = [0].concat([1, 10, 60, 600].flatMap(u => [1, 2, 3, 5].map(m => m * u))).concat([3600, 7200]);
  const label = t => (t === 0 ? '0' : t < 60 ? t + ' s' : t < 3600 ? t / 60 + ' min' : t / 3600 + ' h');

  DEMO.stateButterfly = function () {
    const rand = rng(43), gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const pick = w => { let x = rand() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return w.length - 1; };
    const N = 3600, count = MARKS.map(() => ({})), states = ACTIVE.concat(UP);
    MARKS.forEach((_, k) => states.forEach(s => { count[k][s] = 0; }));
    for (let i = 0; i < N; i++) {
      const seg = []; let t = 0, s = 0, booked = false;
      const add = (st, d) => { seg.push([t, t + d, st]); t += d; };
      for (let step = 0; step < 60; step++) {
        add(s, DWELL[s][0] * Math.exp(DWELL[s][1] * gauss()));
        if (s === 4 && rand() < P_BOOK) { booked = true; add(5, DWELL[5][0] * Math.exp(DWELL[5][1] * gauss())); break; }
        const nx = pick(NEXT[s]); if (nx === 5) break;
        if (rand() < P_PAUSE) add(PAUSED, 150 - 360 * Math.log(1 - rand()));
        s = nx;
      }
      MARKS.forEach((m, k) => { const a = seg.find(x => m >= x[0] && m < x[1]);
        count[k][a ? (a[2] === PAUSED ? 'paused' : ACTIVE[a[2]]) : (booked ? 'left with booking' : 'left without booking')] += 1; });
    }
    const data = {}; states.forEach(s => { data[s] = MARKS.map((_, k) => 100 * count[k][s] / N); });
    return { labels: MARKS.map(label), states, up: UP, data, colors: COLORS, yName: '← active on the site        left or paused →' };
  };
})(window);
