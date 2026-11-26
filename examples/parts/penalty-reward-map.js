/* Synthetic demo for ChartKit.penaltyRewardMap — 16 attributes of a stay in a survey of hotel guests (percentage points, invented by formula). */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // [name, penalty, reward] — the rough position; a seeded jitter and a CI are added on top
  const ATTRS = [
    ['Room cleanliness', 13, 5.5], ['Bed comfort', 10, 9], ['Value for money', 9, 12], ['Location', 5, 13], ['Staff friendliness', 3.5, 11],
    ['Quiet at night', 11.5, 3], ['Bathroom', 9.5, 1.2], ['Wi-Fi', 7, 3.6], ['Air conditioning', 6.2, 1], ['Noise insulation', 8.5, 8],
    ['Breakfast quality', 2.2, 8.8], ['Check-in speed', 4.8, 4.6], ['Pool or gym', 0.8, 7], ['Late checkout', 2, 5.2],
    ['Parking', 4, 2.4], ['Luggage storage', 1.6, 2.6] ];
  global.DEMO.penaltyRewardMap = function (seed) {
    const rand = rng(seed || 17);
    const points = ATTRS.map(([name, x, y]) => ({ name, x: Math.round((x + (rand() - 0.5) * 2) * 10) / 10, y: Math.round((y + (rand() - 0.5) * 2) * 10) / 10,
      xCi: Math.round((1.1 + rand() * 1.5) * 10) / 10, yCi: Math.round((0.9 + rand() * 1.3) * 10) / 10 }));
    return { points, xName: 'penalty, pp — more "would not stay again" when the attribute is bad', yName: 'reward, pp — more "would recommend" when it is good', unit: 'pp',
      zones: { topLeft: 'attract', topRight: 'key', bottomRight: 'basic', bottomLeft: 'secondary' }, ci: true, table: true };
  };
  // the same attributes for three types of hotels, shifted so small multiples have something to show
  global.DEMO.penaltyRewardMapGroups = function () {
    return ['All hotels', 'City hotels', 'Resorts', 'Hostels'].map((g, k) => {
      const d = global.DEMO.penaltyRewardMap(17 + k * 5);
      d.points.forEach((p, i) => { if (k) { p.x = Math.max(0.2, Math.round((p.x + ((i * 3 + k * 4) % 5 - 2) * 1.0) * 10) / 10); p.y = Math.max(0.2, Math.round((p.y + ((i * 7 + k * 3) % 5 - 2) * 1.0) * 10) / 10); } });
      return { title: g, opts: { ...d, ci: false, table: false, compact: true, xName: 'penalty', yName: 'reward', xRange: [-1, 17], yRange: [-1, 16] } };
    });
  };
})(window);
