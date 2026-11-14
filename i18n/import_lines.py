#!/usr/bin/env python3
"""Turns a one-translation-per-line list (same order as i18n/keys.json) into i18n/<lang>.json.
Usage: python3 i18n/import_lines.py pl < pl.txt"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
keys = json.load(open(os.path.join(here, 'keys.json'), encoding='utf-8'))
lines = [l.rstrip('\n') for l in sys.stdin if l.strip()]
n_t, n_j, n_s = len(keys['text']), len(keys['js']), len(keys['seo'])
if len(lines) != n_t + n_j + n_s:
    sys.exit(f'expected {n_t + n_j + n_s} lines, got {len(lines)}')
for i, l in enumerate(lines[:8] + lines[159:167]):
    if '"' in l:
        sys.exit(f'double quote not allowed in attribute text: {l}')
out = {'text': dict(zip(keys['text'], lines[:n_t])),
       'js': dict(zip(keys['js'], lines[n_t:n_t + n_j])),
       'seo': dict(zip(keys['seo'], lines[n_t + n_j:]))}
json.dump(out, open(os.path.join(here, sys.argv[1] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(sys.argv[1], 'ok')
