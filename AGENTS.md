# AGENTS.md

Offline-first Point of Sale for a water station: a local admin (Express + SQLite)
that syncs to TiDB Cloud, plus a Netlify-hosted customer site. `README.md` is the
full feature/operations guide; this file holds the context an agent needs to work
safely without rediscovering it.

## Commands

- `npm run admin` — local admin at http://127.0.0.1:3000 (needs `.env`; first run needs internet to reach TiDB)
- `npm run site:dev` — customer site + the real Netlify function modules at http://127.0.0.1:4000
- `npm run db:print` — render the generated MySQL schema without connecting (fast sanity check)
- `npm run db:init` — create/seed TiDB; safe to re-run
- `npm run check` — pre-push secret guard; run before pushing or committing
- `npm run test:history -- <owner-password>` — the only test; requires `npm run admin` to already be running

There is no configured test runner, linter, formatter, or typecheck.

## Runtime

- The admin requires Node **>=23.4** (`package.json` engines) because it uses the built-in `node:sqlite`. The README's "Node 20 or newer" is stale.
- Netlify functions run Node 20 (`netlify.toml`) and use `mysql2` only; they never import `node:sqlite`.

## Architecture

- `admin/` — Express bound to `127.0.0.1`; SQLite at `data/pos.db`, write queue at `data/outbox.jsonl`. Entry: `admin/server.js`.
- `netlify/functions/` — public customer API (`settings`, `products`, `orders`, `track`) reading/writing TiDB. Each exports `config = { path: '/api/...' }`.
- `shared/` — code used by the admin, the serverless functions, and the browser. Single source of truth.
- `site/` — static customer site; Netlify publish directory.
- `scripts/site-dev.js` serves the real Netlify function modules locally, so what you test is what deploys — no Netlify CLI.
- `site/assets/shared/*.js` are GENERATED from `shared/` by `npm run site:build` (`scripts/prepare-site.js`). Never edit them; edit the `shared/` originals.

## Adding an admin page

The admin is one SPA shell (`admin/public/index.html`). A new page touches three places:

1. `APP_PAGES` in `admin/server.js` (server serves the shell for that path)
2. a view module in `admin/public/assets/js/views/`
3. the `ROUTES` list in `admin/public/assets/js/app.js`

API routes live in `admin/routes/` and are mounted in `admin/routes/index.js`; everything there sits behind `requireApiAuth`.

## Schema & migrations

- `shared/schema.js` is the single schema source; `shared/dialects.js` renders it as MySQL or SQLite.
- Adding a column is a `schema.js`-only edit: missing columns are auto-added to TiDB and SQLite on startup (`shared/migrate.js`), and `shared/tables.js` derives the sync column lists automatically.
- A new column *type* must be taught to **both** type maps in `shared/dialects.js`.

## Data rules (do not break)

- Money is integer **centavos** in `*_cents` columns; never use floats.
- Primary keys are client-generated **ULIDs**; timestamps are epoch-ms bigints; deletes are soft via `deleted_at`; mutable rows resolve last-write-wins on `updated_at`.
- Stock is an append-only ledger (`inventory_logs`; on-hand = `SUM(change_qty)`) so it cannot drift across offline devices.
- Order lines store the price they were sold at. Changing a product price must never alter an existing order — `recalcOrder` (`admin/routes/orders.js`) sums the stored `line_total_cents`. `npm run test:history` guards exactly this.

## Environment & secrets

- `.env` is loaded from the project root (`admin/env.js`); paths inside it resolve relative to the project root, not the cwd (`shared/paths.js`).
- Never commit, print, or expose `hide/` (real credentials), `.env`, `certs/*.pem`, `data/`, or `backups/`. All are gitignored and rejected by `npm run check`.
- Netlify: only `DB_PASS` may be marked secret; `netlify.toml` sets `SECRETS_SCAN_OMIT_*` for the non-secret DB vars. Any PEM marker in a committed file fails the Netlify build.

## Deploy & packaging

- Netlify build is already configured in `netlify.toml` (`npm run site:build`, publish `site/`, functions `netlify/functions`). The TiDB IP allowlist must include `0.0.0.0/0`.
- Client delivery ZIP: `powershell -ExecutionPolicy Bypass -File windows/Make-Package.ps1` (excludes `hide/`, `data/`, `node_modules/`, `.git/`, `.env`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

First tool rule (MUST): when `graphify-out/graph.json` exists and the prompt concerns the codebase, your **first tool call** must be `graphify query "<question>"` (or `graphify explain` / `graphify path` when that is the focused tool). Do not start with `rg`, `grep`, `find`, `glob`, `read`, `ls`, or `git`. `.opencode/plugins/graphify.js` injects this policy into the system prompt on every model request, so it applies to every prompt and to every subagent.

Rules:
- Put the first-tool rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
