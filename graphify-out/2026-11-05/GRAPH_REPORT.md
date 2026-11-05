# Graph Report - Point Of Sale  (2026-10-17)

## Corpus Check
- 86 files · ~56,715 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 3, .bat 2, .example 1)

## Summary
- 1397 nodes · 3760 edges · 63 communities (47 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.85)
- Token cost: 7,700 input · 5,140 output

## Community Hubs (Navigation)
- Admin Shell and API Client
- Admin Auth and API Routes
- Customer Site UI Shell
- Chart.js Layout Engine
- Chart.js Animation Loop
- Chart.js Core Exports
- Chart.js Scale Hooks
- Offline Sync Service
- Netlify Customer Functions
- SQLite Backup Service
- Chart.js Time Scale Ticks
- Secret Scan and Scripts
- Static Site Dev Server
- Chart.js Tooltip Geometry
- Chart.js Event Bindings
- Package Manifest
- Chart.js Plugin Scopes
- Express Server Bootstrap
- Chart.js Bar Scale
- Chart.js Dataset Elements
- Chart.js Dataset Drawing
- Chart.js Radial Scale
- Database Init and Seeding
- SQLite DB and SQL Dialects
- Chart.js Registry
- Project Docs and Data Rules
- Chart.js Animation Registry
- Chart.js Adapter Layer
- Chart.js Canvas Platform
- Chart.js Pie Controller
- Chart.js Time Bounds
- Chart.js Legend Events
- Chart.js Time Adapters
- Chart.js Layout Updates
- Dashboard Time Buckets
- Chart.js Dataset Visibility
- Chart.js Grid Drawing
- Chart.js Render Loop
- Chart.js Tick Formatting
- Chart.js Arc Element
- Chart.js Dataset Controllers
- Chart.js Tick Compute
- Chart.js Canvas Resize
- Windows Installer Script
- Chart.js Pixel Mapping
- TiDB Bootstrap and Pool
- Password Reset CLI
- Chart.js Plugin Notify
- Chart.js Data Parsing
- Hydrain Brand Identity (root)
- Chart.js Dataset Meta
- Chart.js Bar Options
- Money Centavos Helpers
- Owner Login Flow
- Admin Logo Brand Assets
- Chart.js Style Resolution
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
- **Offline Sync Write-Queue Flow** — readme_offline_first_sync, readme_outbox_queue, readme_ulid_keys, readme_last_write_wins, readme_soft_delete [EXTRACTED 1.00]
- **Customer Site Landing to Order to Track Flow** — site_index_landing_page, site_order_order_page, site_track_track_page, readme_netlify_functions_api, readme_customer_offline_queue [INFERRED 0.85]
- **Offline-Safe Data Design Rules** — readme_ulid_keys, readme_last_write_wins, readme_stock_ledger, readme_centavo_money, readme_soft_delete [EXTRACTED 1.00]
- **Hydrain Brand Identity Composition** — hydrain_logo, hydrain_water_droplet_mascot, hydrain_wordmark, hydrain_tagline, hydrain_wave_motif, hydrain_brand_palette [EXTRACTED 1.00]

## Communities (63 total, 16 thin omitted)

### Community 0 - "Admin Shell and API Client"
Cohesion: 0.07
Nodes (113): api(), del(), get(), post(), put(), boot(), currentSlug(), loadSettings() (+105 more)

### Community 1 - "Admin Auth and API Routes"
Cohesion: 0.07
Nodes (66): mountAuthRoutes(), requireApiAuth(), mountAccountRoutes(), adoptInUseCategories(), DEPENDENT, ensureDefaultCategories(), findById(), findByName() (+58 more)

### Community 2 - "Customer Site UI Shell"
Cohesion: 0.07
Nodes (70): api(), errorCard(), escapeHtml(), logoMark(), peso(), renderFooter(), renderHeader(), app (+62 more)

### Community 3 - "Chart.js Layout Engine"
Cohesion: 0.08
Nodes (18): afterDraw(), afterEvent(), afterUpdate(), ba, Bi(), Ci(), configure(), Fi() (+10 more)

### Community 4 - "Chart.js Animation Loop"
Cohesion: 0.05
Nodes (17): Bt(), color(), Cs, Ft(), Gt(), It(), jt(), kt() (+9 more)

### Community 5 - "Chart.js Core Exports"
Cohesion: 0.05
Nodes (26): b(), beforeLayout(), cn(), destroy(), draw(), Ee(), es(), fe() (+18 more)

### Community 6 - "Chart.js Scale Hooks"
Cohesion: 0.08
Nodes (3): d(), Di(), Xs()

### Community 7 - "Offline Sync Service"
Cohesion: 0.08
Nodes (29): createSyncService(), applyPulledRow(), doRun(), getPool(), pullOnce(), pushOnce(), pushRecord(), runOnce() (+21 more)

### Community 8 - "Netlify Customer Functions"
Cohesion: 0.12
Nodes (24): config, hits, config, config, config, FINISHED, hits, getPool() (+16 more)

### Community 9 - "SQLite Backup Service"
Cohesion: 0.12
Nodes (30): backupConfig(), BUSINESS_TABLES, changeCountSince(), countSince(), createBackupService(), backupIfChanged(), getStatus(), runNow() (+22 more)

### Community 10 - "Chart.js Time Scale Ticks"
Cohesion: 0.09
Nodes (9): buildLookupTable(), _generate(), _getTimestampsForTable(), initOffsets(), lt(), no, nt(), zi() (+1 more)

### Community 11 - "Secret Scan and Scripts"
Cohesion: 0.07
Nodes (17): dotenv, files, FORBIDDEN, offending, pemFiles, walkFiles(), args, cfg (+9 more)

### Community 12 - "Static Site Dev Server"
Cohesion: 0.07
Nodes (23): BANNER, FILES, FROM, ROOT, TO, MIME, PORT, readBody() (+15 more)

### Community 13 - "Chart.js Tooltip Geometry"
Cohesion: 0.13
Nodes (23): ao(), average(), dataset(), getCenterPoint(), ho(), Hs, _i(), index() (+15 more)

### Community 15 - "Package Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, express, express-session, mysql2, description, engines, node (+16 more)

### Community 16 - "Chart.js Plugin Scopes"
Cohesion: 0.13
Nodes (7): bn(), dn(), on(), pn(), un(), xn, Ye()

### Community 17 - "Express Server Bootstrap"
Cohesion: 0.11
Nodes (16): requirePageAuth(), ADMIN_DIR, DATA_DIR, PUBLIC_DIR, app, APP_PAGES, backup, db (+8 more)

### Community 18 - "Chart.js Bar Scale"
Cohesion: 0.16
Nodes (22): _calculateBarIndexPixels(), Fn(), Fo(), getPixelForTick(), getPixelForValue(), _getRuler(), _getStackCount(), _getStackIndex() (+14 more)

### Community 20 - "Chart.js Dataset Drawing"
Cohesion: 0.11
Nodes (15): beforeDatasetDraw(), beforeDatasetsDraw(), da(), ea(), fa(), ga(), ha, ia() (+7 more)

### Community 21 - "Chart.js Radial Scale"
Cohesion: 0.14
Nodes (4): ca(), Do(), eo(), Oe()

### Community 22 - "Database Init and Seeding"
Cohesion: 0.19
Nodes (19): applySchema(), DEFAULT_HOURS, ensureDatabase(), firstRow(), flags, line(), main(), printSummary() (+11 more)

### Community 23 - "SQLite DB and SQL Dialects"
Cohesion: 0.18
Nodes (14): DB_PATH, columnDefinition(), columnSql(), formatDefault(), MYSQL_TYPES, mysqlStatements(), quote(), renderMySQL() (+6 more)

### Community 25 - "Project Docs and Data Rules"
Cohesion: 0.14
Nodes (18): Admin SPA Shell (index.html), AGENTS.md - Agent Working Context Guide, requireApiAuth Route Gate, Automatic SQLite Backup Snapshots, Customer-Side Offline Order Retry Queue, Last-Write-Wins Conflict Resolution, Netlify Customer API (settings, products, orders, track), Offline-First Sync Architecture (+10 more)

### Community 26 - "Chart.js Animation Registry"
Cohesion: 0.14
Nodes (17): at(), e(), ei(), g(), gi(), je(), m(), mi() (+9 more)

### Community 27 - "Chart.js Adapter Layer"
Cohesion: 0.18
Nodes (5): ce(), de, dt(), he(), qs()

### Community 28 - "Chart.js Canvas Platform"
Cohesion: 0.18
Nodes (11): ct(), fs(), ge(), gs(), ms(), ps(), i(), vs() (+3 more)

### Community 30 - "Chart.js Time Bounds"
Cohesion: 0.24
Nodes (4): a(), determineDataLimits(), ko, pt()

### Community 31 - "Chart.js Legend Events"
Cohesion: 0.13
Nodes (12): ai(), beforeDraw(), getRange(), hi(), K(), la(), li(), Ni() (+4 more)

### Community 32 - "Chart.js Time Adapters"
Cohesion: 0.13
Nodes (8): H(), is(), j(), mo(), pi(), r(), vo(), wo()

### Community 33 - "Chart.js Layout Updates"
Cohesion: 0.20
Nodes (6): addBox(), beforeUpdate(), initialize(), reset(), start(), u()

### Community 34 - "Dashboard Time Buckets"
Cohesion: 0.42
Nodes (12): mountDashboardRoutes(), bucketSeries(), dayKey(), lastDayKeys(), lastMonthKeys(), lastWeekKeys(), monthKey(), shifted() (+4 more)

### Community 35 - "Chart.js Dataset Visibility"
Cohesion: 0.22
Nodes (4): aa(), afterDatasetsUpdate(), oa(), onClick()

### Community 38 - "Chart.js Tick Formatting"
Cohesion: 0.15
Nodes (4): buildTicks(), En, init(), po()

### Community 39 - "Chart.js Arc Element"
Cohesion: 0.26
Nodes (4): getLabelAndValue(), getLabelForValue(), n(), resolveDataElementOptions()

### Community 41 - "Chart.js Tick Compute"
Cohesion: 0.18
Nodes (4): Be(), ne(), numeric(), xo

### Community 43 - "Windows Installer Script"
Cohesion: 0.26
Nodes (7): Get-NodeVersion(), Install-Node(), Stop-Install(), Test-NodeReady(), Update-SessionPath(), Write-Bad(), Write-Warn2()

### Community 44 - "Chart.js Pixel Mapping"
Cohesion: 0.18
Nodes (3): bo, et(), getValueForPixel()

### Community 45 - "TiDB Bootstrap and Pool"
Cohesion: 0.33
Nodes (8): BOOTSTRAP_TABLES, bootstrapIfNeeded(), toSqliteValue(), connectionConfig(), createPool(), sslConfig(), fromProjectRoot(), COLUMNS

### Community 46 - "Password Reset CLI"
Cohesion: 0.29
Nodes (8): openLocalDatabase(), args, askHidden(), choosePassword(), line(), main(), SET_PASSWORD, USERNAME

### Community 49 - "Hydrain Brand Identity (root)"
Cohesion: 0.38
Nodes (9): Hydrain Brand Identity System, Cyan, Azure and Deep Navy Brand Palette, Hydrain Water Station Logo, Splash and Droplet Accents, Water Station Tagline, Smiling Water Droplet Mascot, Water Station Refilling Business, Curling Wave Ribbon Motif (+1 more)

### Community 51 - "Chart.js Bar Options"
Cohesion: 0.33
Nodes (3): _calculateBarValuePixels(), getBasePixel(), updateElements()

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
- **13 isolated node(s):** `Admin Login Page (login.html)`, `Customer Order Tracking Page`, `Track Stock Toggle and Refill-as-Service Rule`, `Client-Generated ULID Primary Keys`, `Last-Write-Wins Conflict Resolution` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 285 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ns()` connect `Chart.js Dataset Elements` to `Chart.js Animation Loop`, `Chart.js Core Exports`, `Chart.js Arc Element`, `Chart.js Dataset Controllers`, `Chart.js Time Scale Ticks`, `Chart.js Data Parsing`, `Chart.js Bar Options`, `Chart.js Style Resolution`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `s()` (e.g. with `ho()` and `ii()`) actually correct?**
  _`s()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Admin Login Page (login.html)`, `Customer Order Tracking Page`, `Track Stock Toggle and Refill-as-Service Rule` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Shell and API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.0655757874015748 - nodes in this community are weakly interconnected._
- **Why does `an()` connect `Chart.js Event Bindings` to `Chart.js Layout Updates`, `Chart.js Dataset Visibility`, `Chart.js Render Loop`, `Chart.js Core Exports`, `Chart.js Tooltip Geometry`, `Chart.js Bar Scale`, `Chart.js Dataset Meta`, `Chart.js Teardown`, `Chart.js Animation Registry`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `Admin Auth and API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.07465108730931516 - nodes in this community are weakly interconnected._
- **Why does `eo()` connect `Chart.js Radial Scale` to `Chart.js Layout Engine`, `Chart.js Core Exports`, `Chart.js Tick Formatting`, `Chart.js Tick Compute`, `Chart.js Bar Scale`, `Chart.js Time Bounds`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._