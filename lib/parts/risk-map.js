/* chart-gallery part — ChartKit.riskMap. Loads after lib/charts.js (uses the global `echarts` and ChartKit.PALETTE if present). */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const palette = () => (global.ChartKit && global.ChartKit.PALETTE) || ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const num1 = v => String(Math.round(v * 10) / 10), fmtN = v => Number(v).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Wilson 95% interval for k successes out of n, in percent: [low, high]. */
  function wilson(k, n, z) {
    z = z || 1.96; if (!n) return [0, 0];
    const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [100 * (c - h), 100 * (c + h)];
  }

  /**
   * Risk map — "ways to lose a session": how common a bad event is (x, log scale) against how often people leave without the
   * outcome right after it (y). Bubble area = number of sessions lost that way; colour = stage / category; a hollow bubble means
   * the estimate rests on too few cases; the whisker is the 95% Wilson interval; the dashed line is the background rate of an
   * ordinary action. Italic captions name the quadrants ("rare but deadly", ...).
   * opts: { events: [{ name, note?, category?, x: % of sessions where it happens, n: sessions where it happened, k: of them lost
   *                     (y = 100 k / n), y?: given instead of k, labelPosition?: 'right' }],
   *         background: % lost after an ordinary action, backgroundLabel?: 'background', minN?: 50 (hollow below), hideBelow?: 0 (not drawn),
   *         ci?: true, colors?: { [category]: color }, labelPositions?: { [name]: 'left' | 'right' | 'top' | 'bottom' },
   *         quadrants?: { topLeft?, topRight?, bottomLeft?, bottomRight? } (captions),
   *         zone?: { x?: 5, factor?: 2, label?: 'mass killers' } (shaded area x >= zone.x and y >= factor * background),
   *         xName?, yName?, xMin?: 0.1, xMax?: 100, yMax?, lostLabel?: 'sessions lost', tooltip?: event => html }
   * Returns the ECharts instance. Events are also available as `event.ci`, `event.lift`, `event.k` on the returned `events` property.
   */
  function riskMap(el, o) {
    const t = theme(), P = palette(), ci = o.ci !== false, minN = o.minN == null ? 50 : o.minN, hide = o.hideBelow || 0, lost = o.lostLabel || 'sessions lost';
    const cats = [...new Set(o.events.map(e => e.category || ''))];
    const color = e => (o.colors && o.colors[e.category]) || P[cats.indexOf(e.category || '') % P.length];
    const events = o.events.map(e => { const n = e.n || 0, k = e.k != null ? e.k : (e.y != null ? Math.round(e.y * n / 100) : 0), y = e.y != null ? e.y : (n ? 100 * k / n : 0);
      return { ...e, n, k, y, ci: wilson(k, n), lift: o.background ? y / o.background : null, color: color(e) }; });
    const shown = events.filter(e => e.n >= hide), maxK = Math.max(1, ...shown.map(e => e.k));
    const size = e => 10 + 46 * Math.sqrt(e.k / maxK);
    const pos = e => e.labelPosition || (o.labelPositions && o.labelPositions[e.name]) || 'right';
    const yMax = o.yMax || Math.min(100, Math.ceil((Math.max(...shown.map(e => ci ? e.ci[1] : e.y)) + 5) / 10) * 10);
    const xMin = o.xMin || 0.1, xMax = o.xMax || 100, grid = { left: 64, right: 30, top: 30, bottom: 60 };
    const tip = e => '<b>' + esc(e.name) + '</b>' + (e.note ? ' · <i>' + esc(e.note) + '</i>' : '') + '<br>happened in ' + fmtN(e.n) + ' sessions (' + num1(e.x) + '%)'
      + '<br>lost right after it: <b>' + num1(e.y) + '%</b>' + (e.n ? ' (95%: ' + Math.round(e.ci[0]) + '–' + Math.round(e.ci[1]) + '%)' : '')
      + (e.lift != null ? ', ' + num1(e.lift) + '× the background' : '') + '<br>' + lost + ': ' + fmtN(e.k);
    const caption = (text, place) => ({ type: 'text', silent: true, ...place, style: { text, fill: t.muted, fontSize: 13, fontWeight: 600, fontStyle: 'italic' } });
    const q = o.quadrants || {}, graphic = [];
    if (q.topLeft) graphic.push(caption(q.topLeft, { left: grid.left + 16, top: grid.top + 6 }));
    if (q.topRight) graphic.push(caption(q.topRight, { right: grid.right + 10, top: grid.top + 6 }));
    if (q.bottomLeft) graphic.push(caption(q.bottomLeft, { left: grid.left + 16, bottom: grid.bottom + 10 }));
    if (q.bottomRight) graphic.push(caption(q.bottomRight, { right: grid.right + 10, bottom: grid.bottom + 10 }));
    const series = [];
    if (ci) series.push({ type: 'custom', silent: true, z: 1, data: [[xMin, 0]], renderItem: (params, api) => ({ type: 'group', children: shown.map(e => {
      const a = api.coord([e.x, e.ci[0]]), b = api.coord([e.x, e.ci[1]]);
      return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: e.color, opacity: 0.35, lineWidth: 2 } }; }) }) });
    const scatter = { type: 'scatter', z: 3, data: shown.map(e => ({ value: [e.x, e.y], e, symbolSize: size(e), label: { position: pos(e) },
        itemStyle: { color: e.n >= minN ? e.color : t.bg, borderColor: e.color, borderWidth: 2, opacity: 0.88 } })),
      label: { show: true, formatter: p => '{a|' + p.data.e.name + '}' + (p.data.e.note ? '\n{b|' + p.data.e.note + '}' : ''),
        rich: { a: { color: t.text, fontSize: 12.5, fontWeight: 700, lineHeight: 16 }, b: { color: t.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 14 } } },
      labelLayout: { moveOverlap: 'shiftY' } };
    if (o.background != null) scatter.markLine = { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' }, data: [{ yAxis: o.background }],
      label: { formatter: (o.backgroundLabel || 'background') + ': ' + num1(o.background) + '%', position: 'insideStartTop', color: t.muted } };
    if (o.zone && o.background != null) scatter.markArea = { silent: true, itemStyle: { color: '#E11D48', opacity: 0.07 }, label: { color: '#E11D48', fontWeight: 700, position: 'insideTopRight' },
      data: [[{ name: o.zone.label || '', coord: [o.zone.x || 5, o.background * (o.zone.factor || 2)] }, { coord: [xMax, yMax] }]] };
    series.push(scatter);
    const ch = mount(el, { animation: false, grid, graphic,
      xAxis: { type: 'log', min: xMin, max: xMax, name: o.xName || '', nameLocation: 'middle', nameGap: 36, nameTextStyle: { color: t.muted, fontWeight: 600 },
        axisLabel: { color: t.muted, formatter: v => (v < 1 ? num1(v) : Math.round(v)) + '%' }, axisLine: { lineStyle: { color: t.line } }, splitLine: { lineStyle: { color: t.line, opacity: 0.6 } } },
      yAxis: { type: 'value', min: 0, max: yMax, name: o.yName || '', nameLocation: 'middle', nameGap: 44, nameTextStyle: { color: t.muted, fontWeight: 600 },
        axisLabel: { color: t.muted, formatter: v => v + '%' }, splitLine: { lineStyle: { color: t.line, opacity: 0.6 } } },
      tooltip: { trigger: 'item', formatter: p => (p.data && p.data.e ? (o.tooltip || tip)(p.data.e) : '') },
      series });
    ch.events = events;
    global.addEventListener('resize', () => ch.resize());
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.riskMap = riskMap; global.ChartKit.wilson = wilson;
})(window);
