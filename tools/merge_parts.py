"""Merge chart parts (lib/parts, examples/parts, docs/parts) into the library, the demo data and both galleries.

Usage:  python tools/merge_parts.py            # merge everything found in the parts folders
Idempotent: a part whose function is already in lib/charts.js is skipped; a section whose id is already in a page is skipped.
Order of new sections = docs/parts/order.txt if present (one kebab id per line), otherwise alphabetical.
"""
import json, re, sys, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'lib' / 'charts.js'
CSS = ROOT / 'lib' / 'charts.css'
DEMO = ROOT / 'examples' / 'demo-data.js'
INDEX = ROOT / 'index.html'
REVIEW = ROOT / 'review.html'
SKILL = ROOT / 'skills' / 'chart-gallery' / 'SKILL.md'
README = ROOT / 'README.md'
PARTS_JS = ROOT / 'lib' / 'parts'
PARTS_DEMO = ROOT / 'examples' / 'parts'
PARTS_DOC = ROOT / 'docs' / 'parts'

def read(p): return p.read_text(encoding='utf-8')
def write(p, s): p.write_text(s, encoding='utf-8', newline='\n')

def specs():
    order_file = PARTS_DOC / 'order.txt'
    files = {p.stem: p for p in PARTS_DOC.glob('*.json')}
    if order_file.exists():
        ids = [l.strip() for l in read(order_file).splitlines() if l.strip() and l.strip() in files]
        ids += sorted(k for k in files if k not in ids)
    else:
        ids = sorted(files)
    out = []
    for k in ids:
        s = json.loads(read(files[k])); s['_file'] = k; out.append(s)
    return out

def merge_lib(spec_list):
    lib = read(LIB); css = read(CSS); demo = read(DEMO)
    for s in spec_list:
        k = s['_file']; fn = s['fn']
        js = PARTS_JS / f'{k}.js'; pcss = PARTS_JS / f'{k}.css'; dj = PARTS_DEMO / f'{k}.js'
        if js.exists() and f'ChartKit.{fn} =' not in lib and f'ChartKit.{fn}=' not in lib:
            lib = lib.rstrip('\n') + '\n\n' + read(js).strip() + '\n'
            print('lib  +', fn)
        if pcss.exists() and f'/* part: {k} */' not in css:
            css = css.rstrip('\n') + f'\n\n/* part: {k} */\n' + read(pcss).strip() + '\n'
            print('css  +', k)
        if dj.exists() and f'DEMO.{fn} =' not in demo and f'DEMO.{fn}=' not in demo:
            demo = demo.rstrip('\n') + '\n\n' + read(dj).strip() + '\n'
            print('demo +', fn)
    write(LIB, lib); write(CSS, css); write(DEMO, demo)

def section(s, ru):
    sid = s['id']; h = s.get('height')
    style = f' style="height:{h}px"' if h else ''
    cls = ' class="chart"' if h else ''
    title = s['title_ru'] if ru else s['title_en']
    use = s['use_ru'] if ru else s['use_en']
    code_label = 'Код' if ru else 'Code'
    fb = f'\n  <div class="fb" data-chart="{sid}" data-title="{html.escape(title)} ({s["fn"]})"></div>' if ru else ''
    return (f'\n<section id="{sid}"><h2>{html.escape(title)}</h2><div class="fn">ChartKit.{s["fn"]}{"" if ru else "(el, opts)"}</div>\n'
            f'  <p class="use">{use}</p>\n'
            f'  <div{cls} id="c-{sid}"{style}></div>\n'
            f'  <details><summary>{code_label}</summary><pre>{html.escape(s["snippet"])}</pre></details>{fb}\n</section>\n')

def merge_page(path, spec_list, ru):
    page = read(path)
    new = [s for s in spec_list if f'id="{s["id"]}"' not in page]
    if not new: return
    nav = ''.join(f'<a href="#{s["id"]}"' + (f' data-nav="{s["id"]}"' if ru else '') + f'>{html.escape(s["title_ru"] if ru else s["title_en"])}</a>' for s in new)
    page = page.replace('</div></nav>', '\n  ' + nav + '\n</div></nav>', 1)
    page = page.replace('</main>', ''.join(section(s, ru) for s in new) + '</main>', 1)
    init = '\n  // ---- ported charts\n' + '\n'.join('  ' + s['init'].strip().replace('\n', '\n  ') for s in new) + '\n'
    if ru:
        page = page.replace('\n  // ---- feedback', init + '\n  // ---- feedback', 1)
    else:
        page = page.replace('</script>\n</body>', init + '</script>\n</body>', 1)
    write(path, page); print(path.name, '+', len(new), 'sections')

def merge_skill(spec_list):
    sk = read(SKILL)
    new = [s for s in spec_list if f'`{s["fn"]}`' not in sk]
    if not new: return
    rows = ''.join(f'| {s["use_en"].split(".")[0].replace("Use it when ", "").capitalize()} | {s["title_en"]} | `{s["fn"]}` |\n' for s in new)
    sk = sk.replace('\n## 3. Data shapes', '\nMore charts (ported later):\n\n| Question the slide answers | Chart | Function |\n|---|---|---|\n' + rows + '\n## 3. Data shapes', 1)
    code = '\n'.join(f'// {s["title_en"]}\n{s["skill"].strip()}\n' for s in new)
    sk = sk.replace('\nPython helpers for data preparation', '\n```js\n' + code + '```\n\nPython helpers for data preparation', 1)
    write(SKILL, sk); print('SKILL +', len(new))

def merge_readme(spec_list):
    rd = read(README)
    new = [s for s in spec_list if f'`ChartKit.{s["fn"]}`' not in rd]
    if not new: return
    rows = ''.join(f'| {s["title_en"]} | `ChartKit.{s["fn"]}` | {s["use_en"].split(".")[0].replace("Use it when ", "").lower()} |\n' for s in new)
    rd = rd.replace('\n### State timeline\n', '\n' + rows + '\n### State timeline\n', 1) if '### State timeline' in rd else rd
    imgs = ''.join(f'\n### {s["title_en"]}\n\n![{s["title_en"]}](docs/img/{s["id"]}.png)\n\n{s["use_en"]}\n' for s in new if (ROOT / 'docs' / 'img' / f'{s["id"]}.png').exists())
    rd = rd.replace('\n## Quick start', imgs + '\n## Quick start', 1)
    write(README, rd); print('README +', len(new))

if __name__ == '__main__':
    sl = specs()
    if not sl: sys.exit('no specs in docs/parts')
    merge_lib(sl); merge_page(INDEX, sl, False); merge_page(REVIEW, sl, True); merge_skill(sl); merge_readme(sl)
