/* Synthetic demo for ChartKit.sessionAnatomy: one invented session on a generic travel booking site, with a trip-total track. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  // lanes: 0 home, 1 search form, 2 results list, 3 hotel page, 4 room choice, 5 booking form; time in seconds from the session start
  global.DEMO.sessionAnatomy = function () {
    const lanes = ['home', 'search form', 'results list', 'hotel page', 'room choice', 'booking form'];
    const colors = { 'home': '#334155', 'search form': '#2563EB', 'results list': '#A78BFA', 'hotel page': '#6D28D9', 'room choice': '#059669', 'booking form': '#CA8A04' };
    const segments = [
      [0, 11, 0], [11, 38, 1], [38, 97, 2], [97, 141, 3], [141, 163, 2], [163, 204, 3], [204, 229, 4],   // first search: two hotels opened, a stay added
      [229, 251, 1], [251, 270, 1], [270, 322, 2], [322, 371, 3], [371, 398, 4],                         // a mistyped search, then another destination
      [398, 780, 4],                                                                                       // a pause on the room choice (stepped away), see `pauses`
      [780, 803, 4], [803, 826, 5], [826, 858, 3], [858, 881, 4], [881, 934, 5],                          // drops the first stay, goes back for an extra, then books
    ];
    const adds = [
      { t: 221, n: 1, name: 'studio by the beach, 2 nights', note: 'from the room list' },
      { t: 384, n: 2, name: 'old town guesthouse, 1 night', note: 'from the room list' },
      { t: 392, name: 'old town guesthouse', note: 'second night' },
      { t: 869, n: 3, name: 'breakfast for two', note: 'an extra on the room page' },
    ];
    const removes = [{ t: 790, name: 'studio by the beach, 2 nights', note: 'trip total went from 421.00 to 187.00' }];
    const cards = [{ t: 99, name: 'guesthouse by the pier' }, { t: 165, name: 'studio by the beach' }, { t: 324, name: 'old town guesthouse' }, { t: 828, name: 'old town guesthouse' }];
    const queries = [
      { t: 13, text: 'seaside town', found: 86, until: 97 },
      { t: 232, text: 'old twon', found: 0, until: 251 },
      { t: 253, text: 'old town', found: 41, until: 322, late: false },
    ];
    const events = [{ t: 929, label: 'booked 211.00', color: '#059669', tip: 'booking confirmed, 2 nights with breakfast' }];
    const highlight = { from: 0, to: 120, label: 'first two minutes', short: '2 min', color: '#2563EB', tip: 'the first two minutes of the session' };
    const valueTrack = [{ t: 221, v: 234 }, { t: 384, v: 327.5 }, { t: 392, v: 421 }, { t: 790, v: 187 }, { t: 869, v: 211 }];
    return { lanes, colors, segments, end: 934, pauses: [[398, 780]], adds, removes, cards, queries, events, highlight,
      valueTrack, valueStart: 0, valueLabel: 'trip total', valueFormat: v => v.toFixed(2),
      words: { items: 'stays in the trip', queries: 'destination searches', added: 'added stay', plusOne: 'one more night' },
      scale: 'linear', compressPauses: true, pauseAfter: 120 };
  };
})(window);
