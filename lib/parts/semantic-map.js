/* chart-gallery part — ChartKit.semanticMap: canvas scatter of 2-D embeddings with zoom, pan and three semantic zoom levels. Needs lib/parts/semantic-map.css. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const PALETTE = ['#2563EB', '#F97316', '#059669', '#CA8A04', '#E11D48', '#7C3AED', '#0891B2', '#65A30D'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  const FONT = 'system-ui, "Segoe UI", sans-serif';

  /**
   * Semantic map — points with 2-D coordinates (t-SNE / UMAP output) on a canvas. Zoom and pan (wheel after a click on the map or
   * with Ctrl, drag, double click, + / − / reset buttons); three semantic zoom levels: at low zoom the labels name the groups, at
   * mid zoom the subgroups, at high zoom the small clusters. A radial glow sits under the top groups. Point kinds: coloured = in a
   * top group, grey = in another group, ring = no group. Labels are boxes with the name and the top words, nudged so they do not
   * overlap; group chips focus one group (hover = preview, click = pin). Hover shows a tooltip; click calls onClick.
   * opts: { points: [{ x, y, group?: string | null, ...fields named by levels, text? }],
   *         levels?: [{ zoom, field }] (default [{1,'group'},{2.2,'sub'},{5,'cluster'}]), words?: { [field]: { [value]: ['word', ...] } },
   *         groups?: [names in colour order] (default: by size), maxGroups?: 8, colors?: { [group]: color }, glow?: true,
   *         height?: px | (width => px) (default: 0.62 × width, 460–720), chips?: true | element | id | false, buttons?: true,
   *         focus?: group | null, tooltip?: (point) => html, labelTooltip?: (label) => html, onClick?: (point | null, label | null) => void,
   *         words text: ungroupedLabel?: 'no group', levelNames?: ['groups', 'subgroups', 'clusters'], hint?: 'click the map, then scroll to zoom' }
   * A label is { field, value, n, x, y, group, words }. Returns { redraw(patch), focus(group | null), reset(), dispose(), node }.
   */
  function semanticMap(el, opts) {
    const node = el$(el); let o = { ...opts }; node.classList.add('ck-semantic-map'); node.textContent = '';
    const chipRow = o.chips === false ? null : o.chips && o.chips !== true ? el$(o.chips) : document.createElement('div');
    const plot = document.createElement('div'), cv = document.createElement('canvas'), tools = document.createElement('div'), cap = document.createElement('div'), hint = document.createElement('div'), tip = document.createElement('div');
    plot.className = 'ck-semantic-map-plot'; tools.className = 'ck-semantic-map-tools'; cap.className = 'ck-semantic-map-level'; hint.className = 'ck-semantic-map-hint'; tip.className = 'ck-semantic-map-tip';
    if (chipRow && o.chips === true || chipRow && !o.chips) { chipRow.className = 'ck-chips'; node.appendChild(chipRow); }
    plot.appendChild(cv); plot.appendChild(tools); plot.appendChild(cap); plot.appendChild(hint); plot.appendChild(tip); node.appendChild(plot);
    let W = 0, H = 0, base = 1, ox = 0, oy = 0, z = 1, tx = 0, ty = 0, x0 = 0, x1 = 1, y0 = 0, y1 = 1, focusTag = o.focus == null ? null : o.focus;
    let P = [], LV = [], slot = {}, labels = [], hoverPt = null, hoverLab = null, active = false, hintT = null;
    const levels = () => o.levels || [{ zoom: 1, field: 'group' }, { zoom: 2.2, field: 'sub' }, { zoom: 5, field: 'cluster' }];
    const lvlOf = () => { const L = levels(); let k = 0; L.forEach((l, i) => { if (z >= l.zoom) k = i; }); return k; };
    const colOf = g => (o.colors && o.colors[g]) || (g in slot ? PALETTE[slot[g] % PALETTE.length] : null);
    const toScreen = (x, y) => [(ox + (x - x0) * base) * z + tx, (oy + (y1 - y) * base) * z + ty];
    function prepare() {
      P = o.points.filter(p => p.x != null && p.y != null);
      const count = {}; P.forEach(p => { if (p.group != null) count[p.group] = (count[p.group] || 0) + 1; });
      const ranked = o.groups || Object.keys(count).sort((a, b) => count[b] - count[a]);
      slot = {}; ranked.slice(0, o.maxGroups || 8).forEach((g, i) => { slot[g] = i; });
      LV = levels().map(l => { const by = {};
        P.forEach(p => { const v = p[l.field]; if (v == null) return; const b = by[v] || (by[v] = { field: l.field, value: v, n: 0, sx: 0, sy: 0, pts: [], gc: {} }); b.n++; b.sx += p.x; b.sy += p.y; b.pts.push(p); if (p.group != null) b.gc[p.group] = (b.gc[p.group] || 0) + 1; });
        return Object.values(by).map(b => { const x = b.sx / b.n, y = b.sy / b.n, r = Math.sqrt(b.pts.reduce((a, p) => a + (p.x - x) ** 2 + (p.y - y) ** 2, 0) / b.n);
          const group = Object.keys(b.gc).sort((a, c) => b.gc[c] - b.gc[a])[0] || null, words = ((o.words || {})[l.field] || {})[b.value] || [];
          return { field: b.field, value: b.value, n: b.n, x, y, r, group, words, pts: b.pts }; }).sort((a, b) => b.n - a.n); });
      const xs = P.map(p => p.x), ys = P.map(p => p.y); x0 = Math.min(...xs); x1 = Math.max(...xs); y0 = Math.min(...ys); y1 = Math.max(...ys);
      if (!(x1 > x0)) x1 = x0 + 1; if (!(y1 > y0)) y1 = y0 + 1;
    }
    function resize() { W = plot.clientWidth; if (!W) return; H = typeof o.height === 'function' ? o.height(W) : o.height || Math.max(460, Math.min(720, Math.round(W * 0.62)));
      const dpr = global.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 40; base = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0)); ox = (W - (x1 - x0) * base) / 2; oy = (H - (y1 - y0) * base) / 2; draw(); }
    function draw() {
      const c = cv.getContext('2d'), t = theme(), L = lvlOf(); c.clearRect(0, 0, W, H);
      if (o.glow !== false) LV[0].forEach(cl => { const col = colOf(cl.group); if (!col || (focusTag != null && cl.group !== focusTag)) return;
        const [sx, sy] = toScreen(cl.x, cl.y), r = Math.max(1, cl.r * base * z * 1.5); if (sx < -r || sx > W + r || sy < -r || sy > H + r) return;
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, rgba(col, 0.16)); g.addColorStop(0.6, rgba(col, 0.06)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fill(); });
      const rs = Math.min(2.2, Math.sqrt(z)), vis = (sx, sy) => sx > -5 && sx < W + 5 && sy > -5 && sy < H + 5, faded = p => focusTag != null && p.group !== focusTag;
      c.fillStyle = t.muted;                                                                    // grey: a group without a colour slot
      P.forEach(p => { if (p.group == null || colOf(p.group)) return; const [sx, sy] = toScreen(p.x, p.y); if (!vis(sx, sy)) return; c.globalAlpha = faded(p) ? 0.1 : 0.45; c.beginPath(); c.arc(sx, sy, 2.1 * rs, 0, 7); c.fill(); });
      P.forEach(p => { const col = p.group != null && colOf(p.group); if (!col) return; const [sx, sy] = toScreen(p.x, p.y); if (!vis(sx, sy)) return; c.globalAlpha = faded(p) ? 0.15 : 0.9; c.fillStyle = col; c.beginPath(); c.arc(sx, sy, 2.6 * rs, 0, 7); c.fill(); });
      if (focusTag != null && !colOf(focusTag)) { c.globalAlpha = 0.95; c.fillStyle = PALETTE[0]; P.forEach(p => { if (p.group !== focusTag) return; const [sx, sy] = toScreen(p.x, p.y); c.beginPath(); c.arc(sx, sy, 2.6 * rs, 0, 7); c.fill(); }); }
      c.globalAlpha = focusTag != null ? 0.25 : 1; c.strokeStyle = t.muted; c.lineWidth = 1.3;                                              // rings: no group
      P.forEach(p => { if (p.group != null) return; const [sx, sy] = toScreen(p.x, p.y); if (!vis(sx, sy)) return; c.beginPath(); c.arc(sx, sy, 2.8 * rs, 0, 7); c.stroke(); });
      c.globalAlpha = 1;
      if (hoverPt) { const [sx, sy] = toScreen(hoverPt.x, hoverPt.y); c.strokeStyle = t.text; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, 7, 0, 7); c.stroke(); }
      drawLabels(c, L, t);
      cap.textContent = ((o.levelNames || ['groups', 'subgroups', 'clusters'])[L] || '') + ' · ×' + z.toFixed(1);
    }
    function drawLabels(c, L, t) {
      labels = []; const placed = [], hits = b => placed.some(p => !(b.x + b.w < p.x || p.x + p.w < b.x || b.y + b.h < p.y || p.y + p.h < b.y));
      LV[L].forEach((cl, i) => {
        if (focusTag != null && cl.group !== focusTag) return;
        const [sx, sy] = toScreen(cl.x, cl.y); if (sx < 20 || sx > W - 20 || sy < 20 || sy > H - 20) return;
        const gname = cl.group != null ? String(cl.group) : (o.ungroupedLabel || 'no group'), words = cl.words.slice(0, L === 0 ? 3 : 2);
        const l1 = L === 0 ? String(cl.value) : (words.length ? words.join(' · ') : String(cl.value)), l2 = L === 0 ? words.join(' · ') : '› ' + gname;
        const f1 = '650 ' + (L === 0 ? 15 : L === 1 ? 14 : 13) + 'px ' + FONT, f2 = (L === 0 ? 12 : 11) + 'px ' + FONT;
        c.font = f1; const w1 = c.measureText(l1).width; c.font = f2; const w2 = l2 ? c.measureText(l2).width : 0, bw = Math.max(w1, w2) + 16, bh = l2 ? 36 : 22;
        const offs = [[0, 0], [0, -bh], [0, bh], [-bw * 0.6, 0], [bw * 0.6, 0], [0, -bh * 1.8], [0, bh * 1.8], [-bw * 0.6, -bh], [bw * 0.6, -bh], [-bw * 0.6, bh], [bw * 0.6, bh]];
        let box = null; for (const [dx, dy] of offs) { const b = { x: sx + dx - bw / 2, y: sy + dy - bh / 2, w: bw, h: bh }; if (b.x < 4 || b.x + b.w > W - 4 || b.y < 4 || b.y + b.h > H - 4) continue; if (!hits(b)) { box = b; break; } }
        if (!box) { if (L > 0) return; box = { x: sx - bw / 2, y: sy - bh / 2, w: bw, h: bh }; }       // top-level groups are always placed
        placed.push(box);
        const cx = box.x + bw / 2, cy = box.y + bh / 2, col = colOf(cl.group) || t.muted, hot = hoverLab && hoverLab.L === L && hoverLab.i === i;
        c.save();
        if (Math.abs(cx - sx) + Math.abs(cy - sy) > 2) { c.strokeStyle = col; c.globalAlpha = 0.6; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, sy); c.lineTo(cx, cy + (cy > sy ? -bh / 2 : bh / 2)); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(sx, sy, 2.5, 0, 7); c.fill(); c.globalAlpha = 1; }
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = f1; c.shadowColor = col; c.shadowBlur = hot ? 22 : 14; c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = rgba(t.bg.length === 7 ? t.bg : '#ffffff', 0.92);
        const yy = l2 ? cy - 8 : cy; c.strokeText(l1, cx, yy); c.shadowBlur = 0; c.fillStyle = t.text; c.fillText(l1, cx, yy);
        if (l2) { c.font = f2; c.lineWidth = 4; c.strokeText(l2, cx, cy + 10); c.fillStyle = L === 0 ? t.muted : col; c.fillText(l2, cx, cy + 10); }
        if (L === 0 && colOf(cl.group)) { c.fillStyle = col; c.beginPath(); c.arc(cx - w1 / 2 - 9, yy, 4.5, 0, 7); c.fill(); }
        if (hot) { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.rect(box.x - 4, box.y - 3, box.w + 8, box.h + 6); c.stroke(); }
        c.restore(); labels.push({ box, cl, i, L });
      });
    }
    const showTip = (e, html) => { tip.innerHTML = html; tip.style.display = 'block'; const r = plot.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      tip.style.left = Math.max(0, Math.min(x + 14, W - tip.offsetWidth - 2)) + 'px'; tip.style.top = (y + 16 + tip.offsetHeight > H ? y - tip.offsetHeight - 10 : y + 16) + 'px'; };
    const hideTip = () => { tip.style.display = 'none'; };
    const labelTip = l => o.labelTooltip ? o.labelTooltip(l) : '<b>' + esc(l.L === 0 ? l.cl.value : (l.cl.words.join(' · ') || l.cl.value)) + '</b><br>' + l.cl.n + ' points' + (l.L > 0 && l.cl.group != null ? ' · ' + esc(l.cl.group) : '') + (l.cl.words.length ? '<br>' + esc(l.cl.words.join(', ')) : '');
    const pointTip = p => o.tooltip ? o.tooltip(p) : '<b>' + esc(p.group != null ? p.group : (o.ungroupedLabel || 'no group')) + '</b>' + (p.text ? '<br>' + esc(p.text) : '');
    const labelAt = (mx, my) => labels.find(l => mx >= l.box.x && mx <= l.box.x + l.box.w && my >= l.box.y && my <= l.box.y + l.box.h);
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function zoomAt(f, sx, sy) { const nz = Math.max(0.8, Math.min(14, z * f)), k = nz / z; tx = sx - (sx - tx) * k; ty = sy - (sy - ty) * k; z = nz; draw(); }
    let dragging = false, start = null, moved = false;
    const onWheel = e => { if (!active && !e.ctrlKey) { hint.textContent = o.hint || 'click the map, then scroll to zoom'; hint.classList.add('ck-semantic-map-hint--on'); clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove('ck-semantic-map-hint--on'), 1400); return; }
      e.preventDefault(); const [mx, my] = pos(e); zoomAt(Math.exp(-e.deltaY * 0.0015), mx, my); };
    const onDown = e => { active = true; plot.classList.add('ck-semantic-map-plot--active'); hint.classList.remove('ck-semantic-map-hint--on'); dragging = true; moved = false; start = [e.clientX, e.clientY, tx, ty]; cv.setPointerCapture(e.pointerId); };
    const onUp = e => { dragging = false; cv.classList.remove('ck-semantic-map-drag'); if (!moved) { const [mx, my] = pos(e), lab = labelAt(mx, my); if (lab) { hideTip(); if (o.onClick) o.onClick(null, { field: lab.cl.field, value: lab.cl.value, n: lab.cl.n, x: lab.cl.x, y: lab.cl.y, group: lab.cl.group, words: lab.cl.words }); } else if (hoverPt) { hideTip(); if (o.onClick) o.onClick(hoverPt, null); } } };
    const onDbl = e => { const [mx, my] = pos(e); zoomAt(2, mx, my); };
    const onMove = e => { const [mx, my] = pos(e);
      if (dragging) { const dx = e.clientX - start[0], dy = e.clientY - start[1]; if (Math.abs(dx) + Math.abs(dy) > 3) { moved = true; cv.classList.add('ck-semantic-map-drag'); } tx = start[2] + dx; ty = start[3] + dy; hideTip(); draw(); return; }
      const lab = labelAt(mx, my);
      if (lab) { hoverPt = null; hoverLab = { L: lab.L, i: lab.i }; draw(); cv.style.cursor = 'pointer'; showTip(e, labelTip(lab)); return; }
      hoverLab = null; cv.style.cursor = ''; let b = null, bd = 81;
      P.forEach(p => { const [sx, sy] = toScreen(p.x, p.y), d = (sx - mx) ** 2 + (sy - my) ** 2; if (d < bd) { bd = d; b = p; } });
      hoverPt = b; draw(); if (b) showTip(e, pointTip(b)); else hideTip(); };
    const onLeave = () => { active = false; plot.classList.remove('ck-semantic-map-plot--active'); if (dragging) return; hoverPt = null; hoverLab = null; draw(); hideTip(); };
    function drawChips() { if (!chipRow) return; chipRow.textContent = '';
      Object.keys(slot).sort((a, b) => slot[a] - slot[b]).forEach(g => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ck-chip' + (focusTag === g ? ' ck-chip--on' : '');
        const i = document.createElement('i'); i.style.background = colOf(g); b.appendChild(i); b.appendChild(document.createTextNode(g));
        b.addEventListener('mouseenter', () => { if (focusTag == null) { focusTag = g; draw(); focusTag = null; } }); b.addEventListener('mouseleave', () => draw());
        b.addEventListener('click', () => setFocus(focusTag === g ? null : g)); chipRow.appendChild(b); }); }
    function setFocus(g) { focusTag = g == null ? null : g; drawChips(); draw(); }
    function reset() { z = 1; tx = 0; ty = 0; setFocus(null); }
    if (o.buttons !== false) [['+', () => zoomAt(1.6, W / 2, H / 2)], ['−', () => zoomAt(1 / 1.6, W / 2, H / 2)], ['↺', reset]].forEach(([txt, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.addEventListener('click', fn); tools.appendChild(b); });
    cv.addEventListener('wheel', onWheel, { passive: false }); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointerup', onUp); cv.addEventListener('dblclick', onDbl); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerleave', onLeave);
    const ro = global.ResizeObserver ? new global.ResizeObserver(() => { if (plot.clientWidth && plot.clientWidth !== W) resize(); }) : null;
    if (ro) ro.observe(plot); else global.addEventListener('resize', resize);
    prepare(); drawChips(); resize();
    return {
      redraw(patch) { if (patch) { o = { ...o, ...patch }; if ('focus' in patch) focusTag = patch.focus == null ? null : patch.focus; } prepare(); drawChips(); resize(); },
      focus: setFocus, reset,
      dispose() { if (ro) ro.disconnect(); else global.removeEventListener('resize', resize); node.textContent = ''; node.classList.remove('ck-semantic-map'); if (chipRow && o.chips && o.chips !== true) chipRow.textContent = ''; },
      node,
    };
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.semanticMap = semanticMap;
})(window);
