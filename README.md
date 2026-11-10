# devhouse-template

Dev House project template: a Hono API and a React PWA on one Cloudflare Worker (D20, D11),
TypeScript strict, ESLint and Prettier (D22), Vitest (D10) and an OpenAPI contract (O1,
contract-first).

| Path                                | What                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/api/`                          | Hono app, served under `/api/*` (Worker runs first for `/api/*`)                                 |
| `src/web/`, `index.html`, `public/` | React PWA client (static assets, SPA fallback)                                                   |
| `openapi/openapi.json`              | API contract. `test/api.test.ts` checks routes ↔ spec; CI `spec-diff` checks it against the base |
| `e2e/`                              | Playwright + axe, run by CI against the branch preview only                                      |
| `tools/`                            | `card_guard.py`, `injection_tripwire.py`, `text_hygiene.py` (run locally and in CI)              |

## After creating a repo from this template

1. `git config core.hooksPath .githooks` (local card guard; CI runs the same scan).
2. Replace `devhouse-template` in `wrangler.jsonc` and `package.json`.
3. Create two D1 databases (`<name>-prod`, `<name>-preview`) and put their ids in `wrangler.jsonc`
   (top level = production, `previews` block = preview). Previews do not inherit production
   bindings and use **non-production bindings with fake data only** (D25).
4. Connect **Workers Builds** (Cloudflare dashboard → Workers → Import a repository):
   build command `npm run build`; deploy command `npx wrangler deploy`; production branch `main`;
   enable non-production branch builds with preview command `npx wrangler preview`
   (not `versions upload`: that reports a Version URL, not a Preview URL).
5. Once per preview database, from a machine logged in to Cloudflare: `npm run db:migrate:preview`
   then `npm run db:seed:preview` (fake data, `seeds/preview.sql`). Production gets schema only:
   `npm run db:migrate:prod`. Never seed production.

`preview-e2e` reads the Preview URL from the Cloudflare check run / deployment status on the PR's
head commit (`tools/find_preview_url.py`). It skips when Workers Builds reported nothing and fails
if the reported URL is not a `*.workers.dev` preview hostname.

## Rules

- Workflows, `CODEOWNERS` and dependency manifests change only with Chanel's approval; every new
  runtime dependency needs her approval (D21). Updates arrive as Dependabot PRs; Chanel merges.
- CI never holds secrets: it runs agent-authored code (D25).
