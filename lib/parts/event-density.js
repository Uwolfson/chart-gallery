/* chart-gallery part — ChartKit.eventDensity. Loads after lib/charts.js (uses the global `echarts` and ChartKit.PALETTE if present). */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const palette = () => (global.ChartKit && global.ChartKit.PALETTE) || ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const num1 = v => String(Math.round(v * 10) / 10), pct = v => Math.round(v) + '%';
  const fmtMin = m => (m < 1 ? Math.round(m * 60) + ' s' : m < 60 ? (m < 10 ? num1(m) : Math.round(m)) + ' min' : m < 1440 ? num1(m / 60) + ' h' : num1(m / 1440) + ' d');   // minutes -> '30 s', '2.5 min', '1.5 h'
  const TICKS = [0.5, 1, 2, 5, 10, 30, 60, 120, 360, 1440];

  /** Gaussian KDE on log10(time), evaluated on `grid` (same unit as `times`), scaled so the peak is 1. `bw` is a multiple of the std of log10 time. */
  function kde(times, grid, bw) {
    const x = times.map(v => Math.log10(Math.max(0.1, v))); if (x.length < 2) return grid.map(() => 0);
    const m = x.reduce((a, b) => a + b, 0) / x.length, sd = Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / x.length) || 0.3, h = (bw || 0.25) * sd;
    const d = grid.map(g => { const lg = Math.log10(g); let s = 0; for (const xi of x) { const z = (lg - xi) / h; s += Math.exp(-0.5 * z * z); } return s; });
    const mx = Math.max(...d) || 1; return d.map(v => v / mx);
  }
  /** Cumulative share (0–100) of `times` that are <= each grid value. */
  const cum = (times, grid) => { const s = [...times].sort((a, b) => a - b); return grid.map(g => { let k = 0; while (k < s.length && s[k] <= g) k++; return s.length ? 100 * k / s.length : 0; }); };

  /**
   * Event density — when things happen after a key moment (a booking, a sign-up): one smoothed curve per channel on a log time axis.
   * Each curve is a kernel density of log10(time) with its peak scaled to 1, so the shapes are compared, not the volumes; the tooltip
   * shows the cumulative share of that channel's events by the moment under the cursor. Dashed verticals mark milestones.
   * opts: { channels: [{ name, times?: [minutes since the key moment], curve?: [density per grid point], cum?: [cumulative % per grid point],
   *                       color?, area?: false, dash?: 'solid' | 'dashed' }],
   *         grid?: [time values the curves are evaluated on] (default 120 log-spaced points from tMin to tMax plus the ticks),
   *         tMin?: 0.3, tMax?: 1440, bandwidth?: 0.25, ticks?: [0.5, 1, 2, 5, 10, 30, 60, 120, 360, 1440], formatTime?: minutes => string,
   *         milestones?: [{ t, label }], xName?: 'time since booking', cumLabel?: 'by this moment', legend?: true }
   * Time is in minutes by default; pass `ticks`, `tMin`, `tMax` and `formatTime` for another unit. `times` are raw observations (the KDE is
   * computed here); `curve` + `cum` are precomputed alternatives, aligned with `grid`. Returns the ECharts instance.
   */
  function eventDensity(el, o) {
    const t = theme(), P = palette(), fmt = o.formatTime || fmtMin, tMin = o.tMin || 0.3, tMax = o.tMax || 1440, ticks = (o.ticks || TICKS).filter(v => v >= tMin && v <= tMax);
    let grid = o.grid;
    if (!grid) { const a = Math.log10(tMin), b = Math.log10(tMax), n = 120; grid = Array.from({ length: n + 1 }, (_, i) => Math.pow(10, a + (b - a) * i / n)); }
    grid = [...new Set(grid.concat(ticks).concat((o.milestones || []).map(m => m.t)).filter(v => v >= tMin && v <= tMax))].sort((a, b) => a - b);
    const near = v => { let best = 0; grid.forEach((g, i) => { if (Math.abs(Math.log(g / v)) < Math.abs(Math.log(grid[best] / v))) best = i; }); return best; };
    const tickIdx = new Set(ticks.map(near));
    const ch = o.channels.map((c, i) => ({ ...c, color: c.color || P[i % P.length], curve: c.curve || kde(c.times || [], grid, o.bandwidth), cumArr: c.cum || cum(c.times || [], grid) }));
    const marks = (o.milestones || []).map(m => ({ name: m.label || fmt(m.t), xAxis: near(m.t) }));
    const inst = mount(el, { animation: false, grid: { left: 16, right: 24, top: 30, bottom: 44 },
      legend: o.legend === false ? undefined : { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' }, formatter: ps => { const j = ps[0].dataIndex;
        return '<b>' + fmt(grid[j]) + (o.xName ? ' — ' + o.xName : '') + '</b><br>' + ps.map(p => p.marker + p.seriesName + ': ' + (o.cumLabel || 'by this moment') + ' ' + pct(ch[p.seriesIndex].cumArr[j])).join('<br>'); } },
      xAxis: { type: 'category', boundaryGap: false, data: grid.map(fmt), axisTick: { show: false }, splitLine: { show: false }, axisLine: { lineStyle: { color: t.line } },
        axisLabel: { color: t.muted, interval: i => tickIdx.has(i) }, name: o.xName || '', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted } },
      yAxis: { type: 'value', min: 0, max: 1.08, axisLabel: { show: false }, splitLine: { lineStyle: { color: t.line, opacity: 0.6 } } },
      series: ch.map((c, i) => ({ name: c.name, type: 'line', showSymbol: false, smooth: true, data: c.curve, lineStyle: { width: 2, color: c.color, type: c.dash || 'solid' }, itemStyle: { color: c.color },
        areaStyle: c.area ? { color: c.color, opacity: 0.08 } : undefined,
        markLine: i === 0 && marks.length ? { silent: true, symbol: 'none', data: marks, lineStyle: { color: t.muted, type: 'dashed', opacity: 0.7 },
          label: { formatter: p => p.name, color: t.muted, fontSize: 10.5, position: 'insideEndTop' } } : undefined })) });
    global.addEventListener('resize', () => inst.resize());
    return inst;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.eventDensity = eventDensity; global.ChartKit.kdeLog = kde;
})(window);
