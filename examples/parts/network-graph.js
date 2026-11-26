/* Demo data for ChartKit.networkGraph — synthetic, hand-made. Fourteen binary behaviours in a visit to a generic travel booking site,
   with the target "booked"; edges are path coefficients of a fitted model (invented). Columns: how the visit started,
   first actions, engagement, outcome. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  // layout: 'force' (default) or 'columns'
  global.DEMO.networkGraph = function (layout) {
    // [name, prevalence %, column]
    const N = [['Came from a price alert', 9, 0], ['Signed in', 38, 0], ['Booked here before', 24, 0], ['Entered dates', 57, 1], ['Opened a deal', 19, 1],
      ['Browsed destinations', 33, 1], ['Used a filter', 29, 1], ['Opened a hotel page', 62, 2], ['Read reviews', 31, 2], ['Opened the map', 22, 2],
      ['Looked at photos', 44, 2], ['Compared rooms', 17, 2], ['Saved a hotel', 14, 2], ['Booked', 27, 3]];
    // [source, target, coefficient]
    const E = [['Came from a price alert', 'Opened a deal', 0.46], ['Opened a deal', 'Opened a hotel page', 0.31], ['Signed in', 'Booked here before', 0.34],
      ['Booked here before', 'Entered dates', 0.25], ['Entered dates', 'Used a filter', 0.33], ['Entered dates', 'Opened a hotel page', 0.39],
      ['Browsed destinations', 'Opened the map', 0.27], ['Opened the map', 'Opened a hotel page', 0.18], ['Used a filter', 'Opened the map', 0.16],
      ['Opened a hotel page', 'Looked at photos', 0.41], ['Opened a hotel page', 'Read reviews', 0.29], ['Looked at photos', 'Compared rooms', 0.23],
      ['Read reviews', 'Compared rooms', 0.14], ['Compared rooms', 'Booked', 0.43], ['Signed in', 'Saved a hotel', 0.21],
      ['Opened the map', 'Saved a hotel', 0.19], ['Saved a hotel', 'Booked', 0.17], ['Booked here before', 'Booked', 0.2], ['Entered dates', 'Browsed destinations', -0.22]];
    return { nodes: N.map(n => ({ name: n[0], prevalence: n[1], column: n[2] })), edges: E.map(e => ({ source: e[0], target: e[1], coef: e[2] })),
      target: 'Booked', layout: layout || 'force', columns: ['How the visit started', 'First actions', 'Engagement', 'Outcome'] };
  };
})(window);
