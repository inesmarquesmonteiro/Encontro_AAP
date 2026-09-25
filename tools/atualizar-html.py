"""Atualiza as cópias locais de CSS, dados e JavaScript no HTML distribuível."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
page = root / 'index.html'
html = page.read_text()
css = (root / 'style.css').read_text()
html = re.sub(r'<style id="app-styles">[\s\S]*?</style>', lambda _: '<style id="app-styles">\n' + css + '\n  </style>', html)
data = (root / 'dados.json').read_text().replace('<', '\\u003c')
html = re.sub(r'<script id="route-data" type="application/json">[\s\S]*?</script>', lambda _: '<script id="route-data" type="application/json">' + data + '</script>', html)
html = re.sub(r'\s*<script defer src="(?:vendor/leaflet/leaflet|caderno|ficheiro-local|memorias|script)\.js(?:\?[^\"]*)?"></script>', '', html)
html = re.sub(r'\n<!-- BEGIN LOCAL SCRIPTS -->[\s\S]*?<!-- END LOCAL SCRIPTS -->', '', html)
scripts = []
for name in ['vendor/leaflet/leaflet.js', 'ficheiro-local.js', 'memorias.js', 'script.js']:
    source = (root / name).read_text()
    if re.search(r'</script', source, re.I):
        raise ValueError('Fecho de script no código: ' + name)
    scripts.append('<script data-local-source="' + name + '">\n' + source + '\n</script>')
block = '\n<!-- BEGIN LOCAL SCRIPTS -->\n' + '\n'.join(scripts) + '\n<!-- END LOCAL SCRIPTS -->\n'
html = html.replace('</body>', block + '</body>')
page.write_text(html)
