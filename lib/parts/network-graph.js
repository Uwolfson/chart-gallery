/* chart-gallery part: ChartKit.networkGraph — a directed network of binary behaviours in the "Bayesian network" style. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const rgba = (hex, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
  const COMMUNITY = ['#4C8BE0', '#F28C28', '#5DBB63', '#C86BD6', '#2BB5C9', '#E8567C', '#8B8B8B', '#B9A15A', '#7A6FD6', '#3E9E8F'];
  const coefText = v => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2).replace(/^0/, '');              // 0.23 -> ".23", -0.07 -> "-.07"

  /** Communities by a greedy modularity pass (one Louvain level, repeated until no node moves) on the undirected graph with
   *  weights |coef|. Deterministic: nodes are visited in order. Returns one community index per node, numbered by first appearance. */
  function communities(names, edges) {
    const N = names.length, idx = {}; names.forEach((n, i) => { idx[n] = i; });
    const W = names.map(() => new Array(N).fill(0)); let m = 0;
    edges.forEach(e => { const a = idx[e.source], b = idx[e.target], w = Math.abs(e.coef); if (a == null || b == null || a === b) return; W[a][b] += w; W[b][a] += w; m += w; });
    const k = W.map(r => r.reduce((s, v) => s + v, 0)), com = names.map((_, i) => i), tot = k.slice();
    for (let pass = 0, moved = true; moved && m > 0 && pass < 50; pass++) {
      moved = false;
      for (let i = 0; i < N; i++) {
        const links = {}; W[i].forEach((w, j) => { if (w) links[com[j]] = (links[com[j]] || 0) + w; });
        const cur = com[i]; tot[cur] -= k[i];
        let best = cur, gain = (links[cur] || 0) - tot[cur] * k[i] / (2 * m);
        Object.keys(links).forEach(c => { const g = links[c] - tot[c] * k[i] / (2 * m); if (g > gain + 1e-12) { gain = g; best = +c; } });
        tot[best] += k[i]; if (best !== cur) { com[i] = best; moved = true; }
      }
    }
    const map = {}; let n = 0; return com.map(c => (map[c] == null ? (map[c] = n++) : map[c]));
  }

  /** Fruchterman–Reingold force layout (as igraph's layout_with_fr with weights = |coef|): deterministic start on a circle,
   *  800 cooling steps, result normalised to [-100, 100]. Returns { [name]: [x, y] }. */
  function forceLayout(nodes, edges, iters) {
    const N = nodes.length, idx = {}; nodes.forEach((n, i) => { idx[n.name] = i; });
    const k = 100 / Math.sqrt(N), P = nodes.map((_, i) => [Math.cos(2 * Math.PI * i / N) * 50, Math.sin(2 * Math.PI * i / N) * 50]);
    const L = edges.map(e => [idx[e.source], idx[e.target], Math.abs(e.coef)]).filter(l => l[0] != null && l[1] != null && l[0] !== l[1]);
    const wMax = Math.max(1e-9, ...L.map(l => l[2])), steps = iters || 800;
    for (let it = 0; it < steps; it++) {
      const temp = 30 * (1 - it / steps) + 0.5, D = P.map(() => [0, 0]);
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        let dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d = Math.hypot(dx, dy) || 1e-3, f = k * k / d;
        dx = dx / d * f; dy = dy / d * f; D[i][0] += dx; D[i][1] += dy; D[j][0] -= dx; D[j][1] -= dy; }
      L.forEach(([a, b, w]) => { let dx = P[a][0] - P[b][0], dy = P[a][1] - P[b][1], d = Math.hypot(dx, dy) || 1e-3, f = d * d / k * (0.3 + w / wMax);
        dx = dx / d * f; dy = dy / d * f; D[a][0] -= dx; D[a][1] -= dy; D[b][0] += dx; D[b][1] += dy; });
      P.forEach((p, i) => { const d = Math.hypot(D[i][0], D[i][1]) || 1e-3, m = Math.min(d, temp); p[0] += D[i][0] / d * m; p[1] += D[i][1] / d * m; });
    }
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), sx = Math.max(...xs) - Math.min(...xs) || 1, sy = Math.max(...ys) - Math.min(...ys) || 1;
    const out = {}; nodes.forEach((n, i) => { out[n.name] = [(P[i][0] - Math.min(...xs)) / sx * 200 - 100, (P[i][1] - Math.min(...ys)) / sy * 200 - 100]; });
    return out;
  }

  /** Layered positions: x = column index, y = rank inside the column after three barycentre sweeps over predecessors. */
  function columnsLayout(nodes, edges) {
    const byName = {}; nodes.forEach(n => { byName[n.name] = n; });
    const colOf = n => n.column || 0, cols = {}; nodes.forEach(n => { (cols[colOf(n)] = cols[colOf(n)] || []).push(n); });
    const keys = Object.keys(cols).map(Number).sort((a, b) => a - b), pos = {};
    keys.forEach(c => cols[c].forEach((n, i) => { pos[n.name] = i; }));
    for (let s = 0; s < 3; s++) keys.forEach((c, ci) => { if (!ci) return;
      const bc = {}; cols[c].forEach(n => { const nb = edges.filter(e => e.target === n.name && byName[e.source] && colOf(byName[e.source]) < c).map(e => pos[e.source]);
        bc[n.name] = nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : pos[n.name]; });
      cols[c].sort((a, b) => bc[a.name] - bc[b.name]).forEach((n, i) => { pos[n.name] = i; }); });
    const P = {}; keys.forEach((c, ci) => { const k = cols[c].length; cols[c].forEach(n => { P[n.name] = [ci * 100 + (k > 5 ? (pos[n.name] % 2 ? 14 : -14) : 0), (pos[n.name] - (k - 1) / 2) * 22]; }); });
    return { P, keys };
  }

  /**
   * Network graph — binary behaviours as nodes, model coefficients as directed edges (a Bayesian network, a path model).
   * Node size = 6 + 34·sqrt(prevalence / max), node colour = community, label "Name N%"; edge width = 1 + 9·|coef| / max,
   * edge colour = source node colour at 85% opacity, curved with an arrow, edge label = coefficient as ".23".
   * opts: { nodes: [{ name, prevalence (0–100), community?, column? }], edges: [{ source, target, coef }],
   *         layout?: 'force' (own Fruchterman–Reingold, deterministic) | 'columns', columns?: ['caption of column 0', 'caption of column 1', ...], target?: node name,
   *         colors?: [community palette], nodeScale?: 1.5 (pixels per size unit), roam?: true, format?: coef => string,
   *         labelOf?: node => string }
   * Missing communities are found by a greedy modularity pass. With layout 'columns' nodes are placed in the column given by
   * `node.column` (0-based) and ordered inside it by the barycentre of their predecessors; captions go above the columns.
   * The `target` node gets a ring and its incoming edges are drawn in the text colour. Returns the ECharts instance.
   */
  function networkGraph(el, o) {
    const node = el$(el), t = theme(), pal = o.colors || COMMUNITY, scale = o.nodeScale || 1.5, fmt = o.format || coefText, cols = o.layout === 'columns';
    const names = o.nodes.map(n => n.name), need = o.nodes.some(n => n.community == null), auto = need ? communities(names, o.edges) : null;
    const comm = {}; o.nodes.forEach((n, i) => { comm[n.name] = n.community != null ? n.community : auto[i]; });
    const colorOf = n => pal[comm[n] % pal.length], maxP = Math.max(1e-9, ...o.nodes.map(n => n.prevalence)), maxC = Math.max(1e-9, ...o.edges.map(e => Math.abs(e.coef)));
    const labelOf = o.labelOf || (n => n.name + ' ' + Math.round(n.prevalence) + '%');
    const lay = cols ? columnsLayout(o.nodes, o.edges) : null, raw = cols ? lay.P : forceLayout(o.nodes, o.edges);
    // positions are mapped onto the series box in pixels, so ECharts' fit-to-view is the identity and circles stay circles
    const box = { left: cols ? 90 : 110, right: cols ? 90 : 110, top: cols ? 72 : 44, bottom: cols ? 66 : 44 }, bw = Math.max(50, node.offsetWidth - box.left - box.right), bh = Math.max(50, node.offsetHeight - box.top - box.bottom);
    const xs = names.map(n => raw[n][0]), ys = names.map(n => raw[n][1]), x0 = Math.min(...xs), y0 = Math.min(...ys), sx = (Math.max(...xs) - x0) || 1, sy = (Math.max(...ys) - y0) || 1;
    const fp = {}; names.forEach(n => { fp[n] = [(raw[n][0] - x0) / sx * bw, (raw[n][1] - y0) / sy * bh]; });
    const data = o.nodes.map((n, i) => { const tg = n.name === o.target, size = (6 + 34 * Math.sqrt(n.prevalence / maxP)) * scale;
      const xy = fp[n.name];
      return { name: n.name, value: n.prevalence, x: xy[0], y: xy[1], symbolSize: size, itemStyle: { color: colorOf(n.name), borderColor: tg ? t.text : 'rgba(40,40,40,.6)', borderWidth: tg ? 4 : 1 },
        label: { show: true, position: cols ? 'bottom' : 'inside', distance: 4, formatter: labelOf(n), fontSize: cols ? 12 : 11.5, fontWeight: tg ? 800 : 500, color: t.text, textBorderColor: t.bg, textBorderWidth: 2.5 } }; });
    const colIdx = {}; o.nodes.forEach(n => { colIdx[n.name] = n.column || 0; });
    const links = o.edges.map(e => ({ source: e.source, target: e.target, coef: e.coef,
      lineStyle: { width: 1 + 9 * Math.abs(e.coef) / maxC, color: cols && e.target === o.target ? t.text : rgba(colorOf(e.source), 0.85), curveness: cols ? (colIdx[e.source] === colIdx[e.target] ? 0.5 : 0.15) : 0.12 },
      label: { show: true, formatter: fmt(e.coef), fontSize: 10.5, color: t.muted, textBorderColor: t.bg, textBorderWidth: 2.5 } }));
    const ch = echarts.init(node, null, { renderer: 'svg' });
    ch.setOption({ animation: false,
      tooltip: { formatter: p => (p.dataType === 'edge' ? p.data.source + ' → ' + p.data.target + ': ' + fmt(p.data.coef) : '<b>' + p.name + '</b><br>' + Math.round(p.value) + '%') },
      series: [{ type: 'graph', layout: 'none', data, links, roam: o.roam !== false, ...box,
        edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 9, lineStyle: { opacity: 1 }, emphasis: { focus: 'adjacency', lineStyle: { width: 6 } } }] });
    if (cols && o.columns) {
      const caps = lay.keys.map((c, ci) => { const px = ch.convertToPixel({ seriesIndex: 0 }, [(ci * 100 - x0) / sx * bw, 0]);
        return { type: 'text', silent: true, x: px[0], y: 16, style: { text: o.columns[c] || '', fill: t.muted, fontSize: 13, fontWeight: 700, textAlign: 'center' } }; });
      ch.setOption({ graphic: { elements: caps } });
    }
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.networkGraph = networkGraph; global.ChartKit.communities = communities;
})(window);
