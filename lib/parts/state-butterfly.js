/* chart-gallery part — ChartKit.stateButterfly. Loads after lib/charts.js (uses the global `echarts` and ChartKit.PALETTE if present). */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const palette = () => (global.ChartKit && global.ChartKit.PALETTE) || ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const pct = v => Math.round(Math.abs(v)) + '%';

  /**
   * State butterfly — where everyone is at each moment, mirrored around zero: the states that mean "gone or paused" are stacked
   * upwards, the active states downwards, so the growing "left" mass and the shrinking active mass read as one shape. The y axis
   * runs -100..100 with absolute labels; a solid zero line separates the halves. Click a legend item to toggle that state.
   * opts: { labels: ['0', '1 s', ...] (time marks, log or linear — the caller decides), states: [all states, bottom of each half first],
   *         up: ['paused', 'left without booking', 'left with booking'] (states drawn above zero; the rest go below),
   *         data: { [state]: [% of all sessions per mark] }, colors?: { [state]: color }, normalize?: false,
   *         yName?: '← active on the site        left or paused →', labelEvery?: 1 | (index => boolean), legend?: true,
   *         tooltip?: (label, [{ name, value, color }]) => html }
   * `normalize: true` rescales every mark so the two halves sum to 100. Returns the ECharts instance.
   */
  function stateButterfly(el, o) {
    const t = theme(), P = palette(), up = o.up || [], down = o.states.filter(s => !up.includes(s)), n = o.labels.length;
    const color = s => (o.colors && o.colors[s]) || P[o.states.indexOf(s) % P.length];
    const every = i => (typeof o.labelEvery === 'function' ? !!o.labelEvery(i) : i % (o.labelEvery || 1) === 0);
    const sums = o.labels.map((_, k) => o.states.reduce((a, s) => a + (+o.data[s][k] || 0), 0));
    const val = s => o.data[s].map((v, k) => (o.normalize && sums[k] > 0 ? 100 * v / sums[k] : +v || 0));
    const area = (s, stack, sign) => ({ type: 'line', name: s, stack, data: val(s).map(v => sign * v), symbol: 'none', lineStyle: { width: 0 },
      areaStyle: { color: color(s), opacity: 1 }, itemStyle: { color: color(s) }, emphasis: { focus: 'series' } });
    const tip = ps => { const k = ps[0].dataIndex, rows = ps.filter(p => p.seriesName);
      if (o.tooltip) return o.tooltip(o.labels[k], rows.map(p => ({ name: p.seriesName, value: Math.abs(p.value), color: p.color })));
      return '<b>' + o.labels[k] + '</b><br>' + rows.map(p => p.marker + p.seriesName + ': ' + pct(p.value)).join('<br>'); };
    const ch = mount(el, { animation: false,
      legend: o.legend === false ? undefined : { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 }, data: [...up].reverse().concat(down) },
      tooltip: { trigger: 'axis', formatter: tip },
      grid: { left: 54, right: 30, top: 44, bottom: 30 },
      xAxis: { type: 'category', boundaryGap: false, data: o.labels, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: i => every(i) } },
      yAxis: { type: 'value', min: -100, max: 100, interval: 25, axisLabel: { color: t.muted, formatter: v => Math.abs(v) + '%' }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } },
        name: o.yName == null ? '← active        left or paused →' : o.yName, nameLocation: 'middle', nameGap: 40, nameTextStyle: { color: t.muted, fontSize: 12 } },
      series: up.map(s => area(s, 'up', 1)).concat(down.map(s => area(s, 'down', -1)))
        .concat([{ type: 'line', name: '', data: o.labels.map(() => 0), symbol: 'none', silent: true, lineStyle: { color: t.text, width: 1.2 }, tooltip: { show: false }, z: 5 }]) });
    global.addEventListener('resize', () => ch.resize());
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.stateButterfly = stateButterfly;
})(window);
