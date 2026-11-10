#!/usr/bin/env python3
"""Every tracked text file uses LF line endings and ends with exactly one final newline."""
import subprocess
import sys


def main():
    p = subprocess.run(['git', 'ls-files', '-z'], capture_output=True)
    if p.returncode != 0:
        print('text-hygiene: git ls-files failed; failing closed.', file=sys.stderr)
        return 2
    bad = []
    for path in p.stdout.decode('utf-8', 'replace').split('\0'):
        if not path:
            continue
        try:
            data = open(path, 'rb').read()
        except (FileNotFoundError, IsADirectoryError):
            continue
        if not data or b'\0' in data[:8192]:
            continue  # empty or binary
        if b'\r' in data:
            bad.append((path, 'CR / CRLF line ending'))
        if not data.endswith(b'\n'):
            bad.append((path, 'no final newline'))
        elif data.endswith(b'\n\n'):
            bad.append((path, 'more than one final newline'))
    for path, why in bad:
        print(f'::error file={path}::{why}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
