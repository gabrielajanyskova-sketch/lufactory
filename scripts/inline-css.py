#!/usr/bin/env python3
"""Inlines assets/css/style.css into every HTML page's <head> as <style>.

style.css stays the single source of truth for CSS — edit it there, then
re-run this script to regenerate the inlined copies before committing.
Avoids a render-blocking stylesheet request on first paint. Safe to run
repeatedly: replaces the <link rel="stylesheet"> on first run, or an
existing inlined <style> block on subsequent runs.
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_PATH = os.path.join(ROOT, 'assets/css/style.css')
LINK_TAG = '<link rel="stylesheet" href="/assets/css/style.css">'
STYLE_BLOCK_RE = re.compile(r'<style>\n.*?\n</style>', re.DOTALL)

def main():
    css = open(CSS_PATH, encoding='utf-8').read().strip()
    inlined = f'<style>\n{css}\n</style>'

    files = glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'produkty/*.html'))
    for path in files:
        content = open(path, encoding='utf-8').read()
        if LINK_TAG in content:
            content = content.replace(LINK_TAG, inlined)
        elif STYLE_BLOCK_RE.search(content):
            content = STYLE_BLOCK_RE.sub(inlined, content, count=1)
        else:
            print(f"SKIP (no link tag or style block found): {path}")
            continue
        open(path, 'w', encoding='utf-8').write(content)
        print(f"inlined -> {os.path.relpath(path, ROOT)}")

if __name__ == '__main__':
    main()
