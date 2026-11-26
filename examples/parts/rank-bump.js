/* Synthetic demo for ChartKit.rankBump — the rank of each attribute of a hotel stay by importance in three survey waves (invented by formula). */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const ATTRS = ['Room cleanliness', 'Value for money', 'Bed comfort', 'Location', 'Staff friendliness', 'Quiet at night', 'Breakfast quality', 'Bathroom',
    'Check-in speed', 'Air conditioning', 'Wi-Fi', 'Noise insulation', 'Parking', 'Pool or gym', 'Late checkout', 'Luggage storage'];
  global.DEMO.rankBump = function (seed) {
    const rand = rng(seed || 12), n = ATTRS.length;
    const items = ATTRS.map((name, i) => { const base = n - i + (rand() - 0.5) * 3;                        // a stable score with small noise per wave
      const jump = i === 6 ? [0, -5, -8] : i === 13 ? [0, 4, 8] : i === 10 ? [0, 3, 6] : [0, 0, 0];         // three attributes that really moved
      return { name, values: jump.map(j => Math.round((base + j + (rand() - 0.5) * 2.5) * 100) / 100) }; });
    return { waves: ['wave 1', 'wave 2', 'wave 3'], items, minMove: 5, color: '#7C3AED' };
  };
})(window);
