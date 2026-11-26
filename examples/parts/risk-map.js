/* Demo data for ChartKit.riskMap — invented events of a generic travel booking site, counts made up by hand. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  const N = 60000;                                                          // sessions in the demo base
  // [name, note (a nickname, italic), category, sessions where it happened, of them lost within a minute]
  const E = [
    ['no rooms for these dates', 'sold out', 'search', 3600, 1440],
    ['cookie banner', 'accept all?', 'start', 27000, 4320],
    ['slow results page', 'the spinner', 'results', 7800, 2418],
    ['session expired', 'start again', 'booking', 150, 75],
    ['photos failed to load', 'grey squares', 'hotel page', 3600, 216],
    ['destination not served', 'out of range', 'search', 1440, 950],
    ['voucher code error', 'wrong code', 'booking', 1200, 204],
    ['card declined', 'try another card', 'booking', 480, 307],
    ['booking error', 'the red banner', 'booking', 240, 211],
    ['page crash', 'blank screen', 'start', 90, 70],
    ['minimum stay notice', 'two nights or more', 'hotel page', 2100, 1092],
    ['sign-in prompt', 'who are you?', 'start', 10800, 756],
    ['no results after a filter', 'nothing matches', 'results', 2700, 729],
    ['price changed at the last step', 'surprise', 'booking', 720, 259],
  ];
  const colors = { start: '#334155', search: '#2563EB', results: '#A78BFA', 'hotel page': '#6D28D9', booking: '#059669' };
  DEMO.riskMap = function () {
    return {
      events: E.map(a => ({ name: a[0], note: a[1], category: a[2], x: 100 * a[3] / N, n: a[3], k: a[4] })),
      background: 9.5, backgroundLabel: 'background, ordinary action', minN: 100, colors,
      labelPositions: { 'no rooms for these dates': 'left', 'cookie banner': 'top', 'slow results page': 'top', 'session expired': 'right', 'photos failed to load': 'left', 'destination not served': 'right', 'voucher code error': 'left', 'card declined': 'left', 'booking error': 'right', 'page crash': 'right', 'minimum stay notice': 'left', 'sign-in prompt': 'left', 'no results after a filter': 'left', 'price changed at the last step': 'left' },
      quadrants: { topLeft: 'rare but deadly', bottomRight: 'loud but harmless', bottomLeft: 'almost harmless' },
      zone: { x: 5, factor: 2, label: 'common and deadly' },
      xName: 'how common — share of sessions where it happens (log scale) →', yName: '↑ left without a booking within a minute, %',
      lostLabel: 'sessions lost',
    };
  };
})(window);
