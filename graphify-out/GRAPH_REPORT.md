# Graph Report - Point Of Sale  (2026-11-26)

## Corpus Check
- 80 files · ~61,351 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 3, .bat 2, .example 1)

## Summary
- 1450 nodes · 3895 edges · 58 communities (48 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 123 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fd4e9746`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Admin Shell and API Client
- Admin Auth and API Routes
- Customer Site UI Shell
- eo
- zt
- Chart.js Core Exports
- e
- Offline Sync Service
- Netlify Customer Functions
- SQLite Backup Service
- Chart.js Time Scale Ticks
- Secret Scan and Scripts
- make-icon.mjs
- Chart.js Tooltip Geometry
- an
- Package Manifest
- l
- getPixelForValue
- n
- ns
- admin/update.js
- d
- Database Init and Seeding
- SQLite DB and SQL Dialects
- Chart.js Registry
- Project Docs and Data Rules
- update
- Chart.js Adapter Layer
- ws
- Chart.js Pie Controller
- a
- xn
- va
- tables.js
- Dashboard Time Buckets
- ba
- Si
- scripts
- reset-password.js
- xo
- .getParsed
- s
- Chart.js Canvas Resize
- Windows Installer Script
- wi
- TiDB Bootstrap and Pool
- Hydrain Brand Identity (root)
- Money Centavos Helpers
- Owner Login Flow
- Admin Logo Brand Assets
- Admin Favicon Brand Mark
- Site Favicon Brand Mark
- Customer Site Logo Assets
- Owner Login Auth
- Discounts and Money Rules

## God Nodes (most connected - your core abstractions)
1. `an()` - 64 edges
2. `ns()` - 57 edges
3. `escapeHtml()` - 55 edges
4. `s()` - 43 edges
5. `toast()` - 38 edges
6. `get()` - 37 edges
7. `n()` - 37 edges
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
- `mountDashboardRoutes()` --indirect_call--> `shortHourLabel()`  [INFERRED]
  admin/routes/dashboard.js → shared/time-buckets.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hydrain Brand Identity Composition** — hydrain_logo, hydrain_water_droplet_mascot, hydrain_wordmark, hydrain_tagline, hydrain_wave_motif, hydrain_brand_palette [EXTRACTED 1.00]
- **Offline-Safe Data Design Rules** — readme_ulid_keys, readme_last_write_wins, readme_stock_ledger, readme_centavo_money, readme_soft_delete [EXTRACTED 1.00]
- **Offline Sync Write-Queue Flow** — readme_offline_first_sync, readme_outbox_queue, readme_ulid_keys, readme_last_write_wins, readme_soft_delete [EXTRACTED 1.00]
- **Customer Site Landing to Order to Track Flow** — site_index_landing_page, site_order_order_page, site_track_track_page, readme_netlify_functions_api, readme_customer_offline_queue [INFERRED 0.85]

## Communities (58 total, 10 thin omitted)

### Community 0 - "Admin Shell and API Client"
Cohesion: 0.06
Nodes (122): api(), del(), get(), post(), put(), boot(), checkForUpdate(), currentSlug() (+114 more)

### Community 1 - "Admin Auth and API Routes"
Cohesion: 0.05
Nodes (83): mountAuthRoutes(), requireApiAuth(), requirePageAuth(), formatBytes(), mountAccountRoutes(), mountBackupRoutes(), adoptInUseCategories(), DEPENDENT (+75 more)

### Community 2 - "Customer Site UI Shell"
Cohesion: 0.07
Nodes (71): api(), errorCard(), escapeHtml(), logoMark(), peso(), renderFooter(), renderHeader(), app (+63 more)

### Community 3 - "eo"
Cohesion: 0.14
Nodes (5): ca(), Ci(), Do(), eo(), Oe()

### Community 4 - "zt"
Cohesion: 0.05
Nodes (17): Bt(), color(), Cs, Ft(), Gt(), It(), jt(), kt() (+9 more)

### Community 5 - "Chart.js Core Exports"
Cohesion: 0.04
Nodes (43): at(), b(), beforeDatasetDraw(), beforeDatasetsDraw(), beforeDraw(), beforeLayout(), cn(), da() (+35 more)

### Community 6 - "e"
Cohesion: 0.14
Nodes (6): ei(), En, init(), je(), qe(), ti()

### Community 7 - "Offline Sync Service"
Cohesion: 0.16
Nodes (19): createSyncService(), applyPulledRow(), doRun(), getPool(), pullOnce(), pushOnce(), pushRecord(), runOnce() (+11 more)

### Community 8 - "Netlify Customer Functions"
Cohesion: 0.09
Nodes (32): config, hits, config, config, config, FINISHED, hits, orderResponse() (+24 more)

### Community 9 - "SQLite Backup Service"
Cohesion: 0.13
Nodes (28): backupConfig(), BUSINESS_TABLES, changeCountSince(), countSince(), createBackupService(), backupIfChanged(), getStatus(), runNow() (+20 more)

### Community 10 - "Chart.js Time Scale Ticks"
Cohesion: 0.11
Nodes (9): buildLookupTable(), _generate(), _getTimestampsForTable(), initOffsets(), lt(), no, nt(), zi() (+1 more)

### Community 11 - "Secret Scan and Scripts"
Cohesion: 0.06
Nodes (24): ADMIN_DIR, PUBLIC_DIR, dotenv, files, FORBIDDEN, offending, pemFiles, walkFiles() (+16 more)

### Community 12 - "make-icon.mjs"
Cohesion: 0.15
Nodes (10): AND_MASK, BG, dir, DROP, entry, header, image, OUT (+2 more)

### Community 13 - "Chart.js Tooltip Geometry"
Cohesion: 0.11
Nodes (21): ai(), ao(), average(), getCenterPoint(), ho(), Hs, _i(), inRange() (+13 more)

### Community 14 - "an"
Cohesion: 0.05
Nodes (29): addBox(), afterDatasetsUpdate(), an(), beforeUpdate(), ct(), dataset(), fs(), generateLabels() (+21 more)

### Community 15 - "Package Manifest"
Cohesion: 0.13
Nodes (14): dependencies, dotenv, express, express-session, mysql2, description, engines, node (+6 more)

### Community 16 - "l"
Cohesion: 0.17
Nodes (10): buildTicks(), Fn(), go(), ii(), parse(), parseArrayData(), parseObjectData(), parsePrimitiveData() (+2 more)

### Community 17 - "getPixelForValue"
Cohesion: 0.13
Nodes (13): Ae(), _calculateBarIndexPixels(), getPixelForTick(), getPixelForValue(), _getRuler(), _getStackCount(), _getStackIndex(), _getStacks() (+5 more)

### Community 18 - "n"
Cohesion: 0.22
Nodes (4): Be(), n(), ne(), numeric()

### Community 19 - "ns"
Cohesion: 0.09
Nodes (4): As(), ns(), rt(), zs()

### Community 20 - "admin/update.js"
Cohesion: 0.16
Nodes (25): mountUpdateRoutes(), pendingCount(), acknowledgeApplied(), cachedCheck(), check(), compareVersions(), copyTree(), currentVersion() (+17 more)

### Community 21 - "d"
Cohesion: 0.09
Nodes (3): d(), Xs(), Y()

### Community 22 - "Database Init and Seeding"
Cohesion: 0.20
Nodes (18): applySchema(), DEFAULT_HOURS, ensureDatabase(), firstRow(), flags, line(), main(), printSummary() (+10 more)

### Community 23 - "SQLite DB and SQL Dialects"
Cohesion: 0.16
Nodes (15): DB_PATH, DATA_DIR, columnDefinition(), columnSql(), formatDefault(), MYSQL_TYPES, mysqlStatements(), quote() (+7 more)

### Community 24 - "Chart.js Registry"
Cohesion: 0.10
Nodes (6): addElements(), fe(), ks(), nn(), sn, tn

### Community 25 - "Project Docs and Data Rules"
Cohesion: 0.14
Nodes (18): Admin SPA Shell (index.html), AGENTS.md - Agent Working Context Guide, requireApiAuth Route Gate, Automatic SQLite Backup Snapshots, Customer-Side Offline Order Retry Queue, Last-Write-Wins Conflict Resolution, Netlify Customer API (settings, products, orders, track), Offline-First Sync Architecture (+10 more)

### Community 26 - "update"
Cohesion: 0.22
Nodes (5): getBasePixel(), labelColor(), labelPointStyle(), update(), updateElements()

### Community 27 - "Chart.js Adapter Layer"
Cohesion: 0.21
Nodes (4): ce(), de, dt(), he()

### Community 28 - "ws"
Cohesion: 0.25
Nodes (5): ge(), pe(), we(), ws, xe()

### Community 30 - "a"
Cohesion: 0.07
Nodes (28): a(), aa(), determineDataLimits(), Di(), dn(), e(), Fo(), g() (+20 more)

### Community 31 - "xn"
Cohesion: 0.16
Nodes (5): bn(), on(), pn(), xn, Ye()

### Community 32 - "va"
Cohesion: 0.15
Nodes (6): afterEvent(), Bi(), configure(), Fi(), f(), va

### Community 33 - "tables.js"
Cohesion: 0.14
Nodes (10): TABLE_BY_NAME, TABLE_DEFS, TABLE_NAMES, APPEND_ONLY, CLOUD_CREATED, DELETED_AT, PRIMARY_KEY, TABLE_BY_NAME (+2 more)

### Community 34 - "Dashboard Time Buckets"
Cohesion: 0.25
Nodes (19): mountDashboardRoutes(), bucketSeries(), currentMonthDayKeys(), currentWeekDayKeys(), currentYearHalfMonthKeys(), dateKeysFrom(), dayKey(), halfMonthKey() (+11 more)

### Community 35 - "ba"
Cohesion: 0.26
Nodes (4): afterUpdate(), ba, Ee(), Le()

### Community 36 - "Si"
Cohesion: 0.24
Nodes (7): afterDraw(), gs(), ki(), oa(), Oi(), Si(), x()

### Community 37 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, admin, backup, check, db:init, db:print, password, restore (+3 more)

### Community 38 - "reset-password.js"
Cohesion: 0.27
Nodes (9): openLocalDatabase(), args, askHidden(), choosePassword(), line(), main(), SET_PASSWORD, USERNAME (+1 more)

### Community 41 - "s"
Cohesion: 0.11
Nodes (8): bo, _calculateBarValuePixels(), et(), getValueForPixel(), H(), s(), label(), mo()

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
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 297 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ns()` connect `ns` to `Si`, `Chart.js Core Exports`, `zt`, `.getParsed`, `s`, `Chart.js Time Scale Ticks`, `l`, `update`, `xn`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `s()` (e.g. with `ho()` and `ii()`) actually correct?**
  _`s()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Last-Write-Wins Conflict Resolution`, `Soft Deletes via deleted_at`, `Track Stock Toggle and Refill-as-Service Rule` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Shell and API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.06032632030914556 - nodes in this community are weakly interconnected._
- **Why does `an()` connect `an` to `Chart.js Registry`, `s`, `Chart.js Core Exports`, `e`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `Admin Auth and API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.0539701028926422 - nodes in this community are weakly interconnected._
- **Why does `tn` connect `Chart.js Registry` to `Chart.js Core Exports`, `an`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._