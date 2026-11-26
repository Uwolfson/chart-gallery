/* chart-gallery part — ChartKit.transitionGraph: screens as nodes at fixed positions, transitions as directed edges, optional matrix table. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const PALETTE = ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fnum = v => Math.round(v).toLocaleString('en-US');
  const WORDS = { entries: 'entries', dwell: 'median stay', unit: 's', ends: 'session ends here', good: 'with an order', exits: 'exits', of: 'of exits from', transitions: 'transitions' };

  /**
   * Transition graph — where people go from each screen. Nodes sit where the caller puts them (a fixed layout keeps the picture
   * stable between groups), node size ~ sqrt(entries), the rich-text label gives entries, median dwell and the share of exits that
   * end the session there; directed edges are coloured by source, width ~ sqrt(count), labelled with the share of exits from the
   * source, and hidden below `minShare`. Links whose target is not a node are terminal exits (they feed the "ends here" line and
   * the right part of the matrix). The optional matrix is an HTML table shaded blue (share of exits), or blue / orange when
   * `links2` is given and `matrixMode` is 'diff' (links minus links2, percentage points).
   * opts: { nodes: [{ name, x, y, entries, dwell?, color?, labelPosition? }], links: [{ source, target, count }], links2?: [...same shape],
   *         goodEnds?: ['booked'] (terminal targets counted as the good outcome), minShare?: 15, matrix?: true | element | id | false,
   *         matrixMode?: 'links' | 'links2' | 'diff', pad?: { left: 150, right: 180, top: 150, bottom: 120 } (room for the labels),
   *         words?: { entries, dwell, unit, ends, good, exits, of, transitions }, onNodeClick?: name => void }
   * Returns { chart, redraw(optsPatch?), dispose(), node }.
   */
  function transitionGraph(el, opts) {
    const node = el$(el); let o = { ...opts }, ch = null, mat = null, ownMat = false;
    const names = () => o.nodes.map(n => n.name);
    const colorOf = n => { const i = names().indexOf(n); const d = o.nodes[i]; return (d && d.color) || PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; };
    const terminals = links => [...new Set(links.map(l => l.target).filter(t => !names().includes(t)))];
    const tally = links => { const out = {}, N = names(); links.forEach(l => { if (!N.includes(l.source)) return; const r = out[l.source] || (out[l.source] = { total: 0, to: {} }); r.total += l.count; r.to[l.target] = (r.to[l.target] || 0) + l.count; }); return out; };
    const share = (r, t) => (r && r.total > 0 ? 100 * (r.to[t] || 0) / r.total : 0);
    function drawGraph() {
      const t = theme(), w = { ...WORDS, ...(o.words || {}) }, T = tally(o.links), good = o.goodEnds || [], term = terminals(o.links), minShare = o.minShare == null ? 15 : o.minShare;
      const emax = Math.max(1, ...o.nodes.map(n => n.entries)), cmax = Math.max(1, ...o.links.filter(l => names().includes(l.target)).map(l => l.count));
      const ys = o.nodes.map(n => n.y), ymid = (Math.min(...ys) + Math.max(...ys)) / 2;
      const data = o.nodes.map(n => { const r = T[n.name], end = term.reduce((a, k) => a + share(r, k), 0), ok = good.reduce((a, k) => a + share(r, k), 0);
        return { name: n.name, x: n.x, y: n.y, value: n.entries, symbolSize: 26 + 64 * Math.sqrt(n.entries / emax), itemStyle: { color: colorOf(n.name), borderColor: t.bg, borderWidth: 2 },
          label: { show: true, position: n.labelPosition || (n.y < ymid ? 'top' : 'bottom'), color: t.text, fontSize: 13, fontWeight: 700, lineHeight: 17,
            formatter: n.name + '\n{a|' + fnum(n.entries) + ' ' + w.entries + (n.dwell != null ? ' · ' + w.dwell + ' ' + Math.round(n.dwell) + ' ' + w.unit : '') + '}' +
              (term.length ? '\n{n|' + w.ends + ': ' + Math.round(end) + '%}' + (ok > 0 ? '{a| (}{o|' + Math.round(ok) + '% ' + w.good + '}{a|)}' : '') : ''),
            rich: { a: { fontSize: 11, fontWeight: 400, color: t.muted, lineHeight: 15 }, n: { fontSize: 11, fontWeight: 500, color: '#C2410C', lineHeight: 15 }, o: { fontSize: 11, fontWeight: 500, color: '#047857', lineHeight: 15 } } } }; });
      const links = [];
      o.links.forEach(l => { if (!names().includes(l.target) || !names().includes(l.source) || l.source === l.target) return; const p = share(T[l.source], l.target); if (p < minShare || l.count <= 0) return;
        links.push({ source: l.source, target: l.target, value: l.count, pct: p, lineStyle: { width: 1 + 14 * Math.sqrt(l.count / cmax), color: colorOf(l.source), opacity: 0.55, curveness: 0.18 },
          label: { show: true, formatter: Math.round(p) + '%', fontSize: 12, fontWeight: 600, color: t.text, backgroundColor: t.bg, padding: [1, 4], borderRadius: 3 } }); });
      const pad = { left: 150, right: 180, top: 150, bottom: 120, ...(o.pad || {}) };
      if (ch) ch.dispose();
      ch = echarts.init(node, null, { renderer: 'svg' });
      ch.setOption({ animation: false,
        tooltip: { formatter: p => p.dataType === 'edge' ? esc(p.data.source) + ' → ' + esc(p.data.target) + '<br>' + Math.round(p.data.pct) + '% ' + w.of + ' "' + esc(p.data.source) + '", ' + fnum(p.data.value) + ' ' + w.transitions
          : esc(p.name) + ': ' + fnum(p.value) + ' ' + w.entries + ((o.nodes.find(n => n.name === p.name) || {}).dwell != null ? ', ' + w.dwell + ' ' + Math.round(o.nodes.find(n => n.name === p.name).dwell) + ' ' + w.unit : '') },
        series: [{ type: 'graph', layout: 'none', left: pad.left, right: pad.right, top: pad.top, bottom: pad.bottom, roam: false, data, links, edgeSymbol: ['none', 'arrow'], edgeSymbolSize: [0, 10], emphasis: { focus: 'adjacency' } }] });
      if (o.onNodeClick) ch.on('click', p => { if (p.dataType === 'node') o.onNodeClick(p.name); });
    }
    function drawMatrix() {
      if (o.matrix === false || o.matrix == null) { if (mat) mat.textContent = ''; return; }
      if (!mat) { if (o.matrix === true) { mat = document.createElement('div'); ownMat = true; node.parentNode.insertBefore(mat, node.nextSibling); } else mat = el$(o.matrix); }
      const w = { ...WORDS, ...(o.words || {}) }, mode = o.matrixMode || 'links', diff = mode === 'diff' && o.links2, A = tally(o.links), B = tally(o.links2 || []), N = names(), term = terminals(o.links.concat(o.links2 || []));
      const cols = N.concat(term), src = mode === 'links2' && o.links2 ? B : A;
      let h = '<table class="ck-heat ck-transition-graph-matrix"><thead><tr><th></th>' + cols.map((c, j) => (j === N.length ? '<th class="ck-transition-graph-sep"></th>' : '') + '<th>' + esc(c) + '</th>').join('') + '<th>' + esc(w.exits) + '</th></tr></thead><tbody>';
      N.forEach(f => { const inner = T => { const r = T[f], tot = N.reduce((a, k) => a + (r ? r.to[k] || 0 : 0), 0); return N.map(k => (tot > 0 && r ? 100 * (r.to[k] || 0) / tot : 0)); };
        const p = diff ? inner(A).map((v, j) => v - inner(B)[j]).concat(term.map(() => NaN)) : cols.map(c => share(src[f], c));
        h += '<tr><th><i style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;background:' + colorOf(f) + '"></i>' + esc(f) + '</th>' + p.map((v, j) => { const self = cols[j] === f, a = diff ? Math.min(0.85, Math.abs(v) / 25) : Math.min(0.9, v / 55);
          const bg = self || isNaN(v) ? 'transparent' : diff ? (Math.abs(v) < 3 ? 'transparent' : v > 0 ? 'rgba(37,99,235,' + a.toFixed(2) + ')' : 'rgba(249,115,22,' + a.toFixed(2) + ')') : (v < 3 ? 'transparent' : 'rgba(37,99,235,' + a.toFixed(2) + ')');
          const txt = self || isNaN(v) ? '' : diff ? (Math.abs(v) < 0.5 ? '0' : (v > 0 ? '+' : '−') + Math.round(Math.abs(v))) : (v < 0.5 ? '·' : Math.round(v) + '%');
          return (j === N.length ? '<td class="ck-transition-graph-sep"></td>' : '') + '<td style="background:' + bg + (a > 0.55 && bg !== 'transparent' ? ';color:#fff' : '') + '">' + txt + '</td>'; }).join('') +
          '<td class="ck-muted">' + (diff ? fnum(A[f] ? A[f].total : 0) + ' / ' + fnum(B[f] ? B[f].total : 0) : fnum(src[f] ? src[f].total : 0)) + '</td></tr>'; });
      mat.innerHTML = '<div class="ck-tw">' + h + '</tbody></table></div>';
    }
    const onResize = () => { if (ch && node.offsetWidth) ch.resize(); };
    global.addEventListener('resize', onResize);
    drawGraph(); drawMatrix();
    return {
      get chart() { return ch; },
      redraw(patch) { if (patch) o = { ...o, ...patch }; drawGraph(); drawMatrix(); },
      dispose() { global.removeEventListener('resize', onResize); if (ch) ch.dispose(); ch = null; if (mat) { if (ownMat) mat.remove(); else mat.textContent = ''; } mat = null; },
      node,
    };
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.transitionGraph = transitionGraph;
})(window);
