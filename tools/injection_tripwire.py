#!/usr/bin/env python3
"""Fail if the sanitizer's rewrite token appears anywhere outside Tests/sanitizer/.

The token is the literal the OpenRouter guardrails substitute for injection-like text. If it
shows up in the repo, a file passed through the model and came back rewritten. The needle is
assembled at runtime so this file does not trip itself. Output: path and line only.
  --tree            every tracked file at HEAD
  --commits ARGS... commit messages; ARGS go to git log (e.g. BASE..HEAD, or -1 SHA)
"""
import subprocess
import sys

NEEDLE = '[' + 'PROMPT_' + 'INJECTION' + ']'
EXEMPT = ('Tests/sanitizer/',)


def git(*args):
    p = subprocess.run(['git', *args], capture_output=True)
    if p.returncode != 0:
        print(f'tripwire: git {args[0]} failed; failing closed.', file=sys.stderr)
        sys.exit(2)
    return p.stdout.decode('utf-8', 'replace')


def tree_hits():
    for path in git('ls-files', '-z').split('\0'):
        if not path or path.startswith(EXEMPT):
            continue
        if NEEDLE in path:
            yield path, 0
        try:
            text = open(path, 'rb').read().decode('utf-8', 'replace')
        except (FileNotFoundError, IsADirectoryError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if NEEDLE in line:
                yield path, i


def commit_hits(log_args):
    for entry in git('log', '--format=%H%x00%B%x01', *log_args).split('\x01'):
        if '\0' not in entry:
            continue
        sha, body = entry.strip('\n').split('\0', 1)
        for i, line in enumerate(body.splitlines(), 1):
            if NEEDLE in line:
                yield f'commit {sha[:12]} message', i


def main():
    if sys.argv[1:2] == ['--tree']:
        hits = list(tree_hits())
    elif len(sys.argv) >= 3 and sys.argv[1] == '--commits':
        hits = list(commit_hits(sys.argv[2:]))
    else:
        print('usage: injection_tripwire.py --tree | --commits GIT-LOG-ARGS...', file=sys.stderr)
        return 2
    for path, line in hits:
        if path.startswith('commit '):
            print(f'::error::sanitizer rewrite token in {path}, line {line}')
        else:
            print(f'::error file={path},line={line}::sanitizer rewrite token found')
        print(f'  {path}:{line}', file=sys.stderr)
    if hits:
        print(f'\nBLOCKED: {len(hits)} sanitizer rewrite token(s) outside {EXEMPT[0]}.',
              file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
