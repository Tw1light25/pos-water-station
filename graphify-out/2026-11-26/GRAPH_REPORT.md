# Graph Report - Point Of Sale  (2026-11-26)

## Corpus Check
- 76 files · ~57,900 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 3, .bat 2, .example 1)

## Summary
- 1411 nodes · 3795 edges · 51 communities (40 shown, 11 thin omitted)
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
- Chart.js Layout Engine
- zt
- Chart.js Core Exports
- e
- Offline Sync Service
- Netlify Customer Functions
- SQLite Backup Service
- Chart.js Time Scale Ticks
- Secret Scan and Scripts
- site-dev.js
- Chart.js Tooltip Geometry
- an
- Package Manifest
- l
- ._computeLabelItems
- ca
- ns
- Chart.js Dataset Drawing
- d
- Database Init and Seeding
- SQLite DB and SQL Dialects
- Chart.js Registry
- Project Docs and Data Rules
- update
- Chart.js Adapter Layer
- .bindResponsiveEvents
- Chart.js Pie Controller
- a
- sn
- .getDatasetMeta
- Chart.js Layout Updates
- Dashboard Time Buckets
- Chart.js Render Loop
- reset-password.js
- s
- Chart.js Canvas Resize
- Windows Installer Script
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

## Communities (51 total, 11 thin omitted)

### Community 0 - "Admin Shell and API Client"
Cohesion: 0.06
Nodes (116): api(), del(), get(), post(), put(), boot(), currentSlug(), loadSettings() (+108 more)

### Community 1 - "Admin Auth and API Routes"
Cohesion: 0.06
Nodes (78): mountAuthRoutes(), requireApiAuth(), requirePageAuth(), mountAccountRoutes(), adoptInUseCategories(), DEPENDENT, ensureDefaultCategories(), findById() (+70 more)

### Community 2 - "Customer Site UI Shell"
Cohesion: 0.07
Nodes (71): api(), errorCard(), escapeHtml(), logoMark(), peso(), renderFooter(), renderHeader(), app (+63 more)

### Community 3 - "Chart.js Layout Engine"
Cohesion: 0.05
Nodes (18): afterDraw(), afterEvent(), afterUpdate(), ba, Bi(), Ci(), Do(), eo() (+10 more)

### Community 4 - "zt"
Cohesion: 0.06
Nodes (16): Bt(), color(), Cs, Ft(), Gt(), It(), jt(), kt() (+8 more)

### Community 5 - "Chart.js Core Exports"
Cohesion: 0.04
Nodes (45): ai(), at(), b(), beforeDraw(), beforeLayout(), cn(), ct(), destroy() (+37 more)

### Community 6 - "e"
Cohesion: 0.12
Nodes (10): e(), ei(), En, ia(), init(), je(), qe(), s() (+2 more)

### Community 7 - "Offline Sync Service"
Cohesion: 0.08
Nodes (29): createSyncService(), applyPulledRow(), doRun(), getPool(), pullOnce(), pushOnce(), pushRecord(), runOnce() (+21 more)

### Community 8 - "Netlify Customer Functions"
Cohesion: 0.12
Nodes (24): config, hits, config, config, config, FINISHED, hits, orderResponse() (+16 more)

### Community 9 - "SQLite Backup Service"
Cohesion: 0.12
Nodes (30): backupConfig(), BUSINESS_TABLES, changeCountSince(), countSince(), createBackupService(), backupIfChanged(), getStatus(), runNow() (+22 more)

### Community 10 - "Chart.js Time Scale Ticks"
Cohesion: 0.10
Nodes (8): buildLookupTable(), configure(), _generate(), _getTimestampsForTable(), initOffsets(), no, nt(), zo()

### Community 11 - "Secret Scan and Scripts"
Cohesion: 0.07
Nodes (20): ADMIN_DIR, DATA_DIR, PUBLIC_DIR, dotenv, files, FORBIDDEN, offending, pemFiles (+12 more)

### Community 12 - "site-dev.js"
Cohesion: 0.07
Nodes (23): BANNER, FILES, FROM, ROOT, TO, MIME, PORT, readBody() (+15 more)

### Community 13 - "Chart.js Tooltip Geometry"
Cohesion: 0.14
Nodes (22): ao(), average(), dataset(), getCenterPoint(), ho(), Hs, _i(), index() (+14 more)

### Community 14 - "an"
Cohesion: 0.09
Nodes (6): an(), f(), generateLabels(), Mn(), removeBox(), stop()

### Community 15 - "Package Manifest"
Cohesion: 0.08
Nodes (25): dependencies, dotenv, express, express-session, mysql2, description, engines, node (+17 more)

### Community 16 - "l"
Cohesion: 0.23
Nodes (10): buildTicks(), Fn(), go(), ii(), parse(), parseArrayData(), parseObjectData(), parsePrimitiveData() (+2 more)

### Community 18 - "ca"
Cohesion: 0.11
Nodes (19): Ae(), ca(), _calculateBarIndexPixels(), _calculateBarValuePixels(), getBasePixel(), getLabelAndValue(), getLabelForValue(), getPixelForTick() (+11 more)

### Community 19 - "ns"
Cohesion: 0.05
Nodes (10): As(), bn(), labelColor(), labelPointStyle(), ns(), on(), pn(), rt() (+2 more)

### Community 20 - "Chart.js Dataset Drawing"
Cohesion: 0.12
Nodes (14): beforeDatasetDraw(), beforeDatasetsDraw(), da(), ea(), fa(), ga(), ha, Ie() (+6 more)

### Community 22 - "Database Init and Seeding"
Cohesion: 0.17
Nodes (20): applySchema(), DEFAULT_HOURS, ensureDatabase(), firstRow(), flags, line(), main(), printSummary() (+12 more)

### Community 23 - "SQLite DB and SQL Dialects"
Cohesion: 0.18
Nodes (14): DB_PATH, columnDefinition(), columnSql(), formatDefault(), MYSQL_TYPES, mysqlStatements(), quote(), renderMySQL() (+6 more)

### Community 25 - "Project Docs and Data Rules"
Cohesion: 0.14
Nodes (18): Admin SPA Shell (index.html), AGENTS.md - Agent Working Context Guide, requireApiAuth Route Gate, Automatic SQLite Backup Snapshots, Customer-Side Offline Order Retry Queue, Last-Write-Wins Conflict Resolution, Netlify Customer API (settings, products, orders, track), Offline-First Sync Architecture (+10 more)

### Community 26 - "update"
Cohesion: 0.22
Nodes (8): es(), is(), mt(), pt(), Qi(), ss(), ts(), update()

### Community 27 - "Chart.js Adapter Layer"
Cohesion: 0.21
Nodes (5): ce(), de, dt(), he(), qs()

### Community 30 - "a"
Cohesion: 0.10
Nodes (22): a(), aa(), determineDataLimits(), dn(), Fo(), g(), Gn(), j() (+14 more)

### Community 31 - "sn"
Cohesion: 0.26
Nodes (4): fe(), ks(), nn(), sn

### Community 33 - "Chart.js Layout Updates"
Cohesion: 0.17
Nodes (7): addBox(), beforeUpdate(), initialize(), reset(), start(), u(), vn()

### Community 34 - "Dashboard Time Buckets"
Cohesion: 0.25
Nodes (19): mountDashboardRoutes(), bucketSeries(), currentMonthDayKeys(), currentWeekDayKeys(), currentYearHalfMonthKeys(), dateKeysFrom(), dayKey(), halfMonthKey() (+11 more)

### Community 38 - "reset-password.js"
Cohesion: 0.29
Nodes (8): openLocalDatabase(), args, askHidden(), choosePassword(), line(), main(), SET_PASSWORD, USERNAME

### Community 41 - "s"
Cohesion: 0.10
Nodes (11): Be(), bo, et(), getValueForPixel(), H(), s(), label(), mo() (+3 more)

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
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ns()` connect `ns` to `Chart.js Layout Engine`, `zt`, `Chart.js Core Exports`, `l`, `ca`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `s()` (e.g. with `ho()` and `ii()`) actually correct?**
  _`s()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Last-Write-Wins Conflict Resolution`, `Soft Deletes via deleted_at`, `Track Stock Toggle and Refill-as-Service Rule` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Shell and API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.06376981796829125 - nodes in this community are weakly interconnected._
- **Why does `an()` connect `an` to `.getDatasetMeta`, `Chart.js Layout Updates`, `Chart.js Render Loop`, `Chart.js Core Exports`, `e`, `Chart.js Tooltip Geometry`, `Chart.js Registry`, `.bindResponsiveEvents`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `Admin Auth and API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.05890257558790594 - nodes in this community are weakly interconnected._
- **Why does `ba` connect `Chart.js Layout Engine` to `Chart.js Layout Updates`, `Chart.js Tooltip Geometry`, `Chart.js Dataset Drawing`, `Chart.js Core Exports`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._