/* Synthetic demo for ChartKit.barWithDots — the effect of each attribute of a stay on "would stay again" in a survey of hotel guests, full base plus three survey waves (invented by formula). */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const ATTRS = [['Room cleanliness', 8.7], ['Value for money', 7.4], ['Bed comfort', 6.6], ['Location', 5.5], ['Staff friendliness', 4.7], ['Quiet at night', 3.9],
    ['Breakfast quality', 3.1], ['Bathroom', 2.4], ['Check-in speed', 1.8], ['Air conditioning', 1.2], ['Luggage storage', 0.5],
    ['Late checkout', -0.7], ['Pool or gym', -1.3], ['Parking', -2.2], ['Wi-Fi', -3.1], ['Noise insulation', -4.2]];
  global.DEMO.barWithDots = function (seed) {
    const rand = rng(seed || 21), r1 = () => Math.round((rand() - 0.5) * 2 * 10) / 10;
    const items = ATTRS.map(([name, v]) => ({ name, value: v, ci: Math.round((0.7 + rand() * 1.1) * 100) / 100, waves: [v + r1() * 1.5, v + r1() * 1.3, v + r1() * 1.1].map(x => Math.round(x * 10) / 10) }));
    return { items, waveNames: ['wave 1', 'wave 2', 'wave 3'], unit: ' pp', signed: true, ci: true, baseLabel: 'all waves' };
  };
  // an "old method" view of the same attributes: an unsigned importance score, one bar colour
  global.DEMO.barWithDotsReference = function () {
    const d = global.DEMO.barWithDots(4);
    d.items = d.items.map(x => ({ name: x.name, value: Math.round((Math.abs(x.value) * 1.5 + 3) * 10) / 10, waves: x.waves.map(w => Math.round((Math.abs(w) * 1.5 + 3) * 10) / 10) }));
    return { ...d, unit: '%', signed: false, ci: false, reference: '#7C3AED', format: v => v.toFixed(1) };
  };
})(window);
