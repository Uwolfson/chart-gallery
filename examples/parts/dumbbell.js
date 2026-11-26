/* Demo data for ChartKit.dumbbell — synthetic, hand-made. A generic travel booking site: which filters people switch on in the
   first search of a trip and which ones in the last search before they book; the dash is the filter's share among all searches. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  global.DEMO.dumbbell = function () {
    // [name, share of first searches, share of last searches, share of all searches, not significant?]
    const R = [
      ['Price range', 52, 38, 44], ['Distance to the centre', 34, 26, 30], ['Star rating', 28, 17, 22], ['Guest rating 8+', 21, 43, 33],
      ['Free cancellation', 17, 39, 29], ['Breakfast included', 12, 25, 19], ['Parking', 9, 16, 13], ['Pool', 11, 10, 10, true],
      ['Pet friendly', 5, 6, 6, true], ['Airport shuttle', 4, 7, 5, true] ];
    return { rows: R.map(r => ({ name: r[0], a: r[1], b: r[2], reference: r[3], dim: !!r[4] })),
      aLabel: 'in the first search', bLabel: 'in the last search before booking', referenceLabel: 'in all searches', min: 0 };
  };
})(window);
