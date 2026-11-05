# Graph Report - Point Of Sale  (2026-11-05)

## Corpus Check
- 76 files · ~57,272 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 3, .bat 2, .example 1)

## Summary
- 1400 nodes · 3766 edges · 53 communities (41 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4d12f6c1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Admin Shell and API Client
- Admin Auth and API Routes
- Customer Site UI Shell
- Chart.js Layout Engine
- zt
- Chart.js Core Exports
- Chart.js Scale Hooks
- Offline Sync Service
- Netlify Customer Functions
- SQLite Backup Service
- Chart.js Time Scale Ticks
- Secret Scan and Scripts
- make-icon.mjs
- Chart.js Tooltip Geometry
- Chart.js Event Bindings
- Package Manifest
- Cs
- server.js
- ca
- ns
- Chart.js Dataset Drawing
- xt
- Database Init and Seeding
- SQLite DB and SQL Dialects
- Chart.js Registry
- Project Docs and Data Rules
- _t
- Chart.js Adapter Layer
- Chart.js Canvas Platform
- Chart.js Pie Controller
- o
- Chart.js Layout Updates
- Dashboard Time Buckets
- Chart.js Grid Drawing
- Chart.js Render Loop
- s
- Chart.js Canvas Resize
- Windows Installer Script
- ko
- TiDB Bootstrap and Pool
- Chart.js Plugin Notify
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
- `mountDashboardRoutes()` --indirect_call--> `shortDayLabel()`  [INFERRED]
  admin/routes/dashboard.js → shared/time-buckets.js
- `mountDashboardRoutes()` --indirect_call--> `shortMonthLabel()`  [INFERRED]
  admin/routes/dashboard.js → shared/time-buckets.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hydrain Brand Identity Composition** — hydrain_logo, hydrain_water_droplet_mascot, hydrain_wordmark, hydrain_tagline, hydrain_wave_motif, hydrain_brand_palette [EXTRACTED 1.00]
- **Offline-Safe Data Design Rules** — readme_ulid_keys, readme_last_write_wins, readme_stock_ledger, readme_centavo_money, readme_soft_delete [EXTRACTED 1.00]
- **Offline Sync Write-Queue Flow** — readme_offline_first_sync, readme_outbox_queue, readme_ulid_keys, readme_last_write_wins, readme_soft_delete [EXTRACTED 1.00]
- **Customer Site Landing to Order to Track Flow** — site_index_landing_page, site_order_order_page, site_track_track_page, readme_netlify_functions_api, readme_customer_offline_queue [INFERRED 0.85]

## Communities (53 total, 12 thin omitted)

### Community 0 - "Admin Shell and API Client"
Cohesion: 0.07
Nodes (113): api(), del(), get(), post(), put(), boot(), currentSlug(), loadSettings() (+105 more)

### Community 1 - "Admin Auth and API Routes"
Cohesion: 0.07
Nodes (69): mountAuthRoutes(), requireApiAuth(), mountAccountRoutes(), adoptInUseCategories(), DEPENDENT, ensureDefaultCategories(), findById(), findByName() (+61 more)

### Community 2 - "Customer Site UI Shell"
Cohesion: 0.07
Nodes (71): api(), errorCard(), escapeHtml(), logoMark(), peso(), renderFooter(), renderHeader(), app (+63 more)

### Community 3 - "Chart.js Layout Engine"
Cohesion: 0.05
Nodes (21): afterDraw(), afterEvent(), afterUpdate(), ba, beforeLayout(), Bi(), Ci(), configure() (+13 more)

### Community 4 - "zt"
Cohesion: 0.12
Nodes (8): Bt(), color(), Ft(), Gt(), jt(), te(), vt(), zt()

### Community 5 - "Chart.js Core Exports"
Cohesion: 0.05
Nodes (28): ao(), at(), b(), cn(), destroy(), draw(), Ee(), es() (+20 more)

### Community 6 - "Chart.js Scale Hooks"
Cohesion: 0.09
Nodes (4): d(), Di(), Xs(), Y()

### Community 7 - "Offline Sync Service"
Cohesion: 0.08
Nodes (30): createSyncService(), applyPulledRow(), doRun(), getPool(), pullOnce(), pushOnce(), pushRecord(), runOnce() (+22 more)

### Community 8 - "Netlify Customer Functions"
Cohesion: 0.09
Nodes (32): config, hits, config, config, config, FINISHED, hits, orderResponse() (+24 more)

### Community 9 - "SQLite Backup Service"
Cohesion: 0.09
Nodes (36): backupConfig(), BUSINESS_TABLES, changeCountSince(), countSince(), createBackupService(), backupIfChanged(), getStatus(), runNow() (+28 more)

### Community 10 - "Chart.js Time Scale Ticks"
Cohesion: 0.07
Nodes (10): buildLookupTable(), En, _generate(), _getTimestampsForTable(), init(), initOffsets(), no, nt() (+2 more)

### Community 11 - "Secret Scan and Scripts"
Cohesion: 0.08
Nodes (15): dotenv, files, FORBIDDEN, offending, pemFiles, walkFiles(), BANNER, FILES (+7 more)

### Community 12 - "make-icon.mjs"
Cohesion: 0.15
Nodes (10): AND_MASK, BG, dir, DROP, entry, header, image, OUT (+2 more)

### Community 13 - "Chart.js Tooltip Geometry"
Cohesion: 0.08
Nodes (33): ai(), average(), dataset(), e(), ei(), getCenterPoint(), ho(), Hs (+25 more)

### Community 14 - "Chart.js Event Bindings"
Cohesion: 0.11
Nodes (5): afterDatasetsUpdate(), an(), generateLabels(), onClick(), ts()

### Community 15 - "Package Manifest"
Cohesion: 0.08
Nodes (25): dependencies, dotenv, express, express-session, mysql2, description, engines, node (+17 more)

### Community 17 - "server.js"
Cohesion: 0.09
Nodes (23): requirePageAuth(), DB_PATH, openLocalDatabase(), ADMIN_DIR, DATA_DIR, PUBLIC_DIR, app, APP_PAGES (+15 more)

### Community 18 - "ca"
Cohesion: 0.13
Nodes (19): buildTicks(), ca(), _calculateBarIndexPixels(), _calculateBarValuePixels(), getBasePixel(), getLabelAndValue(), getLabelForValue(), getPixelForTick() (+11 more)

### Community 19 - "ns"
Cohesion: 0.05
Nodes (10): As(), bn(), labelColor(), labelPointStyle(), ns(), on(), pn(), rt() (+2 more)

### Community 20 - "Chart.js Dataset Drawing"
Cohesion: 0.12
Nodes (15): beforeDatasetDraw(), beforeDatasetsDraw(), beforeDraw(), da(), ea(), fa(), ga(), ha (+7 more)

### Community 22 - "Database Init and Seeding"
Cohesion: 0.19
Nodes (19): applySchema(), DEFAULT_HOURS, ensureDatabase(), firstRow(), flags, line(), main(), printSummary() (+11 more)

### Community 23 - "SQLite DB and SQL Dialects"
Cohesion: 0.27
Nodes (13): columnDefinition(), columnSql(), formatDefault(), MYSQL_TYPES, mysqlStatements(), quote(), renderMySQL(), renderSQLite() (+5 more)

### Community 25 - "Project Docs and Data Rules"
Cohesion: 0.14
Nodes (18): Admin SPA Shell (index.html), AGENTS.md - Agent Working Context Guide, requireApiAuth Route Gate, Automatic SQLite Backup Snapshots, Customer-Side Offline Order Retry Queue, Last-Write-Wins Conflict Resolution, Netlify Customer API (settings, products, orders, track), Offline-First Sync Architecture (+10 more)

### Community 26 - "_t"
Cohesion: 0.22
Nodes (6): It(), kt(), mt(), qt(), _t(), wt()

### Community 27 - "Chart.js Adapter Layer"
Cohesion: 0.17
Nodes (5): ce(), de, dt(), he(), qs()

### Community 28 - "Chart.js Canvas Platform"
Cohesion: 0.14
Nodes (15): ct(), fs(), ge(), gi(), gs(), mi(), ms(), pe() (+7 more)

### Community 30 - "o"
Cohesion: 0.13
Nodes (18): a(), aa(), determineDataLimits(), dn(), g(), Gn(), m(), l() (+10 more)

### Community 33 - "Chart.js Layout Updates"
Cohesion: 0.18
Nodes (7): addBox(), beforeUpdate(), initialize(), reset(), start(), u(), vn()

### Community 34 - "Dashboard Time Buckets"
Cohesion: 0.42
Nodes (12): mountDashboardRoutes(), bucketSeries(), dayKey(), lastDayKeys(), lastMonthKeys(), lastWeekKeys(), monthKey(), shifted() (+4 more)

### Community 41 - "s"
Cohesion: 0.07
Nodes (22): Be(), bo, et(), Fn(), Fo(), go(), H(), ii() (+14 more)

### Community 43 - "Windows Installer Script"
Cohesion: 0.26
Nodes (7): Get-NodeVersion(), Install-Node(), Stop-Install(), Test-NodeReady(), Update-SessionPath(), Write-Bad(), Write-Warn2()

### Community 44 - "ko"
Cohesion: 0.15
Nodes (5): getValueForPixel(), j(), ko, vo(), wo()

### Community 45 - "TiDB Bootstrap and Pool"
Cohesion: 0.33
Nodes (7): BOOTSTRAP_TABLES, bootstrapIfNeeded(), toSqliteValue(), connectionConfig(), createPool(), sslConfig(), fromProjectRoot()

### Community 47 - "Chart.js Plugin Notify"
Cohesion: 0.26
Nodes (4): fe(), ks(), nn(), sn

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
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 286 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ns()` connect `ns` to `Cs`, `ca`, `Chart.js Core Exports`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `s()` (e.g. with `ho()` and `ii()`) actually correct?**
  _`s()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Last-Write-Wins Conflict Resolution`, `Soft Deletes via deleted_at`, `Track Stock Toggle and Refill-as-Service Rule` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Shell and API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.0655757874015748 - nodes in this community are weakly interconnected._
- **Why does `an()` connect `Chart.js Event Bindings` to `Chart.js Layout Updates`, `Chart.js Render Loop`, `Chart.js Core Exports`, `s`, `Chart.js Tooltip Geometry`, `Chart.js Dataset Meta`, `Chart.js Dataset Drawing`, `Chart.js Teardown`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `Admin Auth and API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06709435979684576 - nodes in this community are weakly interconnected._
- **Why does `eo()` connect `Chart.js Layout Engine` to `s`, `ca`, `Chart.js Core Exports`, `o`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._