/* chart-gallery part: ChartKit.dumbbell — two values per row joined by a line coloured by direction. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const pct = v => Math.round(v) + '%';
  const HI = '#2563EB', LO = '#F97316', GREY = '#94A3B8';

  /**
   * Dumbbell — two values per row (before / after, first search / last search, users / non-users) joined by a thick line
   * whose colour says which way the second value moved. Value labels sit at both ends; a short vertical dash marks a base.
   * opts: { rows: [{ name, a, b, reference?: number | [refA, refB], dim?: false }], aLabel?: 'a', bLabel?: 'b',
   *         reference?: number (one base for every row; a row's own `reference` wins), referenceLabel?: 'all',
   *         format?: v => Math.round(v) + '%', min?: 0, max?: auto, sort?: false | 'a' | 'b' | 'diff',
   *         colors?: { a: grey, b: blue, up: blue, down: orange }, axis?: true (show the value axis) }
   * The connector is `up` when b > a and `down` otherwise. `dim: true` fades a row (a difference that is not significant).
   * A single base draws one dash through the row; a pair [refA, refB] draws the a-base above the line and the b-base below it.
   * Returns the ECharts instance.
   */
  function dumbbell(el, o) {
    const t = theme(), fmt = o.format || pct, C = { a: GREY, b: HI, up: HI, down: LO, ...(o.colors || {}) };
    const aL = o.aLabel || 'a', bL = o.bLabel || 'b', rL = o.referenceLabel || 'all';
    let rows = o.rows.map(r => ({ ...r, ref: r.reference != null ? r.reference : o.reference }));
    if (o.sort) rows = [...rows].sort((x, y) => (o.sort === 'diff' ? (y.b - y.a) - (x.b - x.a) : y[o.sort] - x[o.sort]));
    const refs = rows.flatMap(r => (r.ref == null ? [] : Array.isArray(r.ref) ? r.ref : [r.ref]));
    const all = rows.flatMap(r => [r.a, r.b]).concat(refs), lo = Math.min(...all), hi = Math.max(...all);
    const min = o.min != null ? o.min : Math.min(0, lo), step = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, hi - min)))) / 2;
    const max = o.max != null ? o.max : Math.ceil((hi + (hi - min) * 0.06) / step) * step;                  // a round axis end just above the largest value
    const lw = labelWidth(el, rows.map(r => r.name), 0.36), op = r => (r.dim ? 0.3 : 1);
    const dot = (key, col, other) => ({ type: 'scatter', name: key === 'a' ? aL : bL, z: 3, symbolSize: 14, cursor: 'default', itemStyle: { color: col },
      data: rows.map((r, i) => ({ value: [r[key], i], itemStyle: { color: col, opacity: op(r) },
        label: { show: true, position: r[key] <= r[other] ? 'left' : 'right', distance: 7, color: col, opacity: op(r), fontWeight: 600, fontSize: 11.5, formatter: fmt(r[key]) } })) });
    const line = (p, api) => { const i = api.value(2), r = rows[i], A = api.coord([api.value(0), i]), B = api.coord([api.value(1), i]);
      return { type: 'line', shape: { x1: A[0], y1: A[1], x2: B[0], y2: B[1] }, style: { stroke: r.b > r.a ? C.up : C.down, lineWidth: 6, opacity: r.dim ? 0.15 : 0.4 } }; };
    const tick = (p, api) => { const i = api.value(2), r = rows[i], y = api.coord([0, i])[1], st = { stroke: t.muted, lineWidth: 1.6, opacity: op(r) };
      if (r.ref == null) return null;
      if (!Array.isArray(r.ref)) { const x = api.coord([r.ref, i])[0]; return { type: 'line', shape: { x1: x, y1: y - 10, x2: x, y2: y + 10 }, style: st }; }
      const xa = api.coord([r.ref[0], i])[0], xb = api.coord([r.ref[1], i])[0];
      return { type: 'group', children: [{ type: 'line', shape: { x1: xa, y1: y - 11, x2: xa, y2: y - 1 }, style: st }, { type: 'line', shape: { x1: xb, y1: y + 1, x2: xb, y2: y + 11 }, style: st }] }; };
    return mount(el, {
      legend: { top: 0, left: 0, data: [aL, bL], icon: 'circle', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex], d = r.b - r.a;
        return '<b>' + r.name + '</b><br>' + aL + ': ' + fmt(r.a) + '<br>' + bL + ': ' + fmt(r.b) + ' (' + (d >= 0 ? '+' : '−') + fmt(Math.abs(d)) + ')'
          + (r.ref == null ? '' : '<br>' + rL + ': ' + (Array.isArray(r.ref) ? fmt(r.ref[0]) + ' / ' + fmt(r.ref[1]) : fmt(r.ref))) + (r.dim ? '<br><i>not significant</i>' : ''); } },
      grid: { left: lw + 46, right: 56, top: 30, bottom: o.axis === false ? 6 : 28 },
      xAxis: { type: 'value', min, max, show: o.axis !== false, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } },
        axisLabel: { color: t.muted, fontSize: 11, formatter: v => fmt(v) } },
      yAxis: { type: 'category', inverse: true, data: rows.map(r => r.name), axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break', formatter: (v, i) => (rows[i].dim ? '{d|' + v + '}' : v), rich: { d: { color: t.muted, fontSize: 12.5 } } } },
      series: [
        { type: 'custom', silent: true, z: 1, renderItem: line, data: rows.map((r, i) => [r.a, r.b, i]) },
        { type: 'custom', silent: true, z: 2, renderItem: tick, data: rows.map((r, i) => [r.a, r.b, i]) },
        dot('a', C.a, 'b'), dot('b', C.b, 'a') ] });
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.dumbbell = dumbbell;
})(window);
