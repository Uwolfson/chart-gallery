/* Demo data for ChartKit.clusteredHeatmap — synthetic, generated. A survey of guests of seven types of hotels: the share who name
   each attribute of a stay as important; the chart shows the difference from the overall share, so the clusters are "who values what". */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  global.DEMO.clusteredHeatmap = function () {
    const rand = rng(7);
    const rows = ['Room cleanliness', 'Value for money', 'Location', 'Bed comfort', 'Quiet at night', 'Breakfast quality', 'Staff friendliness',
      'Wi-Fi', 'Parking', 'Pool or gym', 'Late checkout', 'Check-in speed'];
    const columns = ['City hotel', 'Resort', 'Hostel', 'Serviced apartment', 'Boutique hotel', 'Airport hotel', 'Motel'];
    const overall = [71, 58, 63, 49, 44, 38, 35, 41, 27, 22, 16, 30];
    // three families of hotels: leisure stays, short stops on the way, city and long stays
    const family = { 'Resort': 0, 'Boutique hotel': 0, 'Hostel': 1, 'Airport hotel': 1, 'Motel': 1, 'City hotel': 2, 'Serviced apartment': 2 };
    const shift = [ // per family: which attributes are named more (+) or less (−) than overall, in pp
      [2, -9, -3, 6, 4, 11, 9, -6, -4, 15, 7, -7], [-5, 12, -6, -7, -4, -10, -6, 3, 9, -11, 2, 10], [3, -2, 10, 2, 5, -3, -2, 8, -5, -6, -4, 3] ];
    const values = rows.map((_, i) => columns.map(c => overall[i] + shift[family[c]][i] + (rand() - 0.5) * 7));
    return { rows, columns, values: values.map(r => r.map(v => Math.round(v * 10) / 10)), overall, unit: 'pp', labelMin: 1, format: v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) };
  };
})(window);
