/* chart-gallery part — penaltyRewardMap. Loads after lib/charts.js; registers ChartKit.penaltyRewardMap. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const ZONES = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
  const ZONE_COLORS = { topLeft: '#2563EB', topRight: '#7C3AED', bottomRight: '#E11D48', bottomLeft: '#94A3B8' };
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);

  /**
   * Penalty–reward map — a quadrant map of attributes: x = penalty (how much a bad attribute pushes people away),
   * y = reward (how much a good one pulls them in). Dashed lines at the two means split four zones; point colour = zone.
   * opts: { points: [{ name, x, y, xCi?, yCi? }], xName?, yName? (axis titles), xLabel?: 'penalty', yLabel?: 'reward' (short names for the tooltip and the table), unit?: 'pp',
   *         zones?: { topLeft: 'attract', topRight: 'key', bottomRight: 'basic', bottomLeft: 'secondary' } (names shown in the corners, the table and tooltips),
   *         zoneColors?: { topLeft, topRight, bottomRight, bottomLeft }, ci?: false (draw the ± crosshair behind every point),
   *         highlight?: name | null (that point full size and labelled, the others at opacity .25 — for small multiples),
   *         compact?: false (small fonts and margins, labels only for the highlighted point), xRange?: [lo, hi], yRange?: [lo, hi] (shared scale),
   *         table?: element | id | true | false (zone table under the chart: `true` creates a div right after the chart), format?: v => string }
   * Labels are de-overlapped greedily from top to bottom; a label that had to move gets a leader line. Returns the ECharts instance.
   */
  function penaltyRewardMap(el, o) {
    const node = el$(el), t = theme(), P = o.points, n = P.length, unit = o.unit == null ? 'pp' : o.unit, fmt = o.format || sgn, compact = !!o.compact, hl = o.highlight || null;
    const xl = o.xLabel || 'penalty', yl = o.yLabel || 'reward';
    const names = { topLeft: 'attract', topRight: 'key', bottomRight: 'basic', bottomLeft: 'secondary', ...(o.zones || {}) };
    const colors = { ...ZONE_COLORS, ...(o.zoneColors || {}) };
    const mx = P.reduce((s, p) => s + p.x, 0) / n, my = P.reduce((s, p) => s + p.y, 0) / n;
    const zone = p => (p.y >= my ? (p.x >= mx ? 'topRight' : 'topLeft') : (p.x >= mx ? 'bottomRight' : 'bottomLeft'));
    const color = p => colors[zone(p)];
    const spread = o.ci ? P.flatMap(p => [p.x - (p.xCi || 0), p.x + (p.xCi || 0), p.y - (p.yCi || 0), p.y + (p.yCi || 0)]) : P.flatMap(p => [p.x, p.y]);
    const lo = o.xRange ? o.xRange[0] : Math.floor(Math.min(-1, ...spread)), hi = Math.ceil(Math.max(...spread));
    const xHi = o.xRange ? o.xRange[1] : Math.ceil(hi + (hi - lo) * (compact ? 0.05 : 0.22)), yLo = o.yRange ? o.yRange[0] : lo, yHi = o.yRange ? o.yRange[1] : hi + 1;
    const fs = compact ? 10 : 12, axis = (name, min, max) => ({ type: 'value', name, nameLocation: 'middle', nameGap: compact ? 22 : 30, min, max,
      nameTextStyle: { color: t.muted, fontSize: compact ? 11 : 13 }, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted, fontSize: fs, showMinLabel: false, showMaxLabel: false },
      splitLine: { lineStyle: { color: t.line, opacity: 0.6 } } });
    const dim = p => (hl && p.name !== hl ? 0.25 : 1), showLabel = p => (hl ? p.name === hl : !compact);
    const dataOf = extra => P.map((p, i) => ({ name: p.name, value: [p.x, p.y], symbolSize: hl ? (p.name === hl ? 16 : 9) : (compact ? 9 : 14),
      itemStyle: { color: color(p), opacity: dim(p), borderColor: t.bg, borderWidth: compact ? 1.5 : 2 },
      label: { show: showLabel(p), position: compact && p.x > lo + (xHi - lo) * 0.62 ? 'left' : 'right', fontWeight: p.name === hl ? 600 : 400, ...(extra ? extra[i] : {}) } }));
    const corner = (x0, y0, x1, y1, key, pos) => [{ coord: [x0, y0], name: compact ? '' : names[key].toUpperCase(), label: { position: pos } }, { coord: [x1, y1] }];
    const ch = echarts.init(node, null, { renderer: 'svg' });
    ch.setOption({ animation: false, grid: compact ? { left: 36, right: 10, top: 10, bottom: 34 } : { left: 64, right: 24, top: 20, bottom: 56 },
      tooltip: { formatter: q => { const p = P[q.dataIndex]; if (!p) return '';
        return '<b>' + p.name + '</b> · ' + names[zone(p)] + '<br>' + xl + ': ' + fmt(p.x) + ' ' + unit + (p.xCi != null ? ' (± ' + p.xCi.toFixed(1) + ')' : '') +
          '<br>' + yl + ': ' + fmt(p.y) + ' ' + unit + (p.yCi != null ? ' (± ' + p.yCi.toFixed(1) + ')' : ''); } },
      xAxis: axis(o.xName || xl, lo, xHi), yAxis: axis(o.yName || yl, yLo, yHi),
      series: [
        { type: 'custom', silent: true, z: 1, data: P.map(p => [p.x, p.y]), renderItem: (q, api) => {          // ± crosshair behind the point
            if (!o.ci) return null; const p = P[q.dataIndex], c = color(p), cx = p.xCi || 0, cy = p.yCi || 0;
            const l = api.coord([p.x - cx, p.y]), r = api.coord([p.x + cx, p.y]), b = api.coord([p.x, p.y - cy]), u = api.coord([p.x, p.y + cy]);
            const st = { stroke: c, lineWidth: 1.5, opacity: 0.35 * dim(p) };
            return { type: 'group', children: [{ type: 'line', shape: { x1: l[0], y1: l[1], x2: r[0], y2: r[1] }, style: st }, { type: 'line', shape: { x1: b[0], y1: b[1], x2: u[0], y2: u[1] }, style: st }] }; } },
        { type: 'scatter', z: 3, data: dataOf(null), label: { position: 'right', distance: 6, color: t.text, fontSize: compact ? 11.5 : 12.5, formatter: q => q.data.name },
          markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.muted, type: 'dashed' }, data: [{ xAxis: mx }, { yAxis: my }] },
          markArea: { silent: true, itemStyle: { color: 'rgba(120,140,160,.05)' }, label: { color: t.muted, fontSize: 13, fontWeight: 600 },
            data: [corner(lo, my, mx, yHi, 'topLeft', 'insideTopLeft'), corner(mx, my, xHi, yHi, 'topRight', 'insideTopRight'), corner(mx, yLo, xHi, my, 'bottomRight', 'insideBottomRight'), corner(lo, yLo, mx, my, 'bottomLeft', 'insideBottomLeft')] } } ] });
    function place() {                                                                                           // greedy de-overlap: top to bottom, push a label down when it collides
      const cv = document.createElement('canvas').getContext('2d'); cv.font = (compact ? 11.5 : 12.5) + 'px system-ui, sans-serif';
      const pts = P.map((p, i) => { const [x, y] = ch.convertToPixel({ seriesIndex: 1 }, [p.x, p.y]); return { i, x, y, w: cv.measureText(p.name).width + 26, on: showLabel(p) }; }).filter(a => a.on).sort((a, b) => a.y - b.y);
      const placed = [], off = {};
      pts.forEach(a => { let y = a.y, moved = true, guard = 0;
        while (moved && guard++ < 60) { moved = false; for (const b of placed) if (Math.abs(y - b.ly) < 16 && a.x < b.x + b.w && b.x < a.x + a.w) { y = b.ly + 16; moved = true; } }
        a.ly = y; placed.push(a); off[a.i] = y - a.y; });
      ch.setOption({ series: [{}, { data: dataOf(P.map((p, i) => ({ offset: [off[i] ? 8 : 0, off[i] || 0] }))).map((d, i) => ({ ...d, labelLine: { show: Math.abs(off[i] || 0) > 3, lineStyle: { color: t.muted } } })) }] });
    }
    place();
    global.addEventListener('resize', () => { ch.resize(); place(); });
    let tab = o.table === true ? null : o.table ? el$(o.table) : null;
    if (o.table === true) { tab = document.createElement('div'); node.parentNode.insertBefore(tab, node.nextSibling); }
    if (tab) {
      const rows = [...P].sort((a, b) => (b.x + b.y) - (a.x + a.y)), sw = p => '<i style="display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:6px;background:' + color(p) + '"></i>';
      tab.innerHTML = '<div class="ck-tw"><table class="ck-heat"><thead><tr><th>' + (o.itemLabel || 'attribute') + '</th><th style="text-align:left">' + (o.zoneLabel || 'zone') + '</th><th>' + xl + ', ' + unit + '</th><th>' + yl + ', ' + unit + '</th><th>' + (o.sumLabel || 'strength (sum)') + '</th></tr></thead><tbody>' +
        rows.map(p => '<tr' + (p.name === hl ? ' style="font-weight:700"' : '') + '><th>' + p.name + '</th><td style="text-align:left;white-space:nowrap">' + sw(p) + names[zone(p)] + '</td><td>' + fmt(p.x) + '</td><td>' + fmt(p.y) + '</td><td>' + fmt(p.x + p.y) + '</td></tr>').join('') + '</tbody></table></div>';
    }
    return ch;
  }
  global.ChartKit = global.ChartKit || {}; global.ChartKit.penaltyRewardMap = penaltyRewardMap;
})(window);
