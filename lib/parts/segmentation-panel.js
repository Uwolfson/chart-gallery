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
