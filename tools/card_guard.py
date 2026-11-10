#!/usr/bin/env python3
"""Block commits that contain payment card numbers or full bank account numbers.

Ported from mother-vault/tools/card_guard.py. Modes:
  --staged          staged additions (.githooks/pre-commit)
  --message FILE    a commit message (.githooks/commit-msg)
  --tree            every tracked file at HEAD (CI card-scan job)
  --commits ARGS... commit messages; ARGS go to git log (e.g. BASE..HEAD, or -1 SHA)
There is no allowlist and no bypass flag: fix the data, don't skip the check.
Output only ever shows the path, line and last four digits, never the line itself.
"""
import re
import subprocess
import sys

CAND = re.compile(r'(?<!\d)(?:\d[ \-]?){12,18}\d(?!\d)')
ACCT = re.compile(r'(?i)\b(?:acc(?:ount|t)?\.?\s*(?:no\.?|number|num|#)?\s*[:#]?\s*)(\d[\d \-]{6,16}\d)(?!\d)')
CTX = re.compile(r'(?i)\b(cvv2?|cvc|csc|security code|exp(?:iry|iration)?(?: date)?|valid thru)\b')


def luhn(d):
    s = 0
    for i, c in enumerate(reversed(d)):
        n = int(c)
        if i % 2:
            n = n * 2 - 9 if n > 4 else n * 2
        s += n
    return s % 10 == 0


def plausible(s):
    n, p2, p3, p4 = len(s), int(s[:2]), int(s[:3]), int(s[:4])
    if s[0] == '4':
        return n in (13, 16, 19)
    if p2 in (34, 37):
        return n == 15
    if 51 <= p2 <= 55 or 2221 <= p4 <= 2720:
        return n == 16
    if p4 == 6011 or p2 == 65 or 644 <= p3 <= 649:
        return 16 <= n <= 19
    if p2 in (36, 38, 39) or 300 <= p3 <= 305:
        return n in (14, 16)
    if 3528 <= p4 <= 3589 or p2 == 62:
        return 16 <= n <= 19
    if p2 in (50, 56, 57, 58, 63, 67):
        return 12 <= n <= 19
    return False


def findings(line):
    out = []
    for m in CAND.finditer(line):
        d = re.sub(r'\D', '', m.group())
        if 13 <= len(d) <= 19 and luhn(d) and plausible(d):
            out.append(('card number', d[-4:], bool(CTX.search(line))))
    for m in ACCT.finditer(line):
        d = re.sub(r'\D', '', m.group(1))
        if 8 <= len(d) <= 16:
            out.append(('bank account number', d[-4:], False))
    return out


def staged_added_lines():
    p = subprocess.run(['git', 'diff', '--cached', '-U0', '--no-color', '--no-ext-diff',
                        '--diff-filter=ACMR'], capture_output=True)
    if p.returncode != 0:
        print('card-guard: could not read the staged diff; blocking commit.', file=sys.stderr)
        sys.exit(2)
    path, lineno = '?', 0
    for raw in p.stdout.decode('utf-8', 'replace').splitlines():
        if raw.startswith('+++ '):
            path = raw[6:] if raw.startswith('+++ b/') else raw[4:]
        elif raw.startswith('@@'):
            m = re.search(r'\+(\d+)', raw)
            lineno = int(m.group(1)) if m else 0
        elif raw.startswith('+'):
            yield path, lineno, raw[1:]
            lineno += 1


def git(*args):
    p = subprocess.run(['git', *args], capture_output=True)
    if p.returncode != 0:
        print(f'card-guard: git {args[0]} failed; blocking.', file=sys.stderr)
        sys.exit(2)
    return p.stdout


def tree_lines():
    for path in git('ls-files', '-z').decode('utf-8', 'replace').split('\0'):
        if not path:
            continue
        try:
            data = open(path, 'rb').read()
        except (FileNotFoundError, IsADirectoryError):
            continue
        if b'\0' in data[:8192]:
            continue  # binary
        for i, line in enumerate(data.decode('utf-8', 'replace').splitlines(), 1):
            yield path, i, line


def commit_message_lines(log_args):
    out = git('log', '--format=%H%x00%B%x01', *log_args).decode('utf-8', 'replace')
    for entry in out.split('\x01'):
        if '\0' not in entry:
            continue
        sha, body = entry.strip('\n').split('\0', 1)
        for i, line in enumerate(body.splitlines(), 1):
            yield f'commit {sha[:12]} message', i, line


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == '--staged':
        src = staged_added_lines()
    elif len(sys.argv) >= 3 and sys.argv[1] == '--message':
        text = open(sys.argv[2], encoding='utf-8', errors='replace').read()
        src = (('commit message', i, l) for i, l in enumerate(text.splitlines(), 1))
    elif len(sys.argv) >= 2 and sys.argv[1] == '--tree':
        src = tree_lines()
    elif len(sys.argv) >= 3 and sys.argv[1] == '--commits':
        src = commit_message_lines(sys.argv[2:])
    else:
        print('usage: card_guard.py --staged | --message FILE | --tree | --commits GIT-LOG-ARGS...',
              file=sys.stderr)
        return 2
    bad = [(p, n, f) for p, n, l in src for f in findings(l)]
    if not bad:
        return 0
    print('\nBLOCKED: sensitive financial data found.\n', file=sys.stderr)
    for p, n, (kind, l4, ctx) in bad:
        extra = ' (CVV/expiry nearby)' if ctx else ''
        print(f'  {p}:{n}  {kind} •••• {l4}{extra}', file=sys.stderr)
    print('\nReplace it with the last four digits only (e.g. •••• 1234), and commit again.\n'
          'Rule: no agent stores, logs or commits card or full bank account numbers.\n',
          file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
