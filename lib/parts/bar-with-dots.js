/* chart-gallery part — barWithDots. Loads after lib/charts.js; registers ChartKit.barWithDots. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const HI = '#2563EB', LO = '#F97316', WAVES = ['#CBD5E1', '#64748B', '#0F172A'];
  const sgn = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d);

  /**
   * Bar with dots — the effect of every item on the full base (bar) plus one coloured dot per wave, so stability across waves
   * is read at a glance. Confidence interval in the tooltip and, with `ci: true`, as a whisker across the bar.
   * opts: { items: [{ name, value, ci?, waves: [v per wave] }], waveNames?: ['wave 1', ...], waveColors?: [...] (light -> dark by default),
   *         unit?: '' ('pp', '%'), signed?: true (bars coloured by sign; false = one colour), reference?: color (the single bar colour when signed is false),
   *         flip?: false (swap the up / down colours, e.g. when the outcome is a bad one), ci?: false (draw the ± whisker),
   *         sort?: 'abs' | 'value' | false (default: 'abs' when signed, 'value' otherwise; largest on top), baseLabel?: 'full base',
   *         format?: (v) => string (default: signed values with a sign, 1 decimal) }
   * Returns the ECharts instance.
   */
  function barWithDots(el, o) {
    const t = theme(), signed = o.signed !== false, unit = o.unit || '', bl = o.baseLabel || 'full base';
    const fmt = o.format || (v => (signed ? sgn(v, 1) : v.toFixed(1))), W = o.waveColors || WAVES;
    const sort = o.sort === undefined ? (signed ? 'abs' : 'value') : o.sort;
    const items = sort === 'abs' ? [...o.items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) : sort === 'value' ? [...o.items].sort((a, b) => b.value - a.value) : [...o.items];
    const nw = Math.max(...items.map(d => (d.waves || []).length)), wn = k => (o.waveNames && o.waveNames[k]) || 'wave ' + (k + 1);
    const colorOf = d => (signed ? ((d.value >= 0) !== !!o.flip ? HI : LO) : (o.reference || '#7C3AED'));
    const lw = labelWidth(el, items.map(d => d.name), 0.36);
    const ch = echarts.init(el$(el), null, { renderer: 'svg' });
    ch.setOption({ animation: false, grid: { left: lw + 12, right: 20, top: nw ? 28 : 10, bottom: 30 },
      legend: nw ? { top: 0, right: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: t.muted, fontSize: 11 }, data: Array.from({ length: nw }, (_, k) => wn(k)) } : undefined,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const d = items[ps[0].dataIndex];
        return '<b>' + d.name + '</b><br>' + bl + ': ' + fmt(d.value) + unit + (d.ci != null ? ' ± ' + d.ci.toFixed(2) : '') + '<br>' + (d.waves || []).map((v, k) => wn(k) + ': ' + fmt(v) + unit).join('<br>'); } },
      xAxis: { type: 'value', axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted }, splitLine: { lineStyle: { color: t.line } } },
      yAxis: { type: 'category', inverse: true, data: items.map(d => d.name), axisTick: { show: false }, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted, fontSize: 11.5, width: lw, overflow: 'truncate' } },
      series: [
        { type: 'bar', barWidth: 12, data: items.map(d => ({ value: d.value, itemStyle: { color: colorOf(d), opacity: 0.75, borderRadius: 2 } })) },
        { type: 'custom', z: 4, silent: true, data: items.map((d, i) => [i]), renderItem: (q, api) => {                 // ± whisker across the bar
            const d = items[api.value(0)]; if (!o.ci || d.ci == null) return null;
            const l = api.coord([d.value - d.ci, api.value(0)]), r = api.coord([d.value + d.ci, api.value(0)]);
            return { type: 'line', shape: { x1: l[0], y1: l[1], x2: r[0], y2: r[1] }, style: { stroke: t.text, lineWidth: 2 } }; } },
        ...Array.from({ length: nw }, (_, k) => ({ type: 'scatter', name: wn(k), symbolSize: 9, z: 5, itemStyle: { color: W[k % W.length], borderColor: t.bg, borderWidth: 1 },
          data: items.map(d => (d.waves && d.waves[k] != null ? d.waves[k] : null)) })) ] });
    return ch;
  }
  global.ChartKit = global.ChartKit || {}; global.ChartKit.barWithDots = barWithDots;
})(window);
