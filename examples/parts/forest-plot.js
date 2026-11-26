/* Demo data for ChartKit.forestPlot — synthetic, hand-made. A survey of a language-learning app's users: what raises the chance
   that a learner finishes the course, and what multiplies the number of lessons per month, holding everything else constant. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  // scale: 'diff' (percentage points, default) or 'ratio' (a multiplier, log axis)
  global.DEMO.forestPlot = function (scale) {
    if (scale === 'ratio') {
      // [name, multiplier, low, high]
      const R = [['Uses speaking practice', 1.71, 1.38, 2.12], ['Books live tutor sessions', 1.44, 1.12, 1.85], ['Keeps streak reminders on', 1.26, 1.05, 1.51],
        ['Uses flashcards', 1.14, 0.97, 1.34], ['Listens to podcasts', 1.06, 0.88, 1.28], ['Does grammar drills', 0.95, 0.79, 1.14], ['Took the placement test', 0.87, 0.69, 1.1]];
      return { rows: R.map(r => ({ name: r[0], est: r[1], lo: r[2], hi: r[3] })), scale: 'ratio', xName: 'multiplier of lessons per month', nsLabel: '(n.s.)' };
    }
    // [name, estimate in pp, low, high]
    const R = [['Studies daily', 21.3, 15.6, 27.0], ['Joined a study group', 12.8, 7.9, 17.7], ['Set a weekly goal', 9.1, 4.4, 13.8],
      ['Has a paid plan', 6.2, 1.5, 10.9], ['Has the mobile app', 3.4, -0.6, 7.4], ['Lives in a large city', 1.6, -2.1, 5.3],
      ['Aged under 35', -1.1, -4.6, 2.4], ['Learns two languages at once', -4.3, -8.7, 0.1], ['Studies a few times a year', -17.2, -22.1, -12.3]];
    return { rows: R.map(r => ({ name: r[0], est: r[1], lo: r[2], hi: r[3] })), unit: 'pp', xName: 'change in the chance of finishing the course, pp' };
  };
})(window);
