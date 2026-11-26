/* chart-gallery part — contributionWaterfall. Loads after lib/charts.js; registers ChartKit.contributionWaterfall. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const HI = '#2563EB', LO = '#F97316', NEUTRAL = '#B6C0CC';
  const sgn = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d);

  /**
   * Contribution waterfall — how a group gets from a reference value to its own value: one horizontal step per factor,
   * sorted by absolute size, then a dashed "all factors together" bar and a grey residual bar for what the factors do not explain.
   * opts: { start: { label, value }, end: { label, value }, steps: [{ name, value, ci? }], unit?: '%' (start / end), stepUnit?: 'pp',
   *         summaryLabel?: 'all factors together' | false, residualLabel?: 'not explained' | false (residual = end − start − Σ steps),
   *         sort?: true (by |value|, largest first), colors?: { up, down, total, rest }, format?: (v, digits) => string }
   * Steps are stacked on a transparent base so each bar starts where the previous one ended. Returns the ECharts instance.
   */
  function contributionWaterfall(el, o) {
    const t = theme(), unit = o.unit == null ? '%' : o.unit, su = o.stepUnit == null ? 'pp' : o.stepUnit, fmt = o.format || sgn;
    const C = { up: HI, down: LO, total: t.text, rest: NEUTRAL, ...(o.colors || {}) };
    const steps = o.sort === false ? [...o.steps] : [...o.steps].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const sum = steps.reduce((s, x) => s + x.value, 0), rest = o.end.value - o.start.value - sum;
    const rows = steps.map(s => ({ ...s, kind: 'step' }));
    if (o.summaryLabel !== false) rows.push({ name: o.summaryLabel || 'all factors together', value: sum, kind: 'summary' });
    if (o.residualLabel !== false) rows.push({ name: o.residualLabel || 'not explained', value: rest, kind: 'rest' });
    const cats = [o.start.label, ...rows.map(r => r.name), o.end.label];
    let run = o.start.value; const base = [0], val = [{ value: o.start.value, kind: 'total', itemStyle: { color: C.total, borderRadius: 3 } }];
    rows.forEach(r => {
      const col = r.kind === 'rest' ? C.rest : r.value >= 0 ? C.up : C.down;
      if (r.kind === 'summary') { base.push(Math.min(o.start.value, o.start.value + r.value));
        val.push({ value: Math.abs(r.value), raw: r.value, kind: r.kind, label: { opacity: 1, fontWeight: 600, color: t.text }, itemStyle: { color: col, opacity: 0.4, borderColor: col, borderWidth: 1.5, borderType: 'dashed', borderRadius: 3 } }); return; }
      base.push(Math.min(run, run + r.value)); run += r.value;
      val.push({ value: Math.abs(r.value), raw: r.value, ci: r.ci, kind: r.kind, itemStyle: { color: col, borderRadius: 3 } });
    });
    base.push(0); val.push({ value: o.end.value, kind: 'total', itemStyle: { color: C.total, borderRadius: 3 } });
    const edges = [o.start.value, o.end.value, ...base.slice(1, -1), ...base.slice(1, -1).map((b, i) => b + val[i + 1].value)];
    const lo = Math.floor(Math.min(...edges) - 1), hi = Math.ceil(Math.max(...edges) + 1), lw = labelWidth(el, cats, 0.38);
    const ch = echarts.init(el$(el), null, { renderer: 'svg' });
    ch.setOption({ animation: false, grid: { left: lw + 12, right: 70, top: 10, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const i = ps[0].dataIndex, v = val[i];
        if (v.kind === 'total') return '<b>' + cats[i] + '</b><br>' + v.value.toFixed(1) + unit;
        if (v.kind === 'summary') return '<b>' + cats[i] + '</b><br>' + fmt(v.raw, 2) + ' ' + su + ' — the sum of the steps above';
        return '<b>' + cats[i] + '</b><br>' + fmt(v.raw, 2) + ' ' + su + (v.ci != null ? ' ± ' + v.ci.toFixed(2) : ''); } },
      xAxis: { type: 'value', min: lo, max: hi, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted }, splitLine: { lineStyle: { color: t.line } } },
      yAxis: { type: 'category', data: cats, inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: t.line } },
        axisLabel: { color: t.muted, fontSize: 12, width: lw, overflow: 'truncate', formatter: (v, i) => (val[i].kind === 'summary' || val[i].kind === 'total' ? '{b|' + v + '}' : v), rich: { b: { fontWeight: 600, color: t.text } } } },
      series: [{ type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, data: base },
        { type: 'bar', stack: 'w', barWidth: 14, data: val, label: { show: true, position: 'right', color: t.muted, fontSize: 12,
          formatter: q => (q.data.kind === 'total' ? q.value.toFixed(1) + unit : fmt(q.data.raw)) } }] });
    return ch;
  }
  global.ChartKit = global.ChartKit || {}; global.ChartKit.contributionWaterfall = contributionWaterfall;
})(window);
