/* Demo data for ChartKit.segmentationPanel — built from DEMO.timeline() (the same synthetic segments as the state timeline),
   with an "all visits" row computed as the share-weighted average. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  DEMO.segmentationPanel = function () {
    const T = DEMO.timeline(), tot = T.segments.reduce((a, s) => a + s.share, 0);
    const colors = { 'Goes straight to booking': '#059669', 'Browses destinations': '#8B5CF6', 'Searches by dates first': '#2563EB', 'Opens one hotel': '#A78BFA', 'Checks saved trips': '#94A3B8', 'Stays on home': '#0F172A', 'Searches and leaves': '#E11D48', 'Leaves at once': '#F97316' };
    const data = { ...T.data }, all = {};
    T.states.forEach(st => { all[st] = T.marks.map((_, k) => T.segments.reduce((a, s) => a + s.share * T.data[s.name][st][k], 0) / tot); });
    data['All visits'] = all;
    const rows = T.segments.map(s => ({ name: s.name, share: s.share, value: s.value, color: colors[s.name] }));
    rows.push({ name: 'All visits', share: 100, value: T.base, overall: true });
    return { rows, valueLabel: 'booking rate', shareLabel: 'share of visits', nameLabel: 'segment',
      mini: { marks: T.marks, states: T.states, colors: T.colors, data, unit: 's', label: 'screen at' } };
  };
})(window);
