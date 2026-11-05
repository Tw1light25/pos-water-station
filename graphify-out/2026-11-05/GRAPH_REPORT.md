# Graph Report - Point Of Sale  (2026-11-05)

## Corpus Check
- 76 files · ~57,431 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 3, .bat 2, .example 1)

## Summary
- 1405 nodes · 3774 edges · 56 communities (46 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `310b9f1d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Admin Shell and API Client
- Admin Auth and API Routes
- Customer Site UI Shell
- Chart.js Layout Engine
- zt
- Chart.js Core Exports
- o
- Offline Sync Service
- Netlify Customer Functions
- SQLite Backup Service
- Chart.js Time Scale Ticks
- Secret Scan and Scripts
- make-icon.mjs
- Chart.js Tooltip Geometry
- Chart.js Event Bindings
- Package Manifest
- l
- server.js
- ca
- ns
- Chart.js Dataset Drawing
- tables.js
- Database Init and Seeding
- SQLite DB and SQL Dialects
- Chart.js Registry
- Project Docs and Data Rules
- update
- Chart.js Adapter Layer
- Chart.js Canvas Platform
- Chart.js Pie Controller
- a
- n
- .getDatasetMeta
- Chart.js Layout Updates
- Dashboard Time Buckets
- scripts
- da
- Chart.js Render Loop
- reset-password.js
- .update
- s
- Chart.js Canvas Resize
- Windows Installer Script
- TiDB Bootstrap and Pool
- Hydrain Brand Identity (root)
- Chart.js Dataset Meta
- Money Centavos Helpers
- Owner Login Flow
- Admin Logo Brand Assets
- Admin Favicon Brand Mark
- Chart.js Teardown
- Site Favicon Brand Mark
- Customer Site Logo Assets
- Owner Login Auth
- Discounts and Money Rules

## God Nodes (most connected - your core abstractions)
1. `an()` - 64 edges
2. `ns()` - 57 edges
3. `escapeHtml()` - 54 edges
4. `s()` - 43 edges
5. `toast()` - 37 edges
6. `n()` - 37 edges
7. `get()` - 36 edges
8. `no` - 35 edges
9. `peso()` - 34 edges
10. `va` - 31 edges

## Surprising Connections (you probably didn't know these)
- `backupConfig()` --calls--> `fromProjectRoot()`  [EXTRACTED]
  admin/backup.js → shared/paths.js
- `openLocalDatabase()` --calls--> `sqliteStatements()`  [EXTRACTED]
  admin/db.js → shared/dialects.js
- `openLocalDatabase()` --calls--> `ensureSqliteColumns()`  [EXTRACTED]
  admin/db.js → shared/migrate.js
- `mountAccountRoutes()` --calls--> `hashPassword()`  [EXTRACTED]
  admin/routes/account.js → shared/passwords.js
- `mountDashboardRoutes()` --indirect_call--> `shortDayLabel()`  [INFERRED]
  admin/routes/dashboard.js → shared/time-buckets.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hydrain Brand Identity Composition** — hydrain_logo, hydrain_water_droplet_mascot, hydrain_wordmark, hydrain_tagline, hydrain_wave_motif, hydrain_brand_palette [EXTRACTED 1.00]
- **Offline-Safe Data Design Rules** — readme_ulid_keys, readme_last_write_wins, readme_stock_ledger, readme_centavo_money, readme_soft_delete [EXTRACTED 1.00]
- **Offline Sync Write-Queue Flow** — readme_offline_first_sync, readme_outbox_queue, readme_ulid_keys, readme_last_write_wins, readme_soft_delete [EXTRACTED 1.00]
- **Customer Site Landing to Order to Track Flow** — site_index_landing_page, site_order_order_page, site_track_track_page, readme_netlify_functions_api, readme_customer_offline_queue [INFERRED 0.85]

## Communities (56 total, 10 thin omitted)

### Community 0 - "Admin Shell and API Client"
Cohesion: 0.07
Nodes (113): api(), del(), get(), post(), put(), boot(), currentSlug(), loadSettings() (+105 more)

### Community 1 - "Admin Auth and API Routes"
Cohesion: 0.07
Nodes (69): mountAuthRoutes(), requireApiAuth(), requirePageAuth(), mountAccountRoutes(), adoptInUseCategories(), DEPENDENT, ensureDefaultCategories(), findById() (+61 more)

### Community 2 - "Customer Site UI Shell"
Cohesion: 0.07
Nodes (71): api(), errorCard(), escapeHtml(), logoMark(), peso(), renderFooter(), renderHeader(), app (+63 more)

### Community 3 - "Chart.js Layout Engine"
Cohesion: 0.06
Nodes (16): afterDraw(), afterEvent(), afterUpdate(), ba, Bi(), Ci(), Do(), eo() (+8 more)

### Community 4 - "zt"
Cohesion: 0.05
Nodes (17): Bt(), color(), Cs, Ft(), Gt(), It(), jt(), kt() (+9 more)

### Community 5 - "Chart.js Core Exports"
Cohesion: 0.05
Nodes (14): d(), destroy(), draw(), Ee(), getMaxOverflow(), Jo(), kn(), Le() (+6 more)

### Community 6 - "o"
Cohesion: 0.10
Nodes (23): at(), b(), cn(), dn(), e(), ei(), g(), gi() (+15 more)

### Community 7 - "Offline Sync Service"
Cohesion: 0.16
Nodes (19): createSyncService(), applyPulledRow(), doRun(), getPool(), pullOnce(), pushOnce(), pushRecord(), runOnce() (+11 more)

### Community 8 - "Netlify Customer Functions"
Cohesion: 0.09
Nodes (32): config, hits, config, config, config, FINISHED, hits, orderResponse() (+24 more)

### Community 9 - "SQLite Backup Service"
Cohesion: 0.12
Nodes (30): backupConfig(), BUSINESS_TABLES, changeCountSince(), countSince(), createBackupService(), backupIfChanged(), getStatus(), runNow() (+22 more)

### Community 10 - "Chart.js Time Scale Ticks"
Cohesion: 0.07
Nodes (10): buildLookupTable(), En, _generate(), _getTimestampsForTable(), init(), initOffsets(), lt(), no (+2 more)

### Community 11 - "Secret Scan and Scripts"
Cohesion: 0.06
Nodes (24): ADMIN_DIR, DATA_DIR, dotenv, files, FORBIDDEN, offending, pemFiles, walkFiles() (+16 more)

### Community 12 - "make-icon.mjs"
Cohesion: 0.15
Nodes (10): AND_MASK, BG, dir, DROP, entry, header, image, OUT (+2 more)

### Community 13 - "Chart.js Tooltip Geometry"
Cohesion: 0.11
Nodes (25): ao(), average(), dataset(), getCenterPoint(), ho(), Hs, _i(), index() (+17 more)

### Community 15 - "Package Manifest"
Cohesion: 0.13
Nodes (14): dependencies, dotenv, express, express-session, mysql2, description, engines, node (+6 more)

### Community 16 - "l"
Cohesion: 0.15
Nodes (16): buildTicks(), determineDataLimits(), Fn(), Gn(), go(), ii(), l(), parse() (+8 more)

### Community 17 - "server.js"
Cohesion: 0.20
Nodes (10): PUBLIC_DIR, app, APP_PAGES, backup, db, line(), PORT, server (+2 more)

### Community 18 - "ca"
Cohesion: 0.09
Nodes (14): Ae(), ca(), _calculateBarIndexPixels(), _calculateBarValuePixels(), getBasePixel(), getLabelAndValue(), getLabelForValue(), getPixelForTick() (+6 more)

### Community 19 - "ns"
Cohesion: 0.06
Nodes (11): As(), beforeUpdate(), bn(), initialize(), ns(), on(), pn(), updateElements() (+3 more)

### Community 20 - "Chart.js Dataset Drawing"
Cohesion: 0.16
Nodes (10): ea(), fa(), ga(), ha, la(), pa(), ra(), sa() (+2 more)

### Community 21 - "tables.js"
Cohesion: 0.14
Nodes (10): TABLE_BY_NAME, TABLE_DEFS, TABLE_NAMES, APPEND_ONLY, CLOUD_CREATED, DELETED_AT, PRIMARY_KEY, TABLE_BY_NAME (+2 more)

### Community 22 - "Database Init and Seeding"
Cohesion: 0.17
Nodes (20): applySchema(), DEFAULT_HOURS, ensureDatabase(), firstRow(), flags, line(), main(), printSummary() (+12 more)

### Community 23 - "SQLite DB and SQL Dialects"
Cohesion: 0.18
Nodes (14): DB_PATH, columnDefinition(), columnSql(), formatDefault(), MYSQL_TYPES, mysqlStatements(), quote(), renderMySQL() (+6 more)

### Community 24 - "Chart.js Registry"
Cohesion: 0.10
Nodes (6): addElements(), fe(), ks(), nn(), sn, tn

### Community 25 - "Project Docs and Data Rules"
Cohesion: 0.14
Nodes (18): Admin SPA Shell (index.html), AGENTS.md - Agent Working Context Guide, requireApiAuth Route Gate, Automatic SQLite Backup Snapshots, Customer-Side Offline Order Retry Queue, Last-Write-Wins Conflict Resolution, Netlify Customer API (settings, products, orders, track), Offline-First Sync Architecture (+10 more)

### Community 26 - "update"
Cohesion: 0.15
Nodes (11): beforeLayout(), es(), generateLabels(), is(), ki(), oa(), Qi(), qo() (+3 more)

### Community 27 - "Chart.js Adapter Layer"
Cohesion: 0.16
Nodes (6): ce(), de, dt(), he(), ia(), qs()

### Community 28 - "Chart.js Canvas Platform"
Cohesion: 0.14
Nodes (13): ct(), fs(), ge(), gs(), ms(), pe(), ps(), i() (+5 more)

### Community 30 - "a"
Cohesion: 0.12
Nodes (12): a(), Di(), Fo(), j(), ko, pi(), pt(), r() (+4 more)

### Community 31 - "n"
Cohesion: 0.20
Nodes (4): Be(), n(), ne(), numeric()

### Community 32 - ".getDatasetMeta"
Cohesion: 0.22
Nodes (5): aa(), afterDatasetsUpdate(), labelColor(), labelPointStyle(), reset()

### Community 33 - "Chart.js Layout Updates"
Cohesion: 0.29
Nodes (5): addBox(), configure(), start(), u(), vn()

### Community 34 - "Dashboard Time Buckets"
Cohesion: 0.27
Nodes (16): mountDashboardRoutes(), bucketSeries(), currentMonthDayKeys(), currentWeekDayKeys(), dateKeysFrom(), dayKey(), hourOfDay(), lastDayKeys() (+8 more)

### Community 35 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, admin, backup, check, db:init, db:print, password, restore (+3 more)

### Community 36 - "da"
Cohesion: 0.13
Nodes (12): ai(), beforeDatasetDraw(), beforeDatasetsDraw(), beforeDraw(), da(), getRange(), hi(), Ie() (+4 more)

### Community 38 - "reset-password.js"
Cohesion: 0.29
Nodes (8): openLocalDatabase(), args, askHidden(), choosePassword(), line(), main(), SET_PASSWORD, USERNAME

### Community 41 - "s"
Cohesion: 0.12
Nodes (8): bo, et(), getValueForPixel(), H(), s(), label(), mo(), xo

### Community 43 - "Windows Installer Script"
Cohesion: 0.26
Nodes (7): Get-NodeVersion(), Install-Node(), Stop-Install(), Test-NodeReady(), Update-SessionPath(), Write-Bad(), Write-Warn2()

### Community 45 - "TiDB Bootstrap and Pool"
Cohesion: 0.33
Nodes (8): BOOTSTRAP_TABLES, bootstrapIfNeeded(), toSqliteValue(), connectionConfig(), createPool(), sslConfig(), fromProjectRoot(), COLUMNS

### Community 49 - "Hydrain Brand Identity (root)"
Cohesion: 0.38
Nodes (9): Hydrain Brand Identity System, Cyan, Azure and Deep Navy Brand Palette, Hydrain Water Station Logo, Splash and Droplet Accents, Water Station Tagline, Smiling Water Droplet Mascot, Water Station Refilling Business, Curling Wave Ribbon Motif (+1 more)

### Community 52 - "Money Centavos Helpers"
Cohesion: 0.36
Nodes (6): centsToPlainString(), CURRENCIES, DEFAULT_CURRENCY, formatCents(), fromCents(), resolveCurrency()

### Community 53 - "Owner Login Flow"
Cohesion: 0.33
Nodes (6): checkOwner(), errorBox, form, noOwnerBox, show(), submit

### Community 54 - "Admin Logo Brand Assets"
Cohesion: 0.60
Nodes (6): Aqua-Blue Brand Color Palette, Smiling Water Droplet Mascot, Hydrain Brand Wordmark, Hydrain Water Station Logo, "Water Station" Tagline, Water Splash and Wave Background

### Community 56 - "Admin Favicon Brand Mark"
Cohesion: 0.40
Nodes (5): Hydrain Admin Web Application, Hydrain Favicon, Hydrain Brand, Smiling Water Drop Mascot, Water Station Business

### Community 58 - "Site Favicon Brand Mark"
Cohesion: 0.60
Nodes (5): Hydrain Favicon, Hydrain Wordmark ("Hydrain" + "WATER STATION"), Customer Site Brand Identity (favicon/logo tile), Smiling Water-Droplet Mascot, Turquoise Wave/Splash Backdrop and Aqua Bubbles

### Community 59 - "Customer Site Logo Assets"
Cohesion: 0.60
Nodes (5): Aqua/Blue Splash Colour Palette and Wave Motif, Hydrain Brand Identity, Hydrain Water Station Logo (logo.jpg), Smiling Water Droplet Mascot, Rounded Blue Wordmark Lockup with 'WATER STATION' Subtitle

## Knowledge Gaps
- **13 isolated node(s):** `Last-Write-Wins Conflict Resolution`, `Soft Deletes via deleted_at`, `Track Stock Toggle and Refill-as-Service Rule`, `Client-Generated ULID Primary Keys`, `Customer Order Tracking Page` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 287 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ns()` connect `ns` to `Chart.js Layout Engine`, `zt`, `Chart.js Core Exports`, `Chart.js Time Scale Ticks`, `ca`, `Chart.js Dataset Meta`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `s()` (e.g. with `ho()` and `ii()`) actually correct?**
  _`s()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Last-Write-Wins Conflict Resolution`, `Soft Deletes via deleted_at`, `Track Stock Toggle and Refill-as-Service Rule` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Shell and API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.0655757874015748 - nodes in this community are weakly interconnected._
- **Why does `an()` connect `Chart.js Event Bindings` to `.getDatasetMeta`, `Chart.js Layout Updates`, `da`, `Chart.js Render Loop`, `Chart.js Core Exports`, `.update`, `o`, `Chart.js Tooltip Geometry`, `Chart.js Dataset Meta`, `Chart.js Registry`, `Chart.js Teardown`, `update`, `Chart.js Canvas Platform`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `Admin Auth and API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06862745098039216 - nodes in this community are weakly interconnected._
- **Why does `eo()` connect `Chart.js Layout Engine` to `Chart.js Core Exports`, `s`, `l`, `ca`, `update`, `a`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._