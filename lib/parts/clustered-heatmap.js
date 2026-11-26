/* chart-gallery part: ChartKit.clusteredHeatmap — rows x columns heatmap with Ward dendrograms drawn as graphic polylines. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const HI = '#2563EB', LO = '#F97316';

  /** Ward hierarchical clustering (ward.D2: Euclidean distance, merge by the growth of the within-group sum of squares).
   *  V = one vector per item, w = one weight per item. Returns the tree as a flat array: leaves first, merges appended;
   *  each node = { n, h (height), w, i (leaf index), kids }. Inside a merge the branch with the larger mean weight comes first. */
  function ward(V, w) {
    const T = V.map((v, i) => ({ n: 1, h: 0, w: w[i], i, kids: null }));
    const D = V.map(a => V.map(b => a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0)));
    let act = V.map((_, i) => i);
    while (act.length > 1) {
      let bi = -1, bj = -1, bd = Infinity;
      for (let a = 0; a < act.length; a++) for (let b = a + 1; b < act.length; b++) if (D[act[a]][act[b]] < bd) { bd = D[act[a]][act[b]]; bi = act[a]; bj = act[b]; }
      const ni = T[bi].n, nj = T[bj].n, u = T.length;
      T.push({ n: ni + nj, h: Math.sqrt(bd), w: T[bi].w + T[bj].w, kids: [bi, bj] }); D[u] = [];
      act = act.filter(k => k !== bi && k !== bj);
      act.forEach(k => { const nk = T[k].n; D[u][k] = D[k][u] = ((ni + nk) * D[bi][k] + (nj + nk) * D[bj][k] - nk * bd) / (ni + nj + nk); });
      act.push(u);
    }
    T.forEach(n => { if (n.kids) n.kids.sort((a, b) => T[b].w / T[b].n - T[a].w / T[a].n); });
    return T;
  }
  const leafOrder = T => { const go = k => (T[k].kids ? T[k].kids.flatMap(go) : [T[k].i]); return go(T.length - 1); };

  /**
   * Clustered heatmap — rows x columns; a cell is shaded by how far it is from the row's overall value (or by the signed value
   * itself when `overall` is omitted), blue above / orange below, alpha = |value| / max. Row and column dendrograms from Ward
   * clustering are drawn next to the map (rows to the right, columns below) and the map is reordered by their leaves.
   * opts: { rows: [names], columns: [names], values: [[one array per row, one number per column]], overall?: [one per row],
   *         cluster?: { rows: true, cols: true }, orderBy?: column name (columns sorted by Euclidean distance to it, no column tree),
   *         format?: v => string, labelMin?: 0.5 (cells with |value| below it have no label), unit?: '', colors?: { pos, neg },
   *         distanceLabel?: 'distance to' }
   * Branch order follows R's reorder(): the branch with the larger mean weight (row sum / column sum of the signed cells) comes first.
   * Returns the ECharts instance; the trees are redrawn on window resize.
   */
  function clusteredHeatmap(el, o) {
    const node = el$(el), t = theme(), C = { pos: HI, neg: LO, ...(o.colors || {}) }, up = rgb(C.pos), dn = rgb(C.neg);
    const fmt = o.format || (v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v * 10) / 10)), lmin = o.labelMin == null ? 0.5 : o.labelMin;
    const cl = { rows: true, cols: true, ...(o.cluster || {}) }, unit = o.unit ? ' ' + o.unit : '';
    const M = o.values.map((row, i) => row.map(v => (o.overall ? v - o.overall[i] : v)));
    const R = o.rows.length, K = o.columns.length;
    let tr = null, tc = null, rowIdx = o.rows.map((_, i) => i), colIdx = o.columns.map((_, j) => j), dist = null;
    if (cl.rows && R > 2) { tr = ward(M, M.map(r => r.reduce((s, x) => s + x, 0))); rowIdx = leafOrder(tr); }
    const col = j => M.map(r => r[j]);
    if (o.orderBy != null && o.columns.includes(o.orderBy)) {
      const c0 = col(o.columns.indexOf(o.orderBy));
      dist = colIdx.map(j => Math.sqrt(col(j).reduce((s, x, k) => s + (x - c0[k]) ** 2, 0)));
      colIdx = [...colIdx].sort((a, b) => dist[a] - dist[b]);
    } else if (cl.cols && K > 2) { tc = ward(colIdx.map(col), colIdx.map(j => col(j).reduce((s, x) => s + x, 0))); colIdx = leafOrder(tc); }
    const m = Math.max(1e-9, ...M.flat().map(Math.abs));
    const data = []; colIdx.forEach((j, x) => rowIdx.forEach((i, y) => { const v = M[i][j], c = v >= 0 ? up : dn;
      data.push({ value: [x, y, v], itemStyle: { color: 'rgba(' + c.join(',') + ',' + (Math.min(1, Math.abs(v) / m) * 0.85 + 0.04).toFixed(3) + ')', borderColor: t.bg, borderWidth: 1 } }); }));
    const colName = j => o.columns[j] + (dist ? ' (' + (Math.round(dist[j] * 10) / 10) + ')' : '');
    const lw = labelWidth(el, o.rows, 0.3), many = K > 6, G = { left: lw + 10, right: tr ? 120 : 20, top: many ? 118 : 56, bottom: tc ? 90 : 12 };
    const ch = echarts.init(node, null, { renderer: 'svg' });
    ch.setOption({ animation: false, grid: G,
      tooltip: { formatter: q => { const j = colIdx[q.value[0]], i = rowIdx[q.value[1]];
        return '<b>' + o.columns[j] + '</b>' + (dist ? '<br><span style="font-size:12px">' + (o.distanceLabel || 'distance to') + ' ' + o.orderBy + ': ' + (Math.round(dist[j] * 100) / 100) + '</span>' : '')
          + '<br>' + o.rows[i] + ': ' + fmt(q.value[2]) + unit + (o.overall ? ' (' + Math.round(o.values[i][j] * 10) / 10 + ' vs ' + Math.round(o.overall[i] * 10) / 10 + ' overall)' : ''); } },
      xAxis: { type: 'category', position: 'top', data: colIdx.map(colName), axisLabel: { color: t.muted, interval: 0, rotate: many ? 50 : 0, fontSize: 11.5 }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'category', inverse: true, data: rowIdx.map(i => o.rows[i]), axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break' }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{ type: 'heatmap', data, label: { show: true, fontSize: many ? 10.5 : 12, color: t.text, formatter: q => (Math.abs(q.value[2]) >= lmin ? fmt(q.value[2]) : '') } }] });
    function trees() {
      const els = [];
      if (tr || tc) {
        const W = ch.getWidth(), H = ch.getHeight(), x0 = G.left, x1 = W - G.right, y0 = G.top, y1 = H - G.bottom, rh = (y1 - y0) / R, cw = (x1 - x0) / K;
        const tree = (T, at, toPx) => { const root = T.length - 1, Hm = T[root].h || 1, pos = {};
          leafOrder(T).forEach((leaf, k) => { pos[leaf] = at(k); });
          const walk = k => { const n = T[k]; if (!n.kids) return pos[k];
            const [a, b] = n.kids.map(walk); pos[k] = (a + b) / 2;
            const ha = T[n.kids[0]].h / Hm, hb = T[n.kids[1]].h / Hm, hn = n.h / Hm;
            els.push({ type: 'polyline', silent: true, shape: { points: [toPx(a, ha), toPx(a, hn), toPx(b, hn), toPx(b, hb)] }, style: { stroke: t.muted, lineWidth: 1.2, fill: null } });
            return pos[k]; };
          walk(root); };
        if (tr) tree(tr, k => y0 + (k + 0.5) * rh, (p, h) => [x1 + 8 + h * 100, p]);
        if (tc) tree(tc, k => x0 + (k + 0.5) * cw, (p, h) => [p, y1 + 8 + h * 72]);
      }
      ch.setOption({ graphic: { elements: els } }, { replaceMerge: ['graphic'] });
    }
    trees();
    global.addEventListener('resize', () => { ch.resize(); trees(); });
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.clusteredHeatmap = clusteredHeatmap; global.ChartKit.ward = ward; global.ChartKit.leafOrder = leafOrder;
})(window);
