/* chart-gallery part — rankBump. Loads after lib/charts.js; registers ChartKit.rankBump. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const rankOf = v => { const o = v.map((x, i) => i).sort((a, b) => v[b] - v[a]), r = []; o.forEach((i, k) => { r[i] = k + 1; }); return r; };   // 1 = largest value

  /**
   * Rank bump — the place of every item in each wave (1 on top). Items that moved by `minMove` places or more between any two
   * waves are coloured, the rest stay grey; the end label is "name (+k)" / "name (−k)" with the net change from the first wave
   * to the last (a plus means the item climbed). Hover a line to focus it.
   * opts: { waves: ['wave 1', 'wave 2', 'wave 3'], items: [{ name, ranks?: [r per wave], values?: [v per wave] }],
   *         minMove?: 5, color?: '#7C3AED' (moved lines), grey?: muted colour, format?: (name, net, span) => label }
   * Give `ranks` directly or `values` (ranks are then computed per wave, largest value = rank 1). Returns the ECharts instance.
   */
  function rankBump(el, o) {
    const t = theme(), min = o.minMove == null ? 5 : o.minMove, hot = o.color || '#7C3AED', grey = o.grey || t.muted, n = o.items.length, nw = o.waves.length;
    const ranks = o.items.map(d => d.ranks ? d.ranks.slice() : []);
    if (o.items.some(d => !d.ranks)) for (let k = 0; k < nw; k++) { const r = rankOf(o.items.map(d => d.values[k])); o.items.forEach((d, i) => { if (!d.ranks) ranks[i][k] = r[i]; }); }
    const span = ranks.map(r => Math.max(...r) - Math.min(...r)), net = ranks.map(r => r[0] - r[r.length - 1]);
    const label = o.format || ((name, nt, sp) => name + (sp >= min ? ' (' + (nt > 0 ? '+' : nt < 0 ? '−' : '±') + Math.abs(nt || sp) + ')' : ''));
    const lw = labelWidth(el, o.items.map((d, i) => label(d.name, net[i], span[i])), 0.42);
    const ch = echarts.init(el$(el), null, { renderer: 'svg' });
    ch.setOption({ animation: false, grid: { left: 34, right: lw + 16, top: 18, bottom: 36 },
      tooltip: { trigger: 'item', formatter: q => { const i = q.seriesIndex; return '<b>' + o.items[i].name + '</b><br>' + o.waves.map((w, k) => w + ': ' + ranks[i][k]).join(' → ') + (span[i] >= min ? '<br>moved by ' + span[i] + ' places or more' : ''); } },
      xAxis: { type: 'category', data: o.waves, boundaryGap: false, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted }, splitLine: { show: false } },
      yAxis: { type: 'value', inverse: true, min: 1, max: n, interval: 1, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted, fontSize: 11 }, splitLine: { show: false } },
      series: o.items.map((d, i) => { const on = span[i] >= min, c = on ? hot : grey;
        return { type: 'line', name: d.name, data: ranks[i], symbolSize: 6, emphasis: { focus: 'series', lineStyle: { width: 3 } },
          lineStyle: { width: on ? 2.2 : 1.3, color: c, opacity: on ? 1 : 0.5 }, itemStyle: { color: c },
          endLabel: { show: true, formatter: () => label(d.name, net[i], span[i]), color: on ? t.text : t.muted, fontSize: 11, width: lw, overflow: 'truncate' } }; }) });
    return ch;
  }
  global.ChartKit = global.ChartKit || {}; global.ChartKit.rankBump = rankBump;
})(window);
