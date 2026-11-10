#!/usr/bin/env python3
"""Find the Workers Builds Preview URL that Cloudflare reported to GitHub for a commit (D25).

Only check runs and deployment statuses created by the Cloudflare GitHub app are trusted:
the workflow's own checks are created by github-actions and are ignored. Reads GH_TOKEN
(read-only), REPO, SHA; optionally WORKER_NAME (its production hostname is rejected).

Writes `status` (skip | found) and `url` to $GITHUB_OUTPUT.
  skip:  no Cloudflare build reported for this commit, or it reported no URL.
  found: a *.workers.dev preview URL.
Exit 1 (job fails): the build failed or timed out, or a reported URL is not an acceptable
*.workers.dev preview hostname.
"""
import json
import os
import re
import sys
import time
import urllib.request

API = 'https://api.github.com'
HOST_RE = re.compile(r'^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\.workers\.dev$')
URL_RE = re.compile(r'https?://[^\s<>"\')\]]+', re.I)
# Links that appear in every Cloudflare/GitHub report and are not the preview.
NOISE = re.compile(r'(^|\.)(cloudflare\.com|github\.com|githubusercontent\.com)$')
GRACE = int(os.environ.get('GRACE_SECONDS', '180'))  # wait this long for a build to appear
LIMIT = int(os.environ.get('LIMIT_SECONDS', '1200'))  # wait this long for it to finish


def is_cloudflare(app):
    app = app or {}
    return 'cloudflare' in f"{app.get('slug', '')} {app.get('name', '')}".lower()


def pick(texts, worker=''):
    """Return (url, None) for the preview URL in `texts`, (None, None) if none, (None, why) if bad."""
    urls = []
    for t in texts:
        for m in URL_RE.finditer(t or ''):
            u = m.group(0).rstrip('.,;:')
            if u not in urls:
                urls.append(u)
    good, bad = [], []
    for u in urls:
        m = re.match(r'^(https?)://([^/?#]+)(.*)$', u, re.I)
        host = m.group(2).lower()
        if NOISE.search(host):
            continue
        if m.group(1).lower() != 'https' or not HOST_RE.match(host) or m.group(3) not in ('', '/'):
            bad.append(u)
        elif worker and host.split('.')[0] == worker:
            bad.append(u + ' (production hostname)')
        else:
            good.append(f'https://{host}')
    if bad:
        return None, 'not a *.workers.dev preview URL: ' + ', '.join(bad)
    if not good:
        return None, None
    # Prefer the URL labelled "Preview URL" if the report uses that wording.
    for t in texts:
        m = re.search(r'preview url\W{0,10}(https://[^\s<>"\')\]]+)', t or '', re.I)
        if m and m.group(1).rstrip('/.,;:').lower() in good:
            return m.group(1).rstrip('/.,;:').lower(), None
    return good[0], None


def get(path):
    req = urllib.request.Request(
        API + path,
        headers={
            'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def runs(repo, sha):
    data = get(f'/repos/{repo}/commits/{sha}/check-runs?per_page=100')
    return [r for r in data['check_runs'] if is_cloudflare(r.get('app'))]


def deployment_texts(repo, sha):
    out = []
    for d in get(f'/repos/{repo}/deployments?sha={sha}&per_page=30'):
        if not is_cloudflare(d.get('performed_via_github_app')):
            continue
        for s in get(f"/repos/{repo}/deployments/{d['id']}/statuses?per_page=10"):
            out += [s.get('environment_url'), s.get('target_url'), s.get('description')]
    return out


def emit(status, url=''):
    print(f'preview status={status} url={url}')
    path = os.environ.get('GITHUB_OUTPUT')
    if path:
        with open(path, 'a') as f:
            f.write(f'status={status}\nurl={url}\n')


def main():
    repo, sha = os.environ['REPO'], os.environ['SHA']
    worker = os.environ.get('WORKER_NAME', '')
    start = time.monotonic()
    while True:
        found = runs(repo, sha)
        waited = time.monotonic() - start
        if not found and waited >= GRACE:
            print(f'::notice::No Workers Builds check run for {sha} after {GRACE}s; skipping e2e.')
            emit('skip')
            return 0
        if found and all(r['status'] == 'completed' for r in found):
            break
        if waited >= LIMIT:
            print(f'::error::Workers Builds did not finish within {LIMIT}s.')
            return 1
        time.sleep(15)
    failed = [r['name'] for r in found if r['conclusion'] not in ('success', 'neutral', 'skipped')]
    if failed:
        print('::error::Workers Builds check failed: ' + ', '.join(failed))
        return 1
    texts = []
    for r in found:
        o = r.get('output') or {}
        texts += [o.get('title'), o.get('summary'), o.get('text'), r.get('details_url')]
    texts += deployment_texts(repo, sha)
    url, why = pick(texts, worker)
    if why:
        print(f'::error::{why}')
        return 1
    if not url:
        print('::notice::Workers Builds reported no preview URL (was the preview command `wrangler preview`?); skipping e2e.')
        emit('skip')
        return 0
    emit('found', url)
    return 0


if __name__ == '__main__':
    sys.exit(main())
