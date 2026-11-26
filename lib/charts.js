/*!
 * chart-gallery — a small set of reusable chart recipes for behavioural / segment analysis.
 * Built on Apache ECharts 5 (global `echarts`). No framework, no build step.
 *
 *   ChartKit.stateTimeline(el, opts)   small multiples: where each segment is at every time mark
 *   ChartKit.stateStack(el, opts)      100% stacked area of states over time; click a layer to isolate it
 *   ChartKit.sequenceIndex(el, opts)   one thin strip per session, colour = state (plain canvas)
 *   ChartKit.segmentTree(el, opts)     rule-based segments as a left-to-right tree
 *   ChartKit.divergingBars(el, opts)   what moves a metric up and down
 *   ChartKit.groupedBars(el, opts)     two or three metrics side by side on one scale
 *   ChartKit.flowSankey(el, opts)      three-column flow with clickable nodes
 *   ChartKit.segmentMap(el, opts)      scatter map with label de-overlap
 *   ChartKit.ladder(el, opts)          "100 -> N" funnel ladder (plain HTML)
 *   ChartKit.heatTable(el, opts)       segments x variables table with above/below-average shading
 *
 * Every function returns the ECharts instance (or the DOM node for the HTML ones). The two interactive recipes,
 * stateStack and sequenceIndex, redraw themselves and therefore return a small controller: { redraw(patch), dispose(), ... }.
 */
(function (global) {
  'use strict';

  const PALETTE = ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const HI = '#2563EB', LO = '#F97316', NEUTRAL = '#B6C0CC';

  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const pct = v => Math.round(v) + '%';
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);

  /**
   * State timeline — one small panel per segment; each panel is a 100% stacked bar per time mark.
   * opts: { segments: [{ name, share?, value? }], marks: [0, 5, ...], states: ['home', ...],
   *         data: { [segment]: { [state]: [pct per mark] } }, colors?: { [state]: color }, columns?: 4, unit?: 's',
   *         base?: overall value, valueLabel?: 'booking rate', shareLabel?: 'of visits', sortByValue?: true }
   * If segments carry `value` (the outcome), panels are sorted by it and the subtitle is coloured above / below `base`.
   */
  function stateTimeline(el, o) {
    const t = theme(), cols = o.columns || 4, rows = Math.ceil(o.segments.length / cols), unit = o.unit == null ? 's' : o.unit;
    const gx = 3, gy = 13, pw = (97.5 - gx * (cols - 1)) / cols, top0 = 13, ph = (100 - top0 - gy * (rows - 1) - 4) / rows;
    const color = s => (o.colors && o.colors[s]) || PALETTE[o.states.indexOf(s) % PALETTE.length];
    const grid = [], xAxis = [], yAxis = [], series = [], title = [];
    const hasValue = o.segments.some(s => s.value != null), vl = o.valueLabel || 'value', sl = o.shareLabel || 'share';
    const segs = hasValue && o.sortByValue !== false ? [...o.segments].sort((a, b) => b.value - a.value) : o.segments;   // panels ordered by the outcome, high to low
    segs.forEach((seg, i) => {
      const left = (i % cols) * (pw + gx), top = top0 + Math.floor(i / cols) * (ph + gy);
      grid.push({ left: left + '%', top: top + '%', width: pw + '%', height: (ph - 5) + '%' });
      const sub = [seg.value != null ? vl + ' ' + pct(seg.value) : null, seg.share != null ? pct(seg.share) + ' ' + sl : null].filter(Boolean).join(' · ');
      title.push({ text: seg.name, subtext: sub, left: left + '%', top: (top - 8.4) + '%', itemGap: 2, textStyle: { fontSize: 12.5, fontWeight: 700, color: t.text },
        subtextStyle: { fontSize: 12, fontWeight: 700, color: seg.value == null || o.base == null ? t.muted : (seg.value >= o.base ? HI : LO) } });
      xAxis.push({ type: 'category', gridIndex: i, data: o.marks.map(String), axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { color: t.muted, fontSize: 10, interval: Math.max(0, Math.round(o.marks.length / 4) - 1), formatter: v => v + (unit ? ' ' + unit : '') } });
      yAxis.push({ type: 'value', gridIndex: i, max: 100, show: false });
      o.states.forEach(s => series.push({ type: 'bar', name: s, stack: 'p' + i, xAxisIndex: i, yAxisIndex: i, data: o.data[seg.name][s],
        barCategoryGap: '6%', itemStyle: { color: color(s) }, emphasis: { focus: 'series' } }));
    });
    return mount(el, { title, grid, xAxis, yAxis, series,
      legend: { top: 0, left: 0, data: o.states, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 } },
      tooltip: { trigger: 'item', formatter: p => p.seriesName + ' at ' + p.name + (unit ? ' ' + unit : '') + ': ' + pct(p.value) } });
  }

  /**
   * State stack — a 100% stacked area: the share of every state at each time mark. Click a layer (or its chip) to isolate
   * that state: it is redrawn alone from the baseline with value labels; click the chart (or the "all states" chip) to go back.
   * opts: { labels: ['0', '1 s', ...], states: ['home', ...] (bottom to top), data: { [state]: [pct per mark] }, normalize?: false,
   *         colors?: { [state]: color }, base?: [units behind each mark], minBase?: number, lowBaseLabel?: 'small base', baseLabel?: 'base',
   *         chips?: element | id | false, allLabel?: 'all states', isolated?: state | null, onIsolate?: (state | null) => void,
   *         labelEvery?: 1 | (index => boolean) }
   * `normalize: true` rescales every mark to sum to 100. Marks whose `base` is below `minBase` are dimmed and labelled.
   * `chips` is where the chip buttons go; by default a row is created right above the chart, `false` turns chips off.
   * The chart is re-created on every redraw. Returns { isolate(state | null), redraw(optsPatch?), dispose(), chart() }.
   */
  function stateStack(el, opts) {
    const node = el$(el); let o = { ...opts }, iso = o.isolated || null, ch = null, ownRow = null, dead = false;
    const every = i => (typeof o.labelEvery === 'function' ? !!o.labelEvery(i) : i % (o.labelEvery || 1) === 0);
    const color = s => (o.colors && o.colors[s]) || PALETTE[o.states.indexOf(s) % PALETTE.length];
    const set = s => { s = s || null; if (dead || s === iso) return; iso = s; draw(); if (o.onIsolate) o.onIsolate(iso); };
    const later = s => setTimeout(() => set(s), 0);                      // never dispose a chart from inside its own event handler
    const chipRow = () => { if (o.chips === false) return null; if (o.chips) return el$(o.chips);
      if (!ownRow) { ownRow = document.createElement('div'); node.parentNode.insertBefore(ownRow, node); } return ownRow; };
    function drawChips() {
      const row = chipRow(); if (!row) return;
      row.classList.add('ck-chips'); row.textContent = '';
      const add = (text, key, col) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ck-chip' + (iso === key ? ' ck-chip--on' : '');
        if (col) { const i = document.createElement('i'); i.style.background = col; b.appendChild(i); }
        b.appendChild(document.createTextNode(text)); b.addEventListener('click', () => set(key)); row.appendChild(b); };
      add(o.allLabel || 'all states', null, null); o.states.forEach(s => add(s, s, color(s)));
    }
    function draw() {
      const t = theme(), n = o.labels.length;
      if (iso && !o.states.includes(iso)) iso = null;
      const sums = o.labels.map((_, k) => o.states.reduce((a, s) => a + (+o.data[s][k] || 0), 0));
      const val = s => (o.normalize ? o.data[s].map((v, k) => (sums[k] > 0 ? 100 * v / sums[k] : 0)) : o.data[s]);
      drawChips();
      const peak = iso ? Math.max(...val(iso)) * 1.15 : 100, unit = peak <= 10 ? 2 : peak <= 50 ? 10 : 20;   // isolated: a round axis maximum just above the peak
      const shown = iso ? [iso] : o.states, yMax = iso ? Math.min(100, Math.max(unit, Math.ceil(peak / unit) * unit)) : 100;
      const series = shown.map(s => ({ type: 'line', name: s, stack: iso ? undefined : 'ck', data: val(s), smooth: 0.25, symbol: iso ? 'circle' : 'none', symbolSize: 4, triggerLineEvent: true, cursor: 'pointer',
        lineStyle: { width: iso ? 2 : 0.8, color: iso ? color(s) : t.bg }, itemStyle: { color: color(s) }, areaStyle: { color: color(s), opacity: iso ? 0.4 : 1 }, emphasis: { disabled: true },
        label: iso ? { show: true, position: 'top', distance: 4, fontSize: 11, color: t.text, formatter: p => (every(p.dataIndex) ? Math.round(p.value) : '') } : undefined }));
      if (ch) ch.dispose();
      ch = echarts.init(node, null, { renderer: 'svg' });
      ch.setOption({ animation: false,
        title: { text: iso ? '"' + iso + '" alone — click the chart to bring all states back' : '', left: 46, top: 4, textStyle: { color: t.muted, fontSize: 12, fontWeight: 400 } },
        tooltip: { trigger: 'axis', formatter: ps => { const k = ps[0].dataIndex;
          return '<b>' + o.labels[k] + '</b>' + (o.base ? ' · ' + (o.baseLabel || 'base') + ' ' + Number(o.base[k]).toLocaleString('en-US') : '') + '<br>' + [...ps].reverse().map(p => p.marker + p.seriesName + ': ' + pct(p.value)).join('<br>'); } },
        grid: { left: 46, right: 30, top: 30, bottom: 30 },
        xAxis: { type: 'category', boundaryGap: false, data: o.labels, axisTick: { show: false }, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted, fontSize: 11, interval: i => every(i) } },
        yAxis: { type: 'value', min: 0, max: yMax, axisLabel: { color: t.muted, formatter: v => v + '%' }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } } },
        series });
      if (o.base && o.minBase != null) {                                 // dim every run of marks where the base is too small to read
        const X = k => ch.convertToPixel({ xAxisIndex: 0 }, k), yTop = ch.convertToPixel({ yAxisIndex: 0 }, yMax), yZero = ch.convertToPixel({ yAxisIndex: 0 }, 0);
        const half = n > 1 ? (X(1) - X(0)) / 2 : 0, text = o.lowBaseLabel || 'small base', graphic = [];
        for (let i = 0; i < n; i++) {
          if (!(o.base[i] < o.minBase)) continue;
          let j = i; while (j + 1 < n && o.base[j + 1] < o.minBase) j++;
          const x0 = i === j && i > 0 ? X(i) - half : X(i), x1 = i === j && j < n - 1 ? X(j) + half : X(j);
          graphic.push({ type: 'rect', silent: true, z: 100, shape: { x: x0, y: yTop, width: x1 - x0, height: yZero - yTop }, style: iso ? { fill: 'rgba(120,140,160,.16)' } : { fill: t.bg, opacity: 0.55 } });
          if (x1 - x0 > text.length * 6.2 + 8) graphic.push({ type: 'text', silent: true, z: 101, x: (x0 + x1) / 2, y: yTop + 8, style: { text, fill: t.text, fontSize: 11, textAlign: 'center' } });
          i = j;
        }
        if (graphic.length) ch.setOption({ graphic });
      }
      if (iso) ch.getZr().on('click', () => later(null));
      else ch.on('click', p => { if (p.componentType === 'series' && o.states.includes(p.seriesName)) later(p.seriesName); });
    }
    const onResize = () => { if (!dead && node.offsetWidth) draw(); };
    global.addEventListener('resize', onResize);
    draw();
    return {
      isolate: set,
      redraw(patch) { if (dead) return; if (patch) { o = { ...o, ...patch }; if ('isolated' in patch) iso = patch.isolated || null; } draw(); },
      dispose() { dead = true; global.removeEventListener('resize', onResize); if (ch) ch.dispose(); ch = null;
        if (ownRow) ownRow.remove(); else if (o.chips) { const row = el$(o.chips); if (row) row.textContent = ''; } },
      chart: () => ch,
    };
  }

  const num1 = v => String(Math.round(v * 10) / 10);
  const fmtTime = s => (s < 60 ? Math.round(s) + ' s' : s < 3600 ? num1(s / 60) + ' min' : num1(s / 3600) + ' h');   // seconds -> '12 s', '2.5 min', '1.2 h'
  const LOG_TICKS = [1, 60, 3600].flatMap(u => [1, 3, 10, 30].map(m => m * u));                                      // 1 s, 3 s, 10 s, 30 s, 1 min, ... 30 h
  const LIN_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400];

  /**
   * Sequence index — every thin strip is one unit (a session, a visit, a user) from its start to its end; colour = the state at
   * that moment. Strips are grouped (e.g. by outcome) and sorted by duration inside a group; a tick marks a key event. Plain canvas.
   * opts: { rows: [{ group, end, mark?, segments: [[t0, t1, stateIndex], ...] }], states: ['home', ...], colors?: { [state]: color },
   *         groups?: [{ key, label }] (top to bottom), scale?: 'log' | 'linear', maxTime?, ticks?: [t, ...], rowHeight?: 3,
   *         markColor?, markLabel?: 'key event', formatTime?: t => string, legend?: true,
   *         tooltip?: true | false | ((row, time, stateName | null, groupLabel) => html) }
   * Time is in seconds by default (pass `ticks` and `formatTime` for another unit). The log axis is log10(t + 1), so zero stays on it.
   * Without `groups`, groups are the distinct `group` values in order of appearance; rows of a group that is not listed are skipped.
   * Segments beyond `maxTime` are clipped. The container gets its height from the number of rows — do not set one.
   * Returns { redraw(optsPatch?), dispose(), node }.
   */
  function sequenceIndex(el, opts) {
    const node = el$(el); let o = { ...opts }, G = null, lastW = -1;
    node.classList.add('ck-seq'); node.textContent = '';
    const legend = document.createElement('div'), box = document.createElement('div'), cv = document.createElement('canvas'), tip = document.createElement('div');
    legend.className = 'ck-legend'; box.className = 'ck-seq__plot'; tip.className = 'ck-seq__tip';
    box.appendChild(cv); box.appendChild(tip); node.appendChild(legend); node.appendChild(box);
    const color = i => (o.colors && o.colors[o.states[i]]) || PALETTE[i % PALETTE.length];
    const markColor = () => o.markColor || '#E11D48', markLabel = () => o.markLabel || 'key event';

    function drawLegend() {
      legend.textContent = ''; legend.style.display = o.legend === false ? 'none' : '';
      const add = (text, col, cls) => { const s = document.createElement('span'), i = document.createElement('i'); i.style.background = col; if (cls) i.className = cls;
        s.appendChild(i); s.appendChild(document.createTextNode(text)); legend.appendChild(s); };
      o.states.forEach((s, i) => add(s, color(i)));
      if (o.rows.some(r => r.mark != null)) add(markLabel(), markColor(), 'ck-legend__mark');
    }
    function draw() {
      const W = box.clientWidth; if (!W) return;
      const t = theme(), rh = o.rowHeight || 3, log = o.scale !== 'linear', fmt = o.formatTime || fmtTime;
      const keys = o.groups ? o.groups.map(g => g.key) : [...new Set(o.rows.map(r => r.group))];
      const groups = keys.map((k, i) => ({ label: o.groups ? o.groups[i].label : (k == null ? '' : String(k)), rows: o.rows.filter(r => r.group === k).sort((a, b) => a.end - b.end) })).filter(g => g.rows.length);
      const total = groups.reduce((a, g) => a + g.rows.length, 0), maxEnd = Math.max(1, ...o.rows.map(r => r.end));
      const linStep = m => LIN_STEPS.find(s => m / s <= 8) || m / 8;
      const TMAX = o.maxTime || (log ? (LOG_TICKS.find(v => v >= maxEnd) || maxEnd) : Math.ceil(maxEnd / linStep(maxEnd)) * linStep(maxEnd));
      const ticks = (o.ticks || (log ? [0].concat(LOG_TICKS) : Array.from({ length: Math.floor(TMAX / linStep(TMAX)) + 1 }, (_, i) => i * linStep(TMAX)))).filter(v => v <= TMAX);
      const L = groups.some(g => g.label) ? 30 : 8, R = 14, T = 24, B = 28, gap = 22, H = T + total * rh + Math.max(0, groups.length - 1) * gap + B;
      const dpr = global.devicePixelRatio || 1;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const K = Math.log10(TMAX + 1), f = v => (log ? Math.log10(v + 1) / K : v / TMAX), X = v => L + (W - L - R) * Math.min(1, Math.max(0, f(v)));
      const font = getComputedStyle(node).fontFamily || 'sans-serif';

      g.font = '11px ' + font; g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineWidth = 1;
      let lastRight = -1e9;                                               // time axis: a grid line for every tick, a label only where it fits
      ticks.forEach(v => { const x = Math.round(X(v)), s = fmt(v), w = g.measureText(s).width, x0 = Math.max(0, Math.min(W - w - 1, x - w / 2));
        g.strokeStyle = t.line; g.beginPath(); g.moveTo(x + 0.5, T - 5); g.lineTo(x + 0.5, H - B + 4); g.stroke();
        if (x0 < lastRight + 6) return;
        g.fillStyle = t.muted; g.fillText(s, x0, 9); g.fillText(s, x0, H - 12); lastRight = x0 + w; });

      const lay = []; let done = 0;
      groups.forEach((gr, gi) => {
        const y0 = T + done * rh + gi * gap, y1 = y0 + gr.rows.length * rh, h = rh > 2 ? rh - 0.6 : rh;
        gr.rows.forEach((r, i) => { const y = y0 + i * rh;
          r.segments.forEach(s => { if (s[0] > TMAX) return; const x0 = X(s[0]), x1 = X(Math.min(s[1], TMAX)); g.fillStyle = color(s[2]); g.fillRect(x0, y, Math.max(1.5, x1 - x0), h); }); });
        g.fillStyle = markColor();
        gr.rows.forEach((r, i) => { if (r.mark != null && r.mark <= TMAX) g.fillRect(X(r.mark) - 1.5, y0 + i * rh - 0.5, 3.5, rh + 0.4); });
        if (gr.label) { g.save(); g.font = '600 12px ' + font; g.textAlign = 'center'; g.fillStyle = t.text;
          const full = gr.label + ' · ' + gr.rows.length, side = g.measureText(full).width <= y1 - y0 + gap - 8 ? full : gr.label;
          g.translate(12, (y0 + y1) / 2); g.rotate(-Math.PI / 2); g.fillText(side, 0, 0); g.restore(); }
        lay.push({ y0, y1, rows: gr.rows, label: gr.label }); done += gr.rows.length;
      });
      G = { L, R, W, rh, TMAX, K, log, lay, fmt }; lastW = W;
    }
    function onMove(e) {
      if (!G || o.tooltip === false) return;
      const b = box.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, fr = (x - G.L) / (G.W - G.L - G.R), gr = G.lay.find(a => y >= a.y0 && y < a.y1);
      if (!gr || fr < 0 || fr > 1) { tip.style.display = 'none'; return; }
      const r = gr.rows[Math.min(gr.rows.length - 1, Math.floor((y - gr.y0) / G.rh))], tm = G.log ? Math.pow(10, fr * G.K) - 1 : fr * G.TMAX;
      const sg = r.segments.find(s => tm >= s[0] && tm <= s[1]), state = sg ? o.states[sg[2]] : null;
      if (typeof o.tooltip === 'function') tip.innerHTML = o.tooltip(r, tm, state, gr.label);
      else { tip.textContent = '';
        tip.appendChild(document.createTextNode((gr.label ? gr.label + ', ' : '') + 'lasted ' + G.fmt(r.end) + (r.mark != null ? ', ' + markLabel() + ' at ' + G.fmt(r.mark) : '')));
        tip.appendChild(document.createElement('br'));
        tip.appendChild(document.createTextNode('at ' + G.fmt(tm) + ': ' + (state || (tm > r.end ? 'already ended' : 'no data')))); }
      tip.style.display = 'block'; tip.style.left = Math.max(0, Math.min(x + 14, G.W - tip.offsetWidth - 2)) + 'px'; tip.style.top = (y + 14) + 'px';
    }
    const onLeave = () => { tip.style.display = 'none'; };
    const onResize = () => { const w = box.clientWidth; if (w && w !== lastW) draw(); };
    const ro = global.ResizeObserver ? new global.ResizeObserver(onResize) : null;
    box.addEventListener('mousemove', onMove); box.addEventListener('mouseleave', onLeave);
    if (ro) ro.observe(box); else global.addEventListener('resize', onResize);
    drawLegend(); draw();
    return {
      redraw(patch) { if (patch) o = { ...o, ...patch }; onLeave(); drawLegend(); draw(); },
      dispose() { if (ro) ro.disconnect(); else global.removeEventListener('resize', onResize);
        box.removeEventListener('mousemove', onMove); box.removeEventListener('mouseleave', onLeave); node.textContent = ''; node.classList.remove('ck-seq'); G = null; },
      node,
    };
  }

  /**
   * Segment tree — every condition is written once, on its own split.
   * opts: { tree: { name, share, value, n?, children?: [...] }, base: overall value, valueLabel?: 'booking rate', shareLabel?: 'of visits', spread?: 18 }
   * Node size = share, node colour = value above (blue) / below (orange) the base.
   */
  function segmentTree(el, o) {
    const t = theme(), spread = o.spread || 18, vl = o.valueLabel || 'value', sl = o.shareLabel || 'share';
    const colorOf = v => { const d = v - o.base; return d >= 0 ? mix(rgb(NEUTRAL), rgb(HI), Math.min(1, d / spread)) : mix(rgb(NEUTRAL), rgb(LO), Math.min(1, -d / spread)); };
    const deco = n => ({ name: n.name, value: n.share, metric: n.value, n: n.n, symbolSize: 8 + 26 * Math.sqrt(n.share / 100),
      itemStyle: { color: colorOf(n.value), borderColor: '#fff', borderWidth: 1.5 },
      label: { position: n.children ? 'left' : 'right', align: n.children ? 'right' : 'left', verticalAlign: 'middle', distance: 10 },
      children: n.children ? n.children.map(deco) : undefined });
    return mount(el, {
      tooltip: { formatter: p => p.data.name + '<br>' + sl + ': ' + pct(p.data.value) + (p.data.n != null ? ' (n = ' + p.data.n + ')' : '') + '<br>' + vl + ': ' + pct(p.data.metric) },
      series: [{ type: 'tree', data: [deco(o.tree)], orient: 'LR', symbol: 'circle', left: o.left || 190, right: o.right || 250, top: 20, bottom: 20,
        expandAndCollapse: false, roam: false, initialTreeDepth: -1, lineStyle: { color: t.muted, width: 1.4, curveness: 0.5, opacity: 0.5 },
        label: { color: t.text, fontSize: 12.5, lineHeight: 17, backgroundColor: t.bg, padding: [2, 5], borderRadius: 4,
          formatter: p => '{a|' + p.data.name + '}\n{b|' + pct(p.data.value) + ' ' + sl + ' · ' + vl + ' ' + pct(p.data.metric) + '}',
          rich: { a: { fontWeight: 700, fontSize: 12.5, color: t.text }, b: { fontSize: 11.5, color: t.muted } } } }] });
  }

  /**
   * Diverging bars — difference in a metric with vs without a factor (percentage points), sorted.
   * opts: { items: [{ name, withValue, withoutValue, share? }], unit?: 'pp' }
   */
  function divergingBars(el, o) {
    const t = theme(), unit = o.unit || 'pp';
    const items = [...o.items].map(d => ({ ...d, diff: d.withValue - d.withoutValue })).sort((a, b) => a.diff - b.diff);
    const lw = labelWidth(el, items.map(d => d.name), 0.36), m = Math.max(...items.map(d => Math.abs(d.diff))) * 2.1;
    return mount(el, {
      tooltip: { trigger: 'item', formatter: p => { const d = items[p.dataIndex]; return d.name + '<br>with: ' + pct(d.withValue) + ', without: ' + pct(d.withoutValue) + (d.share != null ? '<br>present in ' + pct(d.share) : ''); } },
      grid: { left: lw + 10, right: 12, top: 6, bottom: 2 }, xAxis: { type: 'value', show: false, min: -m, max: m },
      yAxis: { type: 'category', data: items.map(d => d.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break' } },
      series: [{ type: 'bar', barWidth: 15,
        data: items.map(d => ({ value: d.diff, itemStyle: { color: d.diff >= 0 ? HI : LO, borderRadius: 3 }, label: { position: d.diff >= 0 ? 'right' : 'left' } })),
        label: { show: true, color: t.text, fontSize: 11.5, formatter: p => { const d = items[p.dataIndex]; return (d.diff >= 0 ? '+' : '−') + Math.abs(Math.round(d.diff)) + ' ' + unit + ' (' + pct(d.withValue) + ' vs ' + pct(d.withoutValue) + ')'; } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted }, label: { show: false }, data: [{ xAxis: 0 }] } }] });
  }

  /**
   * Grouped bars — "if you need to compare, put them side by side": several metrics per category on ONE scale.
   * opts: { names: [...], series: [{ name, values, color? }], format?: v => string }
   */
  function groupedBars(el, o) {
    const t = theme(), fmt = o.format || pct, one = o.series.length === 1, lw = labelWidth(el, o.names, 0.4);
    return mount(el, {
      legend: one ? undefined : { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
      grid: { left: lw + 10, right: 46, top: one ? 6 : 30, bottom: 2 },
      xAxis: { type: 'value', show: false, max: Math.max(...o.series.flatMap(s => s.values)) * 1.12 },
      yAxis: { type: 'category', data: [...o.names].reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break', lineHeight: 15 } },
      series: o.series.map((s, i) => ({ type: 'bar', name: s.name, data: [...s.values].reverse(), barWidth: 13, barGap: '18%', itemStyle: { color: s.color || PALETTE[i % PALETTE.length], borderRadius: 3 },
        label: { show: true, position: 'right', color: t.text, fontSize: 11.5, formatter: p => fmt(p.value) } })) });
  }

  /**
   * Barycenter ordering for a three-column flow: fewer crossings without changing the data.
   * links: [{ source, target, value }], columns: [[names col0], [names col1], [names col2]]; `pinLast` names stay at the bottom of col 2.
   */
  function orderFlow(columns, links, pinLast) {
    let [L, C, R] = columns.map(a => [...a]);
    const w = {}; links.forEach(l => { w[l.source + '\u0001' + l.target] = (w[l.source + '\u0001' + l.target] || 0) + l.value; });
    const bary = (n, others, forward) => { let s = 0, tot = 0; others.forEach((m, i) => { const v = forward ? (w[n + '\u0001' + m] || 0) : (w[m + '\u0001' + n] || 0); s += v * i; tot += v; }); return tot ? s / tot : 0; };
    for (let k = 0; k < 6; k++) {
      L = [...L].sort((a, b) => bary(a, C, true) - bary(b, C, true));
      const pinned = R.filter(n => (pinLast || []).includes(n));
      R = R.filter(n => !pinned.includes(n)).sort((a, b) => bary(a, C, false) - bary(b, C, false)).concat(pinned);
      C = [...C].sort((a, b) => (bary(a, L, false) / Math.max(1, L.length - 1) + bary(a, R, true) / Math.max(1, R.length - 1))
        - (bary(b, L, false) / Math.max(1, L.length - 1) + bary(b, R, true) / Math.max(1, R.length - 1)));
    }
    return [L, C, R];
  }

  /**
   * Flow sankey — three columns, nodes coloured by "family", links by source (col 0) or target (col 2), clickable nodes.
   * opts: { columns: [[...],[...],[...]], links: [{source,target,value}], colors: { [node]: color }, total?: number,
   *         labelOf?: (name, share) => string, onNodeClick?: name => void, reorder?: true, pinLast?: [names] }
   */
  function flowSankey(el, o) {
    const t = theme();
    const cols = o.reorder === false ? o.columns : orderFlow(o.columns, o.links, o.pinLast);
    const depth = {}; cols.forEach((c, d) => c.forEach(n => { depth[n] = d; }));
    const val = {}; o.links.forEach(l => { if (depth[l.source] === 0) val[l.source] = (val[l.source] || 0) + l.value; val[l.target] = (val[l.target] || 0) + l.value; });
    const total = o.total || cols[0].reduce((a, n) => a + (val[n] || 0), 0);
    const labelOf = o.labelOf || ((n, share) => n + '  ' + pct(share));
    const col = n => (o.colors && o.colors[n]) || NEUTRAL;
    const ch = mount(el, {
      tooltip: { trigger: 'item', formatter: p => p.dataType === 'edge' ? p.data.source + ' → ' + p.data.target + ': ' + p.data.value + ' (' + pct(100 * p.data.value / total) + ')' : p.name + ': ' + p.value + ' (' + pct(100 * p.value / total) + ')' },
      series: [{ type: 'sankey', left: o.left || 230, right: o.right || 260, top: 10, bottom: 10, nodeWidth: 14, nodeGap: 9, layoutIterations: 0, draggable: false, emphasis: { focus: 'adjacency' },
        data: cols.flatMap((c, d) => c.map(n => ({ name: n, depth: d, itemStyle: { color: col(n), borderColor: 'transparent' },
          label: { position: d === 0 ? 'left' : 'right', color: t.text, fontSize: 12, backgroundColor: d === 1 ? 'rgba(255,255,255,0.82)' : 'transparent', padding: [2, 4], borderRadius: 3,
            formatter: () => labelOf(n, 100 * (val[n] || 0) / total) } }))),
        links: o.links.map(l => ({ ...l, lineStyle: { color: depth[l.source] === 0 ? col(l.source) : col(l.target), opacity: 0.42, curveness: 0.5 } })) }] });
    if (o.onNodeClick) { ch.on('click', p => { if (p.dataType === 'node') o.onNodeClick(p.name); }); el$(el).style.cursor = 'pointer'; }
    return ch;
  }

  /**
   * Segment map — scatter (x = size, y = outcome) with automatic label placement (no overlaps) and leader lines.
   * opts: { points: [{ name, x, y, group?, color? }], xName, yName, xMax?, yMax?, reference?: { y, label }, symbols?: { [group]: 'circle' | 'diamond' | 'rect' } }
   */
  function segmentMap(el, o) {
    const t = theme(), node = el$(el);
    const sym = p => (o.symbols && o.symbols[p.group]) || 'circle';
    const xMax = o.xMax || Math.ceil(Math.max(...o.points.map(p => p.x)) / 10) * 10, yMax = o.yMax || Math.ceil(Math.max(...o.points.map(p => p.y)) / 10) * 10;
    const text = p => p.name + '  ' + pct(p.x) + ' · ' + pct(p.y);
    const dataOf = pos => o.points.map((p, i) => ({ name: p.name, value: [p.x, p.y], symbol: sym(p), symbolSize: 18, itemStyle: { color: p.color || PALETTE[0], borderColor: '#fff', borderWidth: 1.5 },
      label: pos ? { position: pos[i].pos, offset: pos[i].off } : undefined }));
    const axis = name => ({ type: 'value', min: 0, name, nameLocation: 'middle', nameTextStyle: { color: t.muted, fontSize: 13 }, axisLabel: { formatter: '{value}%', color: t.muted }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } } });
    const series = [{ type: 'scatter', z: 3, data: dataOf(null), label: { show: true, position: 'right', distance: 7, color: t.text, fontSize: 12, fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.86)', padding: [1, 3], borderRadius: 3, formatter: p => text(o.points[p.dataIndex]) } }];
    if (o.reference) series.push({ type: 'line', silent: true, z: 1, symbol: 'none', data: [[0, o.reference.y], [xMax, o.reference.y]], lineStyle: { type: 'dashed', color: t.muted, width: 1 },
      endLabel: { show: true, formatter: o.reference.label || '', color: t.muted, offset: [-150, -10] } });
    const ch = mount(el, { grid: { left: 60, right: 40, top: 20, bottom: 56 }, tooltip: { formatter: p => p.data.name ? text(o.points[p.dataIndex]) : '' },
      xAxis: { ...axis(o.xName), max: xMax, nameGap: 34 }, yAxis: { ...axis(o.yName), max: yMax, nameGap: 42 }, series });

    function place() {
      const cv = document.createElement('canvas').getContext('2d'); cv.font = '500 12px sans-serif';
      const W = ch.getWidth(), H = ch.getHeight();
      const it = o.points.map((p, i) => { const [x, y] = ch.convertToPixel({ seriesIndex: 0 }, [p.x, p.y]); return { i, x, y, w: cv.measureText(text(p)).width + 8 }; });
      const dots = it.map(a => [a.x - 11, a.y - 11, a.x + 11, a.y + 11]);
      const hit = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const cands = a => { const r = [];
        for (const dy of [0, -15, 15, -30, 30, -45, 45]) { r.push({ pos: 'right', off: [0, dy], box: [a.x + 13, a.y + dy - 8, a.x + 13 + a.w, a.y + dy + 8] }); r.push({ pos: 'left', off: [0, dy], box: [a.x - 13 - a.w, a.y + dy - 8, a.x - 13, a.y + dy + 8] }); }
        for (const dy of [0, 15]) { r.push({ pos: 'top', off: [0, -dy], box: [a.x - a.w / 2, a.y - 28 - dy, a.x + a.w / 2, a.y - 12 - dy] }); r.push({ pos: 'bottom', off: [0, dy], box: [a.x - a.w / 2, a.y + 12 + dy, a.x + a.w / 2, a.y + 28 + dy] }); }
        return r; };
      const placed = [], res = {};
      [...it].sort((a, b) => a.y - b.y || a.x - b.x).forEach(a => {
        let best = null, bestCost = Infinity;
        for (const c of cands(a)) {
          let cost = 0; const b = c.box;
          if (b[0] < 62 || b[2] > W - 8 || b[1] < 8 || b[3] > H - 58) cost += 1e5;
          placed.forEach(pb => { cost += hit(b, pb) * 10; }); dots.forEach((pb, k) => { if (k !== a.i) cost += hit(b, pb) * 10; });
          cost += Math.abs(c.off[1]) * 0.5 + (c.pos === 'right' ? 0 : 3);
          if (cost < bestCost) { bestCost = cost; best = c; }
          if (cost < 1) break;
        }
        placed.push(best.box); res[a.i] = best;
      });
      ch.setOption({ series: [{ data: dataOf(res) }],
        graphic: it.filter(a => res[a.i].off[1] !== 0 || res[a.i].pos === 'top' || res[a.i].pos === 'bottom').map(a => { const b = res[a.i].box;
          const tx = res[a.i].pos === 'right' ? b[0] : res[a.i].pos === 'left' ? b[2] : (b[0] + b[2]) / 2;
          return { type: 'line', silent: true, z: 1, shape: { x1: a.x, y1: a.y, x2: tx, y2: (b[1] + b[3]) / 2 }, style: { stroke: o.points[a.i].color || t.muted, lineWidth: 1, opacity: 0.7 } }; }) }, { replaceMerge: ['graphic'] });
    }
    setTimeout(place, 60);
    global.addEventListener('resize', () => { ch.resize(); place(); });
    node.__ckPlace = place;
    return ch;
  }

  /**
   * Ladder — "of 100 who started, N reached each step", with the loss written next to each rung. Plain HTML.
   * opts: { steps: [{ name, value, loss?: 'why they left', href?: '#anchor' }] }  (value on a 0–100 scale)
   */
  function ladder(el, o) {
    const node = el$(el); node.classList.add('ck-ladder');
    node.innerHTML = o.steps.map((s, i) => {
      const lost = i ? o.steps[i - 1].value - s.value : 0;
      const loss = i && s.loss ? '<span class="ck-ladder__loss">−' + Math.round(lost) + ' · ' + s.loss + '</span>' : '<span></span>';
      const name = s.href ? '<a class="ck-ladder__name" href="' + s.href + '">' + s.name + '</a>' : '<span class="ck-ladder__name">' + s.name + '</span>';
      return '<div class="ck-ladder__row">' + name + '<div class="ck-ladder__bar"><i style="width:' + s.value + '%"></i><b>' + Math.round(s.value) + '</b></div>' + loss + '</div>';
    }).join('');
    return node;
  }

  /**
   * Heat table — rows = variables, columns = segments; a cell is shaded only when it differs noticeably from the overall value.
   * opts: { rows: [...], columns: [{ name, sub? }], values: { [row]: [per column] }, overall: { [row]: number }, minAbs?: 3, minRel?: 0.15 }
   */
  function heatTable(el, o) {
    const node = el$(el), minAbs = o.minAbs == null ? 3 : o.minAbs, minRel = o.minRel == null ? 0.15 : o.minRel;
    const head = o.columns.map(c => '<th>' + c.name + (c.sub ? '<small>' + c.sub + '</small>' : '') + '</th>').join('') + '<th>all</th>';
    const body = o.rows.map(r => { const a = o.overall[r];
      const cells = o.values[r].map(v => { const d = (v - a) / Math.max(a, 8), big = Math.abs(v - a) >= minAbs && Math.abs(d) > minRel;
        const bg = !big ? 'transparent' : d > 0 ? 'rgba(37,99,235,' + Math.min(0.7, 0.14 + 0.8 * d).toFixed(2) + ')' : 'rgba(148,163,184,' + Math.min(0.6, 0.15 - 0.6 * d).toFixed(2) + ')';
        return '<td style="background:' + bg + '">' + pct(v) + '</td>'; }).join('');
      return '<tr><th>' + r + '</th>' + cells + '<td class="ck-muted">' + pct(a) + '</td></tr>'; }).join('');
    node.innerHTML = '<div class="ck-tw"><table class="ck-heat"><thead><tr><th></th>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
    return node;
  }

  global.ChartKit = { stateTimeline, stateStack, sequenceIndex, segmentTree, divergingBars, groupedBars, flowSankey, orderFlow, segmentMap, ladder, heatTable, PALETTE };
})(window);

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

/* chart-gallery part — contributionWaterfall. Loads after lib/charts.js; registers ChartKit.contributionWaterfall. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const HI = '#2563EB', LO = '#F97316', NEUTRAL = '#B6C0CC';
  const sgn = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d);

  /**
   * Contribution waterfall — how a group gets from a reference value to its own value: one horizontal step per factor,
   * sorted by absolute size, then a dashed "all factors together" bar and a grey residual bar for what the factors do not explain.
   * opts: { start: { label, value }, end: { label, value }, steps: [{ name, value, ci? }], unit?: '%' (start / end), stepUnit?: 'pp',
   *         summaryLabel?: 'all factors together' | false, residualLabel?: 'not explained' | false (residual = end − start − Σ steps),
   *         sort?: true (by |value|, largest first), colors?: { up, down, total, rest }, format?: (v, digits) => string }
   * Steps are stacked on a transparent base so each bar starts where the previous one ended. Returns the ECharts instance.
   */
  function contributionWaterfall(el, o) {
    const t = theme(), unit = o.unit == null ? '%' : o.unit, su = o.stepUnit == null ? 'pp' : o.stepUnit, fmt = o.format || sgn;
    const C = { up: HI, down: LO, total: t.text, rest: NEUTRAL, ...(o.colors || {}) };
    const steps = o.sort === false ? [...o.steps] : [...o.steps].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const sum = steps.reduce((s, x) => s + x.value, 0), rest = o.end.value - o.start.value - sum;
    const rows = steps.map(s => ({ ...s, kind: 'step' }));
    if (o.summaryLabel !== false) rows.push({ name: o.summaryLabel || 'all factors together', value: sum, kind: 'summary' });
    if (o.residualLabel !== false) rows.push({ name: o.residualLabel || 'not explained', value: rest, kind: 'rest' });
    const cats = [o.start.label, ...rows.map(r => r.name), o.end.label];
    let run = o.start.value; const base = [0], val = [{ value: o.start.value, kind: 'total', itemStyle: { color: C.total, borderRadius: 3 } }];
    rows.forEach(r => {
      const col = r.kind === 'rest' ? C.rest : r.value >= 0 ? C.up : C.down;
      if (r.kind === 'summary') { base.push(Math.min(o.start.value, o.start.value + r.value));
        val.push({ value: Math.abs(r.value), raw: r.value, kind: r.kind, label: { opacity: 1, fontWeight: 600, color: t.text }, itemStyle: { color: col, opacity: 0.4, borderColor: col, borderWidth: 1.5, borderType: 'dashed', borderRadius: 3 } }); return; }
      base.push(Math.min(run, run + r.value)); run += r.value;
      val.push({ value: Math.abs(r.value), raw: r.value, ci: r.ci, kind: r.kind, itemStyle: { color: col, borderRadius: 3 } });
    });
    base.push(0); val.push({ value: o.end.value, kind: 'total', itemStyle: { color: C.total, borderRadius: 3 } });
    const edges = [o.start.value, o.end.value, ...base.slice(1, -1), ...base.slice(1, -1).map((b, i) => b + val[i + 1].value)];
    const lo = Math.floor(Math.min(...edges) - 1), hi = Math.ceil(Math.max(...edges) + 1), lw = labelWidth(el, cats, 0.38);
    const ch = echarts.init(el$(el), null, { renderer: 'svg' });
    ch.setOption({ animation: false, grid: { left: lw + 12, right: 70, top: 10, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const i = ps[0].dataIndex, v = val[i];
        if (v.kind === 'total') return '<b>' + cats[i] + '</b><br>' + v.value.toFixed(1) + unit;
        if (v.kind === 'summary') return '<b>' + cats[i] + '</b><br>' + fmt(v.raw, 2) + ' ' + su + ' — the sum of the steps above';
        return '<b>' + cats[i] + '</b><br>' + fmt(v.raw, 2) + ' ' + su + (v.ci != null ? ' ± ' + v.ci.toFixed(2) : ''); } },
      xAxis: { type: 'value', min: lo, max: hi, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.muted }, splitLine: { lineStyle: { color: t.line } } },
      yAxis: { type: 'category', data: cats, inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: t.line } },
        axisLabel: { color: t.muted, fontSize: 12, width: lw, overflow: 'truncate', formatter: (v, i) => (val[i].kind === 'summary' || val[i].kind === 'total' ? '{b|' + v + '}' : v), rich: { b: { fontWeight: 600, color: t.text } } } },
      series: [{ type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, data: base },
        { type: 'bar', stack: 'w', barWidth: 14, data: val, label: { show: true, position: 'right', color: t.muted, fontSize: 12,
          formatter: q => (q.data.kind === 'total' ? q.value.toFixed(1) + unit : fmt(q.data.raw)) } }] });
    return ch;
  }
  global.ChartKit = global.ChartKit || {}; global.ChartKit.contributionWaterfall = contributionWaterfall;
})(window);

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

/* chart-gallery part: ChartKit.dumbbell — two values per row joined by a line coloured by direction. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const pct = v => Math.round(v) + '%';
  const HI = '#2563EB', LO = '#F97316', GREY = '#94A3B8';

  /**
   * Dumbbell — two values per row (before / after, first search / last search, users / non-users) joined by a thick line
   * whose colour says which way the second value moved. Value labels sit at both ends; a short vertical dash marks a base.
   * opts: { rows: [{ name, a, b, reference?: number | [refA, refB], dim?: false }], aLabel?: 'a', bLabel?: 'b',
   *         reference?: number (one base for every row; a row's own `reference` wins), referenceLabel?: 'all',
   *         format?: v => Math.round(v) + '%', min?: 0, max?: auto, sort?: false | 'a' | 'b' | 'diff',
   *         colors?: { a: grey, b: blue, up: blue, down: orange }, axis?: true (show the value axis) }
   * The connector is `up` when b > a and `down` otherwise. `dim: true` fades a row (a difference that is not significant).
   * A single base draws one dash through the row; a pair [refA, refB] draws the a-base above the line and the b-base below it.
   * Returns the ECharts instance.
   */
  function dumbbell(el, o) {
    const t = theme(), fmt = o.format || pct, C = { a: GREY, b: HI, up: HI, down: LO, ...(o.colors || {}) };
    const aL = o.aLabel || 'a', bL = o.bLabel || 'b', rL = o.referenceLabel || 'all';
    let rows = o.rows.map(r => ({ ...r, ref: r.reference != null ? r.reference : o.reference }));
    if (o.sort) rows = [...rows].sort((x, y) => (o.sort === 'diff' ? (y.b - y.a) - (x.b - x.a) : y[o.sort] - x[o.sort]));
    const refs = rows.flatMap(r => (r.ref == null ? [] : Array.isArray(r.ref) ? r.ref : [r.ref]));
    const all = rows.flatMap(r => [r.a, r.b]).concat(refs), lo = Math.min(...all), hi = Math.max(...all);
    const min = o.min != null ? o.min : Math.min(0, lo), step = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, hi - min)))) / 2;
    const max = o.max != null ? o.max : Math.ceil((hi + (hi - min) * 0.06) / step) * step;                  // a round axis end just above the largest value
    const lw = labelWidth(el, rows.map(r => r.name), 0.36), op = r => (r.dim ? 0.3 : 1);
    const dot = (key, col, other) => ({ type: 'scatter', name: key === 'a' ? aL : bL, z: 3, symbolSize: 14, cursor: 'default', itemStyle: { color: col },
      data: rows.map((r, i) => ({ value: [r[key], i], itemStyle: { color: col, opacity: op(r) },
        label: { show: true, position: r[key] <= r[other] ? 'left' : 'right', distance: 7, color: col, opacity: op(r), fontWeight: 600, fontSize: 11.5, formatter: fmt(r[key]) } })) });
    const line = (p, api) => { const i = api.value(2), r = rows[i], A = api.coord([api.value(0), i]), B = api.coord([api.value(1), i]);
      return { type: 'line', shape: { x1: A[0], y1: A[1], x2: B[0], y2: B[1] }, style: { stroke: r.b > r.a ? C.up : C.down, lineWidth: 6, opacity: r.dim ? 0.15 : 0.4 } }; };
    const tick = (p, api) => { const i = api.value(2), r = rows[i], y = api.coord([0, i])[1], st = { stroke: t.muted, lineWidth: 1.6, opacity: op(r) };
      if (r.ref == null) return null;
      if (!Array.isArray(r.ref)) { const x = api.coord([r.ref, i])[0]; return { type: 'line', shape: { x1: x, y1: y - 10, x2: x, y2: y + 10 }, style: st }; }
      const xa = api.coord([r.ref[0], i])[0], xb = api.coord([r.ref[1], i])[0];
      return { type: 'group', children: [{ type: 'line', shape: { x1: xa, y1: y - 11, x2: xa, y2: y - 1 }, style: st }, { type: 'line', shape: { x1: xb, y1: y + 1, x2: xb, y2: y + 11 }, style: st }] }; };
    return mount(el, {
      legend: { top: 0, left: 0, data: [aL, bL], icon: 'circle', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex], d = r.b - r.a;
        return '<b>' + r.name + '</b><br>' + aL + ': ' + fmt(r.a) + '<br>' + bL + ': ' + fmt(r.b) + ' (' + (d >= 0 ? '+' : '−') + fmt(Math.abs(d)) + ')'
          + (r.ref == null ? '' : '<br>' + rL + ': ' + (Array.isArray(r.ref) ? fmt(r.ref[0]) + ' / ' + fmt(r.ref[1]) : fmt(r.ref))) + (r.dim ? '<br><i>not significant</i>' : ''); } },
      grid: { left: lw + 46, right: 56, top: 30, bottom: o.axis === false ? 6 : 28 },
      xAxis: { type: 'value', min, max, show: o.axis !== false, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } },
        axisLabel: { color: t.muted, fontSize: 11, formatter: v => fmt(v) } },
      yAxis: { type: 'category', inverse: true, data: rows.map(r => r.name), axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break', formatter: (v, i) => (rows[i].dim ? '{d|' + v + '}' : v), rich: { d: { color: t.muted, fontSize: 12.5 } } } },
      series: [
        { type: 'custom', silent: true, z: 1, renderItem: line, data: rows.map((r, i) => [r.a, r.b, i]) },
        { type: 'custom', silent: true, z: 2, renderItem: tick, data: rows.map((r, i) => [r.a, r.b, i]) },
        dot('a', C.a, 'b'), dot('b', C.b, 'a') ] });
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.dumbbell = dumbbell;
})(window);

/* chart-gallery part: ChartKit.forestPlot — model coefficients with 95% intervals, significant rows coloured. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const labelWidth = (el, names, share) => Math.min(Math.round(el$(el).offsetWidth * (share || 0.4)), Math.max(...names.map(n => n.length)) * 7.4 + 12);
  const HI = '#2563EB', LO = '#F97316', NEUTRAL = '#B6C0CC';

  /**
   * Forest plot — one model estimate per row with its 95% interval; the reference line is 0 for differences or 1 for ratios.
   * opts: { rows: [{ name, est, lo, hi, p?, sig? }], scale?: 'diff' | 'ratio' (log10 axis labelled as multipliers, reference 1), unit?: 'pp',
   *         alpha?: 0.05, sort?: true (largest estimate on top), decimals?: 1 for diff / 2 for ratio, nsLabel?: '' (appended to
   *         labels of non-significant rows, e.g. '(n.s.)'), format?: v => string (one value), xName?: '',
   *         colors?: { pos: blue, neg: orange, ns: grey } }
   * A row is significant when `sig` is given, else when `p < alpha`, else when the interval excludes the reference. Significant rows
   * get a coloured point (above / below the reference), a dark whisker and a bold label "+3.2 pp [1.1; 5.3]" (ratio: "×1.35 [1.10; 1.66]");
   * the rest are grey. Returns the ECharts instance.
   */
  function forestPlot(el, o) {
    const t = theme(), ratio = o.scale === 'ratio', ref = ratio ? 1 : 0, unit = o.unit == null ? 'pp' : o.unit, alpha = o.alpha || 0.05;
    const dec = o.decimals != null ? o.decimals : ratio ? 2 : 1, C = { pos: HI, neg: LO, ns: NEUTRAL, ...(o.colors || {}) };
    const num = v => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(dec);
    const one = o.format || (ratio ? v => '×' + num(v) : v => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v)) + (unit ? ' ' + unit : ''));
    const rows = o.rows.map(r => ({ ...r, sig: r.sig != null ? !!r.sig : r.p != null ? r.p < alpha : (r.lo > ref || r.hi < ref) }));
    if (o.sort !== false) rows.sort((a, b) => a.est - b.est);                                          // category axis grows upwards: last row = largest estimate = top
    const text = r => one(r.est) + ' [' + (ratio ? num(r.lo) : (r.lo < 0 ? '−' : '') + num(Math.abs(r.lo))) + '; ' + (ratio ? num(r.hi) : (r.hi < 0 ? '−' : '') + num(Math.abs(r.hi))) + ']' + (!r.sig && o.nsLabel ? ' ' + o.nsLabel : '');
    const lw = labelWidth(el, rows.map(r => r.name), 0.36), rw = Math.max(...rows.map(r => text(r).length)) * 6.9 + 24;
    const loMin = Math.min(ref, ...rows.map(r => r.lo)), hiMax = Math.max(ref, ...rows.map(r => r.hi));
    const X = v => (ratio ? Math.log10(v) : v), span = X(hiMax) - X(loMin), pad = span * 0.05;        // ratios are plotted on log10 and labelled back as multipliers
    const base = ratio ? [1.1, 1.25, 1.5, 2, 3, 10].find(b => span / Math.log10(b) <= 7) || 10 : null, trim = v => String(Math.round(v * 100) / 100);
    const xAxis = ratio
      ? { type: 'value', min: Math.floor((X(loMin) - pad) / Math.log10(base)) * Math.log10(base), max: Math.ceil((X(hiMax) + pad) / Math.log10(base)) * Math.log10(base),
          interval: Math.log10(base), axisLabel: { formatter: v => '×' + trim(Math.pow(10, v)) } }                    // ticks at powers of `base`, so ×1 is always one of them
      : { type: 'value', min: loMin - pad, max: hiMax + pad, axisLabel: { formatter: v => (v > 0 ? '+' : '') + trim(v) } };
    const colorOf = r => (!r.sig ? C.ns : r.est >= ref ? C.pos : C.neg);
    const whisker = (p, api) => { const i = api.value(2), r = rows[i], A = api.coord([api.value(0), i]), B = api.coord([api.value(1), i]);
      return { type: 'line', shape: { x1: A[0], y1: A[1], x2: B[0], y2: B[1] }, style: { stroke: r.sig ? t.text : t.muted, lineWidth: r.sig ? 2 : 1.4, opacity: r.sig ? 1 : 0.6 } }; };
    return mount(el, {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex];
        return '<b>' + r.name + '</b><br>' + text(r) + (r.p != null ? '<br>p = ' + (r.p < 0.001 ? '< 0.001' : r.p.toFixed(3)) : '') + '<br>' + (r.sig ? 'significant' : 'not significant'); } },
      grid: { left: lw + 10, right: rw, top: 10, bottom: o.xName ? 44 : 26 },
      xAxis: { ...xAxis, name: o.xName || '', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } }, axisLabel: { ...xAxis.axisLabel, color: t.muted, fontSize: 11, showMinLabel: false, showMaxLabel: false } },
      yAxis: { type: 'category', data: rows.map(r => r.name), axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.text, fontSize: 12.5, width: lw, overflow: 'break', formatter: (v, i) => (rows[i].sig ? v : '{d|' + v + '}'), rich: { d: { color: t.muted, fontSize: 12.5 } } } },
      series: [
        { type: 'custom', silent: true, z: 1, renderItem: whisker, data: rows.map((r, i) => [X(r.lo), X(r.hi), i]),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, width: 1 }, label: { show: false }, data: [{ xAxis: X(ref) }] } },
        { type: 'scatter', z: 3, symbolSize: 12, cursor: 'default', data: rows.map((r, i) => ({ value: [X(r.est), i], itemStyle: { color: colorOf(r), borderColor: t.bg, borderWidth: 1 } })) },
        { type: 'scatter', z: 2, silent: true, symbolSize: 0, data: rows.map((r, i) => ({ value: [X(r.hi), i],
          label: { show: true, position: 'right', distance: 8, fontSize: 11.5, color: r.sig ? t.text : t.muted, fontWeight: r.sig ? 700 : 400, formatter: text(r) } })) } ] });
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.forestPlot = forestPlot;
})(window);

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

/* chart-gallery part — ChartKit.riskMap. Loads after lib/charts.js (uses the global `echarts` and ChartKit.PALETTE if present). */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const palette = () => (global.ChartKit && global.ChartKit.PALETTE) || ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const num1 = v => String(Math.round(v * 10) / 10), fmtN = v => Number(v).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Wilson 95% interval for k successes out of n, in percent: [low, high]. */
  function wilson(k, n, z) {
    z = z || 1.96; if (!n) return [0, 0];
    const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [100 * (c - h), 100 * (c + h)];
  }

  /**
   * Risk map — "ways to lose a session": how common a bad event is (x, log scale) against how often people leave without the
   * outcome right after it (y). Bubble area = number of sessions lost that way; colour = stage / category; a hollow bubble means
   * the estimate rests on too few cases; the whisker is the 95% Wilson interval; the dashed line is the background rate of an
   * ordinary action. Italic captions name the quadrants ("rare but deadly", ...).
   * opts: { events: [{ name, note?, category?, x: % of sessions where it happens, n: sessions where it happened, k: of them lost
   *                     (y = 100 k / n), y?: given instead of k, labelPosition?: 'right' }],
   *         background: % lost after an ordinary action, backgroundLabel?: 'background', minN?: 50 (hollow below), hideBelow?: 0 (not drawn),
   *         ci?: true, colors?: { [category]: color }, labelPositions?: { [name]: 'left' | 'right' | 'top' | 'bottom' },
   *         quadrants?: { topLeft?, topRight?, bottomLeft?, bottomRight? } (captions),
   *         zone?: { x?: 5, factor?: 2, label?: 'mass killers' } (shaded area x >= zone.x and y >= factor * background),
   *         xName?, yName?, xMin?: 0.1, xMax?: 100, yMax?, lostLabel?: 'sessions lost', tooltip?: event => html }
   * Returns the ECharts instance. Events are also available as `event.ci`, `event.lift`, `event.k` on the returned `events` property.
   */
  function riskMap(el, o) {
    const t = theme(), P = palette(), ci = o.ci !== false, minN = o.minN == null ? 50 : o.minN, hide = o.hideBelow || 0, lost = o.lostLabel || 'sessions lost';
    const cats = [...new Set(o.events.map(e => e.category || ''))];
    const color = e => (o.colors && o.colors[e.category]) || P[cats.indexOf(e.category || '') % P.length];
    const events = o.events.map(e => { const n = e.n || 0, k = e.k != null ? e.k : (e.y != null ? Math.round(e.y * n / 100) : 0), y = e.y != null ? e.y : (n ? 100 * k / n : 0);
      return { ...e, n, k, y, ci: wilson(k, n), lift: o.background ? y / o.background : null, color: color(e) }; });
    const shown = events.filter(e => e.n >= hide), maxK = Math.max(1, ...shown.map(e => e.k));
    const size = e => 10 + 46 * Math.sqrt(e.k / maxK);
    const pos = e => e.labelPosition || (o.labelPositions && o.labelPositions[e.name]) || 'right';
    const yMax = o.yMax || Math.min(100, Math.ceil((Math.max(...shown.map(e => ci ? e.ci[1] : e.y)) + 5) / 10) * 10);
    const xMin = o.xMin || 0.1, xMax = o.xMax || 100, grid = { left: 64, right: 30, top: 30, bottom: 60 };
    const tip = e => '<b>' + esc(e.name) + '</b>' + (e.note ? ' · <i>' + esc(e.note) + '</i>' : '') + '<br>happened in ' + fmtN(e.n) + ' sessions (' + num1(e.x) + '%)'
      + '<br>lost right after it: <b>' + num1(e.y) + '%</b>' + (e.n ? ' (95%: ' + Math.round(e.ci[0]) + '–' + Math.round(e.ci[1]) + '%)' : '')
      + (e.lift != null ? ', ' + num1(e.lift) + '× the background' : '') + '<br>' + lost + ': ' + fmtN(e.k);
    const caption = (text, place) => ({ type: 'text', silent: true, ...place, style: { text, fill: t.muted, fontSize: 13, fontWeight: 600, fontStyle: 'italic' } });
    const q = o.quadrants || {}, graphic = [];
    if (q.topLeft) graphic.push(caption(q.topLeft, { left: grid.left + 16, top: grid.top + 6 }));
    if (q.topRight) graphic.push(caption(q.topRight, { right: grid.right + 10, top: grid.top + 6 }));
    if (q.bottomLeft) graphic.push(caption(q.bottomLeft, { left: grid.left + 16, bottom: grid.bottom + 10 }));
    if (q.bottomRight) graphic.push(caption(q.bottomRight, { right: grid.right + 10, bottom: grid.bottom + 10 }));
    const series = [];
    if (ci) series.push({ type: 'custom', silent: true, z: 1, data: [[xMin, 0]], renderItem: (params, api) => ({ type: 'group', children: shown.map(e => {
      const a = api.coord([e.x, e.ci[0]]), b = api.coord([e.x, e.ci[1]]);
      return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: e.color, opacity: 0.35, lineWidth: 2 } }; }) }) });
    const scatter = { type: 'scatter', z: 3, data: shown.map(e => ({ value: [e.x, e.y], e, symbolSize: size(e), label: { position: pos(e) },
        itemStyle: { color: e.n >= minN ? e.color : t.bg, borderColor: e.color, borderWidth: 2, opacity: 0.88 } })),
      label: { show: true, formatter: p => '{a|' + p.data.e.name + '}' + (p.data.e.note ? '\n{b|' + p.data.e.note + '}' : ''),
        rich: { a: { color: t.text, fontSize: 12.5, fontWeight: 700, lineHeight: 16 }, b: { color: t.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 14 } } },
      labelLayout: { moveOverlap: 'shiftY' } };
    if (o.background != null) scatter.markLine = { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' }, data: [{ yAxis: o.background }],
      label: { formatter: (o.backgroundLabel || 'background') + ': ' + num1(o.background) + '%', position: 'insideStartTop', color: t.muted } };
    if (o.zone && o.background != null) scatter.markArea = { silent: true, itemStyle: { color: '#E11D48', opacity: 0.07 }, label: { color: '#E11D48', fontWeight: 700, position: 'insideTopRight' },
      data: [[{ name: o.zone.label || '', coord: [o.zone.x || 5, o.background * (o.zone.factor || 2)] }, { coord: [xMax, yMax] }]] };
    series.push(scatter);
    const ch = mount(el, { animation: false, grid, graphic,
      xAxis: { type: 'log', min: xMin, max: xMax, name: o.xName || '', nameLocation: 'middle', nameGap: 36, nameTextStyle: { color: t.muted, fontWeight: 600 },
        axisLabel: { color: t.muted, formatter: v => (v < 1 ? num1(v) : Math.round(v)) + '%' }, axisLine: { lineStyle: { color: t.line } }, splitLine: { lineStyle: { color: t.line, opacity: 0.6 } } },
      yAxis: { type: 'value', min: 0, max: yMax, name: o.yName || '', nameLocation: 'middle', nameGap: 44, nameTextStyle: { color: t.muted, fontWeight: 600 },
        axisLabel: { color: t.muted, formatter: v => v + '%' }, splitLine: { lineStyle: { color: t.line, opacity: 0.6 } } },
      tooltip: { trigger: 'item', formatter: p => (p.data && p.data.e ? (o.tooltip || tip)(p.data.e) : '') },
      series });
    ch.events = events;
    global.addEventListener('resize', () => ch.resize());
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.riskMap = riskMap; global.ChartKit.wilson = wilson;
})(window);

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

/* chart-gallery part — ChartKit.stateButterfly. Loads after lib/charts.js (uses the global `echarts` and ChartKit.PALETTE if present). */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const theme = () => ({ text: css('--ck-text', '#0F172A'), muted: css('--ck-muted', '#64748B'), line: css('--ck-line', '#E2E8F0'), bg: css('--ck-bg', '#FFFFFF') });
  const mount = (el, option) => { const ch = echarts.init(el$(el), null, { renderer: 'svg' }); ch.setOption(option); return ch; };
  const palette = () => (global.ChartKit && global.ChartKit.PALETTE) || ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const pct = v => Math.round(Math.abs(v)) + '%';

  /**
   * State butterfly — where everyone is at each moment, mirrored around zero: the states that mean "gone or paused" are stacked
   * upwards, the active states downwards, so the growing "left" mass and the shrinking active mass read as one shape. The y axis
   * runs -100..100 with absolute labels; a solid zero line separates the halves. Click a legend item to toggle that state.
   * opts: { labels: ['0', '1 s', ...] (time marks, log or linear — the caller decides), states: [all states, bottom of each half first],
   *         up: ['paused', 'left without booking', 'left with booking'] (states drawn above zero; the rest go below),
   *         data: { [state]: [% of all sessions per mark] }, colors?: { [state]: color }, normalize?: false,
   *         yName?: '← active on the site        left or paused →', labelEvery?: 1 | (index => boolean), legend?: true,
   *         tooltip?: (label, [{ name, value, color }]) => html }
   * `normalize: true` rescales every mark so the two halves sum to 100. Returns the ECharts instance.
   */
  function stateButterfly(el, o) {
    const t = theme(), P = palette(), up = o.up || [], down = o.states.filter(s => !up.includes(s)), n = o.labels.length;
    const color = s => (o.colors && o.colors[s]) || P[o.states.indexOf(s) % P.length];
    const every = i => (typeof o.labelEvery === 'function' ? !!o.labelEvery(i) : i % (o.labelEvery || 1) === 0);
    const sums = o.labels.map((_, k) => o.states.reduce((a, s) => a + (+o.data[s][k] || 0), 0));
    const val = s => o.data[s].map((v, k) => (o.normalize && sums[k] > 0 ? 100 * v / sums[k] : +v || 0));
    const area = (s, stack, sign) => ({ type: 'line', name: s, stack, data: val(s).map(v => sign * v), symbol: 'none', lineStyle: { width: 0 },
      areaStyle: { color: color(s), opacity: 1 }, itemStyle: { color: color(s) }, emphasis: { focus: 'series' } });
    const tip = ps => { const k = ps[0].dataIndex, rows = ps.filter(p => p.seriesName);
      if (o.tooltip) return o.tooltip(o.labels[k], rows.map(p => ({ name: p.seriesName, value: Math.abs(p.value), color: p.color })));
      return '<b>' + o.labels[k] + '</b><br>' + rows.map(p => p.marker + p.seriesName + ': ' + pct(p.value)).join('<br>'); };
    const ch = mount(el, { animation: false,
      legend: o.legend === false ? undefined : { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text, fontSize: 12 }, data: [...up].reverse().concat(down) },
      tooltip: { trigger: 'axis', formatter: tip },
      grid: { left: 54, right: 30, top: 44, bottom: 30 },
      xAxis: { type: 'category', boundaryGap: false, data: o.labels, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: i => every(i) } },
      yAxis: { type: 'value', min: -100, max: 100, interval: 25, axisLabel: { color: t.muted, formatter: v => Math.abs(v) + '%' }, splitLine: { lineStyle: { color: 'rgba(120,140,160,.18)' } },
        name: o.yName == null ? '← active        left or paused →' : o.yName, nameLocation: 'middle', nameGap: 40, nameTextStyle: { color: t.muted, fontSize: 12 } },
      series: up.map(s => area(s, 'up', 1)).concat(down.map(s => area(s, 'down', -1)))
        .concat([{ type: 'line', name: '', data: o.labels.map(() => 0), symbol: 'none', silent: true, lineStyle: { color: t.text, width: 1.2 }, tooltip: { show: false }, z: 5 }]) });
    global.addEventListener('resize', () => ch.resize());
    return ch;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.stateButterfly = stateButterfly;
})(window);

/* chart-gallery part — ChartKit.segmentationPanel. Plain HTML + inline SVG; styles in lib/parts/segmentation-panel.css. */
(function (global) {
  'use strict';
  const el$ = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const palette = () => (global.ChartKit && global.ChartKit.PALETTE) || ['#2563EB', '#0F172A', '#F97316', '#94A3B8', '#7C3AED', '#059669', '#E11D48', '#CA8A04'];
  const pct = v => Math.round(v) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /**
   * Segmentation panel — the "what the segments are" table: one row per segment with its name, a share-of-base bar, an outcome bar with
   * the value, and (optionally) a sparkline of the state timeline: a tiny 100% stacked column per time mark, colour = state. Rows are
   * sorted by the outcome, the overall row stays on top. Plain HTML + inline SVG, sizes itself.
   * opts: { rows: [{ name, share: % of base, value: outcome %, color?, overall?: true, n? }], valueLabel?: 'booking rate', shareLabel?: 'share of base',
   *         nameLabel?: 'segment', valueColor?: '#1E3A5F', overallColor?: '#9FB0C4', sort?: true,
   *         mini?: { marks: [0, 5, ...], states: ['home', ...], colors?: { [state]: color }, data: { [row name]: { [state]: [% per mark] } }, unit?: 's', label?: 'screen at' },
   *         legend?: true (state legend under the grid when `mini` is given), tooltip?: (rowName, mark, state, value) => string (SVG <title>) }
   * Returns the container node.
   */
  function segmentationPanel(el, o) {
    const node = el$(el), P = palette(), M = o.mini, unit = M && M.unit != null ? M.unit : 's';
    const vl = o.valueLabel || 'value', sl = o.shareLabel || 'share of base', nl = o.nameLabel || 'segment';
    const vcol = o.valueColor || '#1E3A5F', ocol = o.overallColor || '#9FB0C4';
    const scol = s => (M.colors && M.colors[s]) || P[M.states.indexOf(s) % P.length];
    const maxShare = Math.max(...o.rows.map(r => r.share));
    const rows = o.sort === false ? [...o.rows] : [...o.rows].sort((a, b) => (b.overall ? 1 : 0) - (a.overall ? 1 : 0) || b.value - a.value);
    const title = (name, m, s, v) => (o.tooltip ? o.tooltip(name, m, s, v) : m + (unit ? ' ' + unit : '') + ' — ' + s + ': ' + pct(v));
    function mini(r) {
      const d = M.data[r.name]; if (!d) return '<span class="ck-segpanel-o"></span>';
      const n = M.marks.length, w = 100 / n; let g = '';
      M.marks.forEach((m, i) => { let y = 0; M.states.forEach(s => { const h = (d[s] && +d[s][i]) || 0; if (h > 0) {
        g += '<rect x="' + (i * w + 0.4).toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + (w - 0.8).toFixed(2) + '" height="' + h.toFixed(2) + '" fill="' + scol(s) + '"><title>' + esc(title(r.name, m, s, h)) + '</title></rect>'; y += h; } }); });
      return '<div class="ck-segpanel-mini ck-segpanel-o"><svg viewBox="0 0 100 100" preserveAspectRatio="none">' + g + '</svg></div>';
    }
    let h = '<span class="ck-segpanel-h">' + esc(nl) + '</span><span class="ck-segpanel-h">' + esc(sl) + '</span><span></span><span class="ck-segpanel-h">' + esc(vl) + '</span><span></span>'
      + (M ? '<span class="ck-segpanel-h ck-segpanel-o">' + esc(M.label || 'state at') + ' ' + M.marks[0] + '–' + M.marks[M.marks.length - 1] + (unit ? ' ' + unit : '') + '</span>' : '');
    rows.forEach((r, i) => {
      const col = r.overall ? ocol : (r.color || P[i % P.length]);
      h += '<span class="ck-segpanel-name' + (r.overall ? ' ck-segpanel-tot' : '') + '" title="' + (r.n != null ? 'n = ' + r.n : '') + '">' + esc(r.name) + '</span>'
        + '<div class="ck-segpanel-bar"><i style="width:' + (100 * r.share / maxShare).toFixed(1) + '%;background:' + col + '"></i></div><span class="ck-segpanel-num">' + pct(r.share) + '</span>'
        + '<div class="ck-segpanel-bar ck-segpanel-o"><i style="width:' + Math.min(100, r.value).toFixed(1) + '%;background:' + vcol + '"></i></div><span class="ck-segpanel-num ck-segpanel-o">' + pct(r.value) + '</span>'
        + (M ? mini(r) : '');
    });
    node.classList.add('ck-segpanel'); node.classList.toggle('ck-segpanel--mini', !!M);
    node.innerHTML = '<div class="ck-segpanel-grid">' + h + '</div>'
      + (M && o.legend !== false ? '<div class="ck-segpanel-legend">' + M.states.map(s => '<span><i style="background:' + scol(s) + '"></i>' + esc(s) + '</span>').join('') + '</div>' : '');
    return node;
  }

  global.ChartKit = global.ChartKit || {}; global.ChartKit.segmentationPanel = segmentationPanel;
})(window);

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
