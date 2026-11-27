#!/usr/bin/env python3
"""Fix Unicode smart quotes, em/en dashes, and non-breaking spaces in JSON data files.

Uses recursive walk of the JSON structure to do replacements on string values,
which avoids breaking JSON syntax when replacing smart double quotes with
straight double quotes inside string values.
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

files_to_fix = [
    os.path.join(BASE, 'nist-800-53-r5.json'),
    os.path.join(BASE, 'fedramp-rev5.json'),
    os.path.join(BASE, 'dod-srg.json'),
    os.path.join(BASE, 'nist-800-171-r2.json'),
    os.path.join(BASE, 'cmmc-v2.json'),
]

REPLACEMENTS = {
    '\u201c': '"',      # left double quote -> straight double quote
    '\u201d': '"',      # right double quote -> straight double quote
    '\u2018': "'",      # left single quote -> straight apostrophe
    '\u2019': "'",      # right single quote -> straight apostrophe
    '\u2014': '--',     # em dash -> double hyphen
    '\u2013': '-',      # en dash -> single hyphen
    '\u00a0': ' ',      # non-breaking space -> regular space
}

changes = {}


def fix_string(s):
    """Apply all replacements to a single string value."""
    for old_char, new_char in REPLACEMENTS.items():
        count = s.count(old_char)
        if count > 0:
            changes[old_char] = changes.get(old_char, 0) + count
            s = s.replace(old_char, new_char)
    return s


def walk_and_fix(obj):
    """Recursively walk JSON structure and fix strings in place."""
    if isinstance(obj, str):
        return fix_string(obj)
    elif isinstance(obj, list):
        return [walk_and_fix(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: walk_and_fix(v) for k, v in obj.items()}
    else:
        return obj


for f in files_to_fix:
    changes = {}

    with open(f, 'r', encoding='utf-8') as fh:
        data = json.load(fh)

    fixed_data = walk_and_fix(data)

    if changes:
        text = json.dumps(fixed_data, indent=2, ensure_ascii=False)
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(text)
            fh.write('\n')

        summary = {repr(k): v for k, v in changes.items()}
        print(f'{os.path.basename(f)}: Fixed {summary}')
    else:
        print(f'{os.path.basename(f)}: No changes needed')
