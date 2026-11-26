/* Demo data for ChartKit.eventDensity — synthetic "minutes after booking" for five things people do with a booking on a generic travel site.
   Times are drawn from seeded log-normal mixtures; every parameter below is invented. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // channel: [name, color, n, [[weight, median minutes, spread], ...]]
  const CH = [
    ['change dates', '#334155', 700, [[0.45, 12, 0.9], [0.55, 1800, 0.9]]],
    ['contact property', '#2563EB', 1250, [[0.25, 25, 0.8], [0.75, 4300, 0.7]]],
    ['cancel booking', '#F97316', 600, [[0.55, 7, 0.9], [0.45, 1500, 1.0]]],
    ['add a transfer', '#059669', 950, [[0.35, 5, 0.7], [0.65, 2900, 0.8]]],
    ['leave a review', '#7C3AED', 2100, [[1, 17280, 0.35]]],
  ];
  const DAY = 1440, T_MIN = 0.5, T_MAX = 30 * DAY;
  DEMO.eventDensity = function () {
    const rand = rng(61), gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const channels = CH.map(c => { const times = [];
      for (let i = 0; i < c[2]; i++) { let x = rand(), mix = c[3][0]; for (const m of c[3]) { x -= m[0]; if (x < 0) { mix = m; break; } }
        times.push(Math.min(T_MAX, Math.max(T_MIN, mix[1] * Math.exp(mix[2] * gauss())))); }
      return { name: c[0] + ' (' + c[2] + ')', color: c[1], times, area: c[0] === 'leave a review' }; });
    return { channels, tMin: T_MIN, tMax: T_MAX, ticks: [1, 5, 30, 60, 360, DAY, 3 * DAY, 7 * DAY, 30 * DAY], xName: 'time since booking',
      milestones: [{ t: 1, label: 'confirmation e-mail · 1 min' }, { t: 360, label: 'reminder e-mail · 6 h' }, { t: 7 * DAY, label: 'typical check-in · 7 d' }], cumLabel: 'by this moment' };
  };
})(window);
