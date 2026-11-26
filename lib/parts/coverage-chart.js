/* chart-gallery part — ChartKit.coverageChart: stacked columns of cumulative greedy coverage, one column per item (tag). */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const fnum = v => Math.round(v).toLocaleString('en-US');

  /**
   * Greedy order: the item covering most ids first, then the item adding most new ids, and so on. Returns { items, covered, added, total }.
   * sets: { [item]: [id, ...] }; `total` is the size of the universe (default: the union of all sets).
   */
  function greedyCoverage(sets, total) {
    const S = {}; Object.keys(sets).forEach(k => { S[k] = new Set(sets[k]); });
    const left = new Set(Object.keys(S)), seen = new Set(), items = [], covered = [], added = [];
    const union = new Set(); Object.values(S).forEach(s => s.forEach(id => union.add(id)));
    while (left.size) {
      let best = null, gain = -1;
      left.forEach(k => { let g = 0; S[k].forEach(id => { if (!seen.has(id)) g++; }); if (g > gain) { gain = g; best = k; } });
      left.delete(best); S[best].forEach(id => seen.add(id)); items.push(best); added.push(gain); covered.push(seen.size);
    }
    return { items, covered, added, total: total || union.size };
  }

  /**
   * Coverage chart — how much of the base each successive item (tag, rule, feature) covers: for every column, grey = already covered
   * by the items before it, blue = newly covered by this one, "+N" on top; the plateau shows where more items stop adding reach.
   * Input is either precomputed `{ items, covered, added }` (cumulative counts in the given order) or raw `sets` — then the greedy
   * order is computed here. Columns after the last item that adds at least `minGain` of the total are separated by a dashed line.
   * opts: { items?: [name], covered?: [cumulative count], added?: [new count], sets?: { [item]: [ids] }, total?: base size,
   *         minGain?: 0.005, colors?: { covered?, added? }, coveredLabel?: 'already covered', addedLabel?: 'newly covered',
   *         plateauLabel?: 'adds less than 0.5% each', format?: v => string, onClick?: (item, index) => void }
   * Returns the ECharts instance.
   */
  function coverageChart(el, o) {
    const t = theme(), d = o.sets ? greedyCoverage(o.sets, o.total) : { items: o.items, covered: o.covered, added: o.added || o.covered.map((v, i) => v - (i ? o.covered[i - 1] : 0)), total: o.total };
    const total = o.total || d.total || Math.max(...d.covered), fmt = o.format || fnum, minGain = o.minGain == null ? 0.005 : o.minGain;
    const colCov = (o.colors && o.colors.covered) || 'rgba(148,163,184,.45)', colAdd = (o.colors && o.colors.added) || '#2563EB';
    const before = d.covered.map((v, i) => v - d.added[i]);
    let useful = 0; d.added.forEach((g, i) => { if (g / total >= minGain) useful = i + 1; });
    const n = d.items.length, rot = n > 8 ? 50 : 0, bottom = rot ? Math.min(150, 20 + Math.max(...d.items.map(s => s.length)) * 5.6) : 36;
    const ch = mount(el, {
      animation: false,
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const i = ps[0].dataIndex;
        return '<b>' + (i + 1) + '. ' + d.items[i] + '</b><br>' + (o.addedLabel || 'newly covered') + ': ' + fmt(d.added[i]) + '<br>' + (o.coveredLabel || 'already covered') + ': ' + fmt(before[i]) + '<br>total ' + fmt(d.covered[i]) + ' of ' + fmt(total) + ' (' + Math.round(100 * d.covered[i] / total) + '%)'; } },
      grid: { left: 56, right: 16, top: 36, bottom },
      xAxis: { type: 'category', data: d.items, axisTick: { show: false }, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.text, fontSize: 11.5, interval: 0, rotate: rot, width: rot ? undefined : 90, overflow: 'break' }, triggerEvent: !!o.onClick },
      yAxis: { type: 'value', min: 0, max: total, interval: total / 4, axisLabel: { color: t.muted, formatter: v => Math.round(100 * v / total) + '%' }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } } },
      series: [
        { type: 'bar', name: o.coveredLabel || 'already covered', stack: 'c', data: before, barWidth: '64%', itemStyle: { color: colCov, borderRadius: [0, 0, 3, 3] }, emphasis: { disabled: true }, cursor: o.onClick ? 'pointer' : 'default' },
        { type: 'bar', name: o.addedLabel || 'newly covered', stack: 'c', data: d.added.map(v => Math.max(v, 0)), itemStyle: { color: colAdd, borderRadius: [3, 3, 0, 0] }, emphasis: { disabled: true }, cursor: o.onClick ? 'pointer' : 'default',
          label: { show: true, position: 'top', distance: 4, fontSize: 10.5, formatter: p => (d.added[p.dataIndex] > 0 ? '+' + fmt(d.added[p.dataIndex]) : '+0'), color: t.text },
          markLine: useful > 0 && useful < n ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: t.muted }, data: [{ xAxis: useful - 0.5, label: { show: true, position: 'insideEndTop', rotate: 0, align: 'left', distance: [6, 4], formatter: o.plateauLabel || 'adds less than ' + (minGain * 100) + '% each', color: t.muted, fontSize: 11 } }] } : undefined },
      ] });
    if (o.onClick) ch.on('click', p => { if (p.componentType === 'series') o.onClick(d.items[p.dataIndex], p.dataIndex); else if (p.componentType === 'xAxis') o.onClick(p.value, d.items.indexOf(p.value)); });
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.coverageChart = coverageChart; global.ChartKit.greedyCoverage = greedyCoverage;
})(window);
