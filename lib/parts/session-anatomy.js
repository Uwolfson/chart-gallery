/* chart-gallery part — ChartKit.sessionAnatomy: one session on a time axis (hand-built SVG, no ECharts). Needs lib/parts/session-anatomy.css. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF'), surface: css('--ck-surface', '#F4F6F8') });
  const PALETTE = ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num1 = v => String(Math.round(v * 10) / 10);
  const fmtTime = s => (s < 60 ? Math.round(s) + ' s' : s < 3600 ? num1(s / 60) + ' min' : num1(s / 3600) + ' h');
  const LOG_TICKS = [0, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 14400, 28800];
  const LIN_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
  const WORDS = { items: 'items in the basket', queries: 'search queries', pause: 'pause', added: 'added item', plusOne: 'one more of item', removed: 'removed', card: 'opened', query: 'query',
    found: 'found', nothingFound: 'nothing found', at: 'at', typedLater: 'full text recorded later', start: 'start', end: 'end' };
  let uid = 0;

  /**
   * Session anatomy — what one person did in one session, on a shared time axis: lanes = screens / states as coloured segments
   * with a tick at every transition, a row of selection actions (numbered dot = new item, small dot = one more of an item, cross =
   * removed), a query row (diamond at the query start, red when nothing was found, a bar while results stayed on screen), small
   * diamonds where a card was opened, hatched pauses, an optional dashed highlight window and an optional step-line value track.
   * Native <title> tooltips; controls (scale, pause compression, alignment) are the caller's job through redraw(patch).
   * opts: { lanes: ['home', ...] (top to bottom), segments: [[t0, t1, laneIndex], ...], end?: seconds (default: last segment end),
   *         colors?: { [lane]: color } | [color per lane], scale?: 'linear' | 'log', compressPauses?: true, pauseAfter?: 120, pauseWidth?: 15,
   *         pauses?: [[t0, t1], ...] (default: gaps between segments longer than pauseAfter), span?: seconds (shared axis length; default: own),
   *         adds?: [{ t, n?, name, note? }] (n = item number; no n = "one more"), removes?: [{ t, name, note? }], cards?: [{ t, name, note?, lane? }],
   *         queries?: [{ t, text, found?, until?, late? }] (until = when results left the screen; late = text recorded after the item was added),
   *         events?: [{ t, label, color?, tip? }] (pins: dashed vertical line + dot + label), highlight?: { from, to, label?, short?, color?, tip? },
   *         valueTrack?: [{ t, v }] (step line with area fill above the rows), valueLabel?: 'trip total', valueStart?: 0, valueFormat?: v => string,
   *         formatTime?: t => string, words?: { items, queries, pause, added, plusOne, removed, card, query, found, nothingFound, at, typedLater, start, end } }
   * Returns { redraw(optsPatch?), dispose(), node }. The container gets its height from the number of lanes — do not set one.
   */
  function sessionAnatomy(el, opts) {
    const node = el$(el); let o = { ...opts }, lastW = -1; const id = 'ck-anatomy-hatch-' + (++uid);
    node.classList.add('ck-anatomy');
    const color = i => (Array.isArray(o.colors) ? o.colors[i] : o.colors && o.colors[o.lanes[i]]) || PALETTE[i % PALETTE.length];
    function draw() {
      const W = node.clientWidth; if (!W) return; lastW = W;
      const t = theme(), w = { ...WORDS, ...(o.words || {}) }, fmt = o.formatTime || fmtTime, lanes = o.lanes, nL = lanes.length, lh = 19;
      const segs = (o.segments || []).filter(s => s[1] > s[0]).sort((a, b) => a[0] - b[0]);
      const te = o.end != null ? o.end : Math.max(1, ...segs.map(s => s[1])), pauseAfter = o.pauseAfter == null ? 120 : o.pauseAfter, PW = o.pauseWidth == null ? 15 : o.pauseWidth;
      const pauses = o.pauses || segs.slice(1).map((s, i) => [segs[i][1], s[0]]).filter(p => p[1] - p[0] > pauseAfter);
      const comp = tt => { if (o.compressPauses === false) return tt; let c = tt; pauses.forEach(p => { const len = p[1] - p[0]; if (len <= PW) return; if (tt >= p[1]) c -= len - PW; else if (tt > p[0]) c -= (tt - p[0]) * (1 - PW / len); }); return c; };
      const log = o.scale === 'log', sc = x => (log ? Math.log(1 + x) : x);
      const left = Math.max(90, Math.min(Math.round(W * 0.3), Math.max(...lanes.map(l => l.length), (o.valueLabel || '').length, w.items.length, w.queries.length) * 6.6 + 16)), right = 16, pw = W - left - right;
      const span = sc(o.span != null ? Math.max(o.span, comp(te)) : comp(te)) || 1, X = tt => left + pw * sc(comp(Math.min(tt, te))) / span;
      const hasV = Array.isArray(o.valueTrack) && o.valueTrack.length > 0, hasE = (o.events || []).length > 0, hV = hasV ? 70 : 0, yV = 10 + (hasE ? 22 : 0);
      const yA = (hasV ? yV + hV + 24 : hasE ? 22 : 0) + 16, yQ = yA + 22, y0 = yQ + 20, yAx = y0 + nL * lh + 6, H = yAx + 24;
      const label = (x, y, text, cls) => '<text x="' + x + '" y="' + y + '" text-anchor="end" class="' + cls + '" fill="' + (cls === 'ck-anatomy-lane' ? t.muted : t.text) + '">' + esc(text) + '</text>';
      const tip = s => '<title>' + esc(s) + '</title>';
      let g = '';
      /* row titles and lane rules */
      g += label(left - 10, yA + 4, w.items, 'ck-anatomy-row') + label(left - 10, yQ + 4, w.queries, 'ck-anatomy-row');
      lanes.forEach((l, i) => { const y = y0 + i * lh + lh / 2; g += label(left - 10, y + 4, l, 'ck-anatomy-lane') + '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + y + '" y2="' + y + '" stroke="' + t.line + '"/>'; });
      /* value track: step line + area, start / end values */
      if (hasV) {
        const vs = [...o.valueTrack].sort((a, b) => a.t - b.t), v0 = o.valueStart == null ? vs[0].v : o.valueStart, vf = o.valueFormat || (v => String(Math.round(v)));
        const vmax = Math.max(1e-9, v0, ...vs.map(p => p.v)), Y = v => yV + hV - hV * Math.max(0, Math.min(v, vmax)) / vmax;
        g += label(left - 10, yV + 10, o.valueLabel || 'value', 'ck-anatomy-row') + label(left - 10, yV + 24, 'max ' + vf(vmax), 'ck-anatomy-lane');
        [0, 0.5, 1].forEach(f => { g += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + (yV + hV - hV * f) + '" y2="' + (yV + hV - hV * f) + '" stroke="' + t.line + '"/>'; });
        let d = 'M' + X(0) + ',' + Y(v0), prev = Y(v0);
        vs.forEach(p => { if (p.t > te) return; const x = X(p.t), y = Y(p.v); d += ' L' + x + ',' + prev + ' L' + x + ',' + y; prev = y; });
        const xe = X(te);
        g += '<path d="' + d + ' L' + xe + ',' + prev + ' L' + xe + ',' + (yV + hV) + ' L' + X(0) + ',' + (yV + hV) + ' Z" fill="' + PALETTE[0] + '" fill-opacity=".12"/><path d="' + d + ' L' + xe + ',' + prev + '" fill="none" stroke="' + PALETTE[0] + '" stroke-width="1.6"/>';
        g += '<text x="' + (X(0) + 4) + '" y="' + (Y(v0) - 4) + '" class="ck-anatomy-small" fill="' + t.muted + '">' + esc(w.start + ' ' + vf(v0)) + '</text><text x="' + (xe - 4) + '" y="' + (prev < yV + 14 ? prev + 12 : prev - 4) + '" text-anchor="end" class="ck-anatomy-small" fill="' + t.muted + '">' + esc(w.end + ' ' + vf(vs[vs.length - 1].v)) + '</text>';
      }
      /* pauses: hatched block across the lanes */
      pauses.forEach(p => { if (p[0] >= te) return; const a = X(p[0]), b = X(Math.min(p[1], te)); if (b - a < 1.5) return;
        g += '<rect x="' + a + '" y="' + (y0 - 2) + '" width="' + (b - a) + '" height="' + (nL * lh + 4) + '" fill="url(#' + id + ')">' + tip(w.pause + ' ' + fmt(p[1] - p[0])) + '</rect>';
        g += '<text x="' + ((a + b) / 2) + '" y="' + (y0 + nL * lh - 3) + '" text-anchor="middle" class="ck-anatomy-small" fill="' + t.muted + '">' + esc((b - a > 62 ? w.pause + ' ' : '') + fmt(p[1] - p[0])) + '</text>'; });
      /* highlight window */
      if (o.highlight && o.highlight.from < te) { const h = o.highlight, a = X(h.from), b = Math.max(X(Math.min(h.to, te)), a + 3), col = h.color || PALETTE[0];
        g += '<rect x="' + a + '" y="' + (yQ - 12) + '" width="' + (b - a) + '" height="' + (yAx - yQ + 12) + '" fill="' + col + '" fill-opacity=".09" stroke="' + col + '" stroke-opacity=".5" stroke-dasharray="4 3">' + (h.tip ? tip(h.tip) : '') + '</rect>';
        if (h.label) g += '<text x="' + (a + 3) + '" y="' + (yAx - 4) + '" class="ck-anatomy-small" font-weight="700" fill="' + col + '">' + esc(b - a > 150 ? h.label : h.short || h.label) + '</text>'; }
      /* lanes: segments and transition ticks */
      let prev = null;
      segs.forEach(s => { if (s[0] >= te) return; const a = X(s[0]), b = Math.max(X(s[1]), a + 1.5), y = y0 + s[2] * lh + lh / 2;
        if (prev != null) g += '<line x1="' + a + '" x2="' + a + '" y1="' + prev + '" y2="' + y + '" stroke="' + t.muted + '" stroke-opacity=".55"/>';
        g += '<rect x="' + a + '" y="' + (y - 4.5) + '" width="' + (b - a) + '" height="9" rx="3" fill="' + color(s[2]) + '">' + tip(lanes[s[2]] + ': ' + fmt(s[0]) + ' – ' + fmt(s[1]) + ' (' + fmt(s[1] - s[0]) + ')') + '</rect>'; prev = y; });
      /* opened cards: small diamond on the lane active at that moment */
      (o.cards || []).forEach(c => { if (c.t > te) return; const seg = segs.find(s => c.t >= s[0] && c.t <= s[1]), li = c.lane != null ? c.lane : seg ? seg[2] : 0, x = X(c.t), y = y0 + li * lh + lh / 2;
        g += '<rect x="' + (x - 4.5) + '" y="' + (y - 4.5) + '" width="9" height="9" transform="rotate(45 ' + x + ' ' + y + ')" fill="' + t.bg + '" stroke="' + color(li) + '" stroke-width="2">' + tip(w.card + ': ' + c.name + (c.note ? ' · ' + c.note : '') + ' · ' + w.at + ' ' + fmt(c.t)) + '</rect>'; });
      /* events: pins from the top row down to the axis */
      let lastE = -1e9, lvl = 0;
      (o.events || []).forEach(e => { if (e.t > te) return; const x = X(e.t), col = e.color || PALETTE[5]; lvl = x - lastE < 70 ? lvl + 1 : 0; lastE = x; const top = hasV ? yV - 6 : yA - 8;
        g += '<line x1="' + x + '" x2="' + x + '" y1="' + top + '" y2="' + yAx + '" stroke="' + col + '" stroke-width="1.2" stroke-dasharray="3 3"/><circle cx="' + x + '" cy="' + (top - 2) + '" r="5" fill="' + col + '" stroke="' + t.bg + '" stroke-width="1.2">' + tip((e.tip || e.label) + ' · ' + w.at + ' ' + fmt(e.t)) + '</circle>';
        const flip = x + 8 + String(e.label).length * 5.8 > W - right;                             // label to the left of the pin when it would run off the right edge
        if (lvl < 3) g += '<text x="' + (flip ? x - 8 : x + 8) + '" y="' + (top + 1 - (lvl % 3) * 11) + '"' + (flip ? ' text-anchor="end"' : '') + ' class="ck-anatomy-small" font-weight="600" fill="' + col + '">' + esc(e.label) + '</text>'; });
      /* queries: diamond at the start, bar while results were shown, label where it fits */
      const qs = [...(o.queries || [])].sort((a, b) => a.t - b.t); let lastQ = -1e9;
      qs.forEach((q, qi) => { if (q.t > te) return; const nx = qs[qi + 1] && qs[qi + 1].t <= te ? X(qs[qi + 1].t) : 1e9, x = X(q.t), text = q.text || '', lab = text.length > 16 ? text.slice(0, 15) + '…' : text, lw = lab.length * 6.4 + 14;
        const xl = q.until != null ? X(Math.min(q.until, te)) : x, none = q.found === 0, col = none ? '#E11D48' : PALETTE[0];
        const tp = tip(w.query + ' "' + text + '"' + (q.found != null ? ' · ' + (none ? w.nothingFound : w.found + ' ' + q.found) : '') + ' · ' + w.at + ' ' + fmt(q.t) + (q.late ? ' · ' + w.typedLater : ''));
        if (xl - x > 2) g += '<line x1="' + x + '" x2="' + xl + '" y1="' + (yQ + 9) + '" y2="' + (yQ + 9) + '" stroke="' + col + '" stroke-opacity=".55" stroke-width="2"' + (q.late ? ' stroke-dasharray="3 2"' : '') + '/><line x1="' + xl + '" x2="' + xl + '" y1="' + (yQ + 5) + '" y2="' + (yQ + 13) + '" stroke="' + col + '" stroke-opacity=".7" stroke-width="1.5"/>';
        g += '<line x1="' + x + '" x2="' + x + '" y1="' + (yQ + 5) + '" y2="' + yAx + '" stroke="' + col + '" stroke-opacity=".3"/><path d="M' + x + ',' + (yQ - 5) + 'l5,5l-5,5l-5,-5z" fill="' + col + '">' + tp + '</path>';
        if (x - lastQ > 8 && x + lw < Math.min(W - 2, nx - 4)) { g += '<text x="' + (x + 8) + '" y="' + (yQ + 4) + '" class="ck-anatomy-q" fill="' + t.text + '">' + esc(lab) + tp + '</text>'; lastQ = x + lw; }
        else if (x - lw > Math.max(lastQ, left)) { g += '<text x="' + (x - 8) + '" y="' + (yQ + 4) + '" text-anchor="end" class="ck-anatomy-q" fill="' + t.text + '">' + esc(lab) + tp + '</text>'; lastQ = x + 6; }
        else lastQ = Math.max(lastQ, x + 6); });
      /* selection actions: numbered dot, small dot, cross */
      (o.adds || []).forEach(a => { if (a.t > te) return; const x = X(a.t), tp = tip((a.n != null ? w.added + ' #' + a.n : w.plusOne) + ': ' + a.name + (a.note ? ' · ' + a.note : '') + ' · ' + w.at + ' ' + fmt(a.t));
        if (a.n != null) g += '<line x1="' + x + '" x2="' + x + '" y1="' + (yA + 8) + '" y2="' + yAx + '" stroke="' + t.text + '" stroke-opacity=".13"/><circle cx="' + x + '" cy="' + yA + '" r="8" fill="' + t.text + '" stroke="' + t.bg + '" stroke-width="1.2">' + tp + '</circle><text x="' + x + '" y="' + (yA + 3.6) + '" text-anchor="middle" class="ck-anatomy-n" fill="' + t.bg + '" pointer-events="none">' + a.n + '</text>';
        else g += '<circle cx="' + x + '" cy="' + (yA + 5) + '" r="3" fill="' + t.muted + '">' + tp + '</circle>'; });
      (o.removes || []).forEach(r => { if (r.t > te) return; g += '<text x="' + X(r.t) + '" y="' + (yA + 5) + '" text-anchor="middle" class="ck-anatomy-x" fill="#E11D48">✕' + tip(w.removed + ': ' + r.name + (r.note ? ' · ' + r.note : '') + ' · ' + w.at + ' ' + fmt(r.t)) + '</text>'; });
      /* time axis: ticks outside pauses, end mark */
      g += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + yAx + '" y2="' + yAx + '" stroke="' + t.muted + '" stroke-opacity=".6"/>';
      let ticks = [];
      if (log) ticks = LOG_TICKS.filter(v => v <= te);
      else { const total = o.span != null ? Math.max(o.span, comp(te)) : comp(te), step = LIN_STEPS.find(s => total / s <= 12) || 28800; for (let v = 0; v <= te + 1e-6; v += step) ticks.push(v); }
      let lastX = -1e9;
      ticks.forEach(v => { if (o.compressPauses !== false && pauses.some(p => v > p[0] && v < p[1])) return; const x = X(v); if (x - lastX < 42) return; lastX = x;
        g += '<line x1="' + x + '" x2="' + x + '" y1="' + yAx + '" y2="' + (yAx + 4) + '" stroke="' + t.muted + '"/><text x="' + x + '" y="' + (yAx + 16) + '" text-anchor="middle" class="ck-anatomy-small" fill="' + t.muted + '">' + (v === 0 ? '0' : esc(fmt(v))) + '</text>'; });
      g += '<line x1="' + X(te) + '" x2="' + X(te) + '" y1="' + (y0 - 2) + '" y2="' + yAx + '" stroke="' + t.muted + '" stroke-width="1.2"/>';
      node.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img"><defs><pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="' + t.surface + '"/><line x1="0" y1="0" x2="0" y2="6" stroke="' + t.muted + '" stroke-opacity=".35" stroke-width="2"/></pattern></defs>' + g + '</svg>';
    }
    const onResize = () => { const w = node.clientWidth; if (w && w !== lastW) draw(); };
    const ro = global.ResizeObserver ? new global.ResizeObserver(onResize) : null;
    if (ro) ro.observe(node); else global.addEventListener('resize', onResize);
    draw();
    return {
      redraw(patch) { if (patch) o = { ...o, ...patch }; lastW = -1; draw(); },
      dispose() { if (ro) ro.disconnect(); else global.removeEventListener('resize', onResize); node.textContent = ''; node.classList.remove('ck-anatomy'); },
      node,
    };
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.sessionAnatomy = sessionAnatomy;
})(window);
