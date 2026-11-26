"""Build single-file offline copies of the galleries: dist/chart-gallery-single.html (index) and dist/review-single.html.
Inlines dist/echarts.min.js, lib/charts.css, lib/charts.js and examples/demo-data.js."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
read = lambda p: p.read_text(encoding='utf-8')
ECH = read(ROOT / 'dist' / 'echarts.min.js')
CSS = read(ROOT / 'lib' / 'charts.css')
LIB = read(ROOT / 'lib' / 'charts.js')
DEMO = read(ROOT / 'examples' / 'demo-data.js')

def build(src, dst):
    s = read(src)
    s = re.sub(r'<script src="https://cdnjs\.cloudflare\.com/ajax/libs/echarts/[^"]+"[^>]*></script>', lambda m: '<script>\n' + ECH + '\n</script>', s, 1)
    s = s.replace('<link rel="stylesheet" href="lib/charts.css">', '<style>\n' + CSS + '\n</style>', 1)
    s = s.replace('<script src="lib/charts.js"></script>', '<script>\n' + LIB + '\n</script>', 1)
    s = s.replace('<script src="examples/demo-data.js"></script>', '<script>\n' + DEMO + '\n</script>', 1)
    dst.write_text(s, encoding='utf-8', newline='\n'); print(dst.name, round(dst.stat().st_size / 1e6, 2), 'MB')

build(ROOT / 'index.html', ROOT / 'dist' / 'chart-gallery-single.html')
build(ROOT / 'review.html', ROOT / 'dist' / 'review-single.html')
