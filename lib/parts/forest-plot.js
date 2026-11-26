/* chart-gallery part: ChartKit.forestPlot — model coefficients with 95% intervals, significant rows coloured. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const HI = '#2563EB', LO = '#F97316', NEUTRAL = '#B6C0CC';

  /**
   * Forest plot — one model estimate per row with its 95% interval; the reference line is 0 for differences or 1 for ratios.
   * opts: { rows: [{ name, est, lo, hi, p?, sig? }], scale?: 'diff' | 'ratio' (log10 axis labelled as multipliers, reference 1), unit?: 'pp',
   *         alpha?: 0.05, sort?: true (largest estimate on top), decimals?: 1 for diff / 2 for ratio, nsLabel?: '' (appended to
   *         labels of non-significant rows, e.g. '(n.s.)'), format?: v => string (one value), xName?: '',
   *         colors?: { pos: blue, neg: orange, ns: grey } }
   * A row is significant when `sig` is given, else when `p < alpha`, else when the interval excludes the reference. Significant rows
   * get a coloured point (above / below the reference), a dark whisker and a bold label "+3.2 pp [1.1; 5.3]" (ratio: "×1.35 [1.10; 1.66]");
   * the rest are grey. Returns the ECharts instance.
   */
  function forestPlot(el, o) {
    const t = theme(), ratio = o.scale === 'ratio', ref = ratio ? 1 : 0, unit = o.unit == null ? 'pp' : o.unit, alpha = o.alpha || 0.05;
    const dec = o.decimals != null ? o.decimals : ratio ? 2 : 1, C = { pos: HI, neg: LO, ns: NEUTRAL, ...(o.colors || {}) };
    const num = v => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(dec);
    const one = o.format || (ratio ? v => '×' + num(v) : v => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v)) + (unit ? ' ' + unit : ''));
    const rows = o.rows.map(r => ({ ...r, sig: r.sig != null ? !!r.sig : r.p != null ? r.p < alpha : (r.lo > ref || r.hi < ref) }));
    if (o.sort !== false) rows.sort((a, b) => a.est - b.est);                                          // category axis grows upwards: last row = largest estimate = top
    const text = r => one(r.est) + ' [' + (ratio ? num(r.lo) : (r.lo < 0 ? '−' : '') + num(Math.abs(r.lo))) + '; ' + (ratio ? num(r.hi) : (r.hi < 0 ? '−' : '') + num(Math.abs(r.hi))) + ']' + (!r.sig && o.nsLabel ? ' ' + o.nsLabel : '');
    const lw = labelWidth(el, rows.map(r => r.name), 0.36), rw = Math.max(...rows.map(r => text(r).length)) * 6.9 + 24;
    const loMin = Math.min(ref, ...rows.map(r => r.lo)), hiMax = Math.max(ref, ...rows.map(r => r.hi));
    const X = v => (ratio ? Math.log10(v) : v), span = X(hiMax) - X(loMin), pad = span * 0.05;        // ratios are plotted on log10 and labelled back as multipliers
    const base = ratio ? [1.1, 1.25, 1.5, 2, 3, 10].find(b => span / Math.log10(b) <= 7) || 10 : null, trim = v => String(Math.round(v * 100) / 100);
    const xAxis = ratio
      ? { type: 'value', min: Math.floor((X(loMin) - pad) / Math.log10(base)) * Math.log10(base), max: Math.ceil((X(hiMax) + pad) / Math.log10(base)) * Math.log10(base),
          interval: Math.log10(base), axisLabel: { formatter: v => '×' + trim(Math.pow(10, v)) } }                    // ticks at powers of `base`, so ×1 is always one of them
      : { type: 'value', min: loMin - pad, max: hiMax + pad, axisLabel: { formatter: v => (v > 0 ? '+' : '') + trim(v) } };
    const colorOf = r => (!r.sig ? C.ns : r.est >= ref ? C.pos : C.neg);
    const whisker = (p, api) => { const i = api.value(2), r = rows[i], A = api.coord([api.value(0), i]), B = api.coord([api.value(1), i]);
      return { type: 'line', shape: { x1: A[0], y1: A[1], x2: B[0], y2: B[1] }, style: { stroke: r.sig ? t.text : t.muted, lineWidth: r.sig ? 2 : 1.4, opacity: r.sig ? 1 : 0.6 } }; };
    return mount(el, {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex];
        return '<b>' + r.name + '</b><br>' + text(r) + (r.p != null ? '<br>p = ' + (r.p < 0.001 ? '< 0.001' : r.p.toFixed(3)) : '') + '<br>' + (r.sig ? 'significant' : 'not significant'); } },
      grid: { left: lw + 10, right: rw, top: 10, bottom: o.xName ? 44 : 26 },
      xAxis: { ...xAxis, name: o.xName || '', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } }, axisLabel: { ...xAxis.axisLabel, color: t.muted, fontSize: 11, showMinLabel: false, showMaxLabel: false } },
      yAxis: { type: 'category', data: rows.map(r => r.name), axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break', formatter: (v, i) => (rows[i].sig ? v : '{d|' + v + '}'), rich: { d: { color: t.muted, fontSize: 12.5 } } } },
      series: [
        { type: 'custom', silent: true, z: 1, renderItem: whisker, data: rows.map((r, i) => [X(r.lo), X(r.hi), i]),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, width: 1 }, label: { show: false }, data: [{ xAxis: X(ref) }] } },
        { type: 'scatter', z: 3, symbolSize: 12, cursor: 'default', data: rows.map((r, i) => ({ value: [X(r.est), i], itemStyle: { color: colorOf(r), borderColor: t.bg, borderWidth: 1 } })) },
        { type: 'scatter', z: 2, silent: true, symbolSize: 0, data: rows.map((r, i) => ({ value: [X(r.hi), i],
          label: { show: true, position: 'right', distance: 8, fontSize: 11.5, color: r.sig ? t.text : t.muted, fontWeight: r.sig ? 700 : 400, formatter: text(r) } })) } ] });
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.forestPlot = forestPlot;
})(window);
