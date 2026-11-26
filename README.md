# Point of Sale - Water Station

An offline-first Point of Sale for a water station.

- **Shop PC (local admin)** - Node.js + Express bound to `127.0.0.1`. Works with
  no internet at all, reading and writing a single local SQLite file. Every
  write is queued and pushed to the cloud when the connection is available.
- **Cloud hub** - TiDB Cloud Starter (MySQL-compatible) holds the shared data.
- **Customer site** - landing page, order panel and order tracking, hosted on
  Netlify (free tier, commercial use allowed).

Currency is Philippine Peso (PHP). All money is stored as integer centavos.

## Architecture

```
SHOP PC (works offline)                        CLOUD
┌────────────────────────────────┐            ┌──────────────────────────────┐
│ Express admin ──► data/pos.db  │            │ Netlify Functions (customers)│
│      │                         │            │   │                          │
│      └─► outbox.jsonl ─────────┼── mysql2 ─►│   ├──► TiDB (MySQL)          │
│                                │◄── pull ───┼───┘                          │
│ sync every 15s + on reconnect  │            │ Netlify static (site/)       │
└────────────────────────────────┘            └──────────────────────────────┘
Customers: order form ─► offline queue ─► retries when online ─► Functions ─► TiDB
```

## Requirements

- Node.js 20 or newer (`node -v`)
- A TiDB Cloud Starter instance (free tier)
- A Netlify account (free) - only for deploying the customer site

## Setup

```bash
# 1. Dependencies
npm install

# 2. Configuration
cp .env.example .env      # fill in DB_HOST / DB_USER / DB_PASS
                          # download the CA cert from the TiDB console and
                          # save it as ./certs/ca.pem

# 3. Create the database, tables and seed data
npm run db:init
```

`db:init` is safe to re-run: tables use `IF NOT EXISTS`, missing columns are
added automatically, and seeding only happens when a table is empty.

## Windows (handing it to a client)

Delivery is a folder the client unzips anywhere and installs with one double-click.

```
Install.bat                     <- the client runs this
Start POS.bat                   <- launches the admin + opens the browser
Reset Password.bat              <- if nobody can sign in
windows\Install-WaterStationPOS.ps1
windows\Make-Package.ps1        <- you run this to build the delivery ZIP
windows\pos.ico
certs\ca.pem                    <- ships with the app
```

**`Install.bat`** (asks for administrator rights, then):
1. Installs **Node.js 24 LTS** if it is missing or too old — `winget` first, official MSI as a fallback
2. Checks `certs\ca.pem` is present
3. **Asks for the TiDB connection details** (the password is typed masked and never stored in a script)
4. Writes `.env` — *only if one does not already exist*, so it is safe to re-run
5. Runs `npm install`
6. Runs `npm run db:init` to prove the database is reachable
7. Puts a **“Water Station POS”** shortcut on the desktop

**`Start POS.bat`** starts the admin minimized and opens `http://127.0.0.1:3000`.

### Building the delivery ZIP (developer)
```powershell
powershell -ExecutionPolicy Bypass -File windows\Make-Package.ps1
```
Creates `WaterStationPOS-<date>.zip` on your desktop, **excluding** `hide/`, `data/`,
`node_modules/`, `.git/` and `.env` — so credentials and your owner-login notes never
travel with it.

### Handover notes
- The owner password lives in the **database**, not the installer. Hand it over
  separately, and tell the client to change it from **Settings → Account**.
- Paths in `.env` are resolved from the project folder, so the app works from any
  location (`C:\POS`, `D:\Water Station`, a desktop shortcut).
- The client's PC needs internet for the admin to reach TiDB.

### If nobody can sign in
Double-click **`Reset Password.bat`** (or run `npm run password`):
- on a terminal it asks for the new password twice, hidden
- add `-- --set NewPass123` to set it directly, or `-- --user owner` to pick an account
- piped with no terminal it **generates** a password and prints it

It writes to the local database and queues the change, so TiDB gets the new hash
on the next admin start.

## Running

```bash
npm run admin       # local admin  -> http://127.0.0.1:3000  (owner login)
npm run site:dev    # customer site preview -> http://127.0.0.1:4000
```

Other useful commands:

```bash
npm run db:print    # print the SQL without connecting
npm run site:build  # copy shared modules into site/assets/shared/
npm run check       # make sure no secrets would be pushed (run before pushing)
npm run backup      # take a backup now (if anything changed)
npm run restore     # restore a snapshot (see Automatic backups)
npm run password    # reset a locked-out owner password
```

## Deploying the customer site to Netlify

1. Push this project to a Git repository.
2. In Netlify: **Add new site -> Import an existing project** and pick the repo.
3. `netlify.toml` already sets the build command (`npm run site:build`), the
   publish directory (`site/`) and the functions directory
   (`netlify/functions`). Accept the defaults.
4. Add these environment variables under **Site configuration -> Environment
   variables**:

   | Key | Value | Mark as secret? |
   | --- | --- | --- |
   | `DB_HOST` | your TiDB host | **no** |
   | `DB_PORT` | `4000` | **no** |
   | `DB_USER` | your TiDB user | no |
   | `DB_NAME` | `pos-water-station` | **no** |
   | `DB_PASS` | your TiDB password | **yes** |
   | `DB_SSL` | `true` | no |

   Only `DB_PASS` should be marked secret. Marking the others makes Netlify
   search the whole repo for values like `4000` and `pos-water-station`, which
   appear in ordinary code, and it will fail the build over them.

   That is enough: the connection is encrypted without verifying the server
   certificate. To verify it as well, also add `DB_CA_CERT` containing the text
   of `certs/ca.pem` with `\n` in place of newlines -
   `sed ':a;N;$!ba;s/\n/\\n/g' certs/ca.pem`.

5. Deploy. The site is available at your Netlify URL; the API lives at
   `/api/settings`, `/api/products`, `/api/orders` and `/api/track`.

The TiDB IP allowlist must include `0.0.0.0/0` (or Netlify's ranges) for the
functions to connect.

### Releasing an update to clients

Each shop PC updates itself from your GitHub releases - nobody visits the shop.

```bash
npm version patch        # or minor / major - edits package.json
git push && git push --tags

git tag v1.2.0           # if you prefer not to use npm version
git push origin v1.2.0
```

Then on GitHub: **Releases → Draft a new release → pick the tag → Publish**.
A *draft* or *pre-release* is ignored, so nothing goes live until you publish.

On each client:

1. A **red dot** appears beside **Settings** (checked at startup and every 6 hours).
2. **Settings → App updates** shows the new version and your release notes.
3. The owner clicks **Update now**. The admin downloads the release, then
   restarts itself; the launcher installs the file swap, runs `npm install` and
   starts the POS again.

Rules that make this safe:

- The version in `package.json` **must match the tag**. A mismatch is refused.
- An update never touches `.env`, `data/`, `hide/`, `backups/`, `certs/` or
  `node_modules/` - the shop's credentials and live sales stay put.
- A copy of the previous code is kept in `data/update-backup/` during the swap
  and restored automatically if `npm install` fails.
- The current files are *not* replaced while the server is running; the server
  exits with code `75` and `windows/Run-WaterStationPOS.ps1` finishes the job.

### "Build failed - exposed secrets"

Netlify scans in two ways, and both **fail the build**:

1. **Smart detection** - pattern-matches credential-looking content anywhere in
   the repo or the build output (PEM markers, API-key shapes). Only ever add
   real credentials in Netlify's **Environment variables**, never in a file that
   is committed.
2. **Secret values** - for any environment variable you mark as *secret*, it
   searches the repo and build output for that exact value.

Fixes, in order of preference:

- Run **`npm run check`** before pushing. It fails on PEM markers, on tracked
  `.env`/`.pem`/`data/`/`hide/` files, and on your real password leaking out.
- Make sure only **`DB_PASS`** is marked secret in Netlify. `DB_HOST`,
  `DB_PORT` and `DB_NAME` are not secrets, and their values appear naturally in
  the code (`4000`, `pos-water-station`, the hostname).
- `netlify.toml` already carries the two escape hatches that Netlify recommends:
  `SECRETS_SCAN_OMIT_PATHS` (files) and `SECRETS_SCAN_OMIT_KEYS` (variables to
  ignore when matching values).
- If a genuine false positive remains, safelist the exact string with
  `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES`, or turn scanning off entirely with
  `SECRETS_SCAN_SMART_DETECTION_ENABLED=false` / `SECRETS_SCAN_ENABLED=false`.

The deploy log always names the file and line it objected to - read that first.

## Discounts

Set when the admin enters an order, and shown on the receipt:

```
Subtotal          ₱250.00
Discount (20%)    -₱50.00
Senior citizen
Delivery fee       ₱20.00
TOTAL             ₱220.00
```

- **Percent or flat amount**, with quick 5 / 10 / 20 % buttons and preset reasons
  (Senior citizen, PWD, Loyalty, Wholesale) - or type your own
- Applies to the **goods only**, never the delivery fee
- **Clamped to the subtotal**, so a total can never go negative
- **Editable afterwards** from the order detail, and removing it restores the full price
- Paying the discounted total still marks the order **paid**; change/sukli follows the new total
- Only the admin can apply one - the customer site is unaffected
- **Dashboard -> "Discounts this month"** shows how much you have given away

Stored on the order as `discount_cents` (the amount off), `discount_percent` (for
display) and `discount_reason`.

## Branding / logo

The logo is **bundled**, not hot-linked, and lives in both halves of the app:

```
admin/public/assets/img/logo.jpg    512x512, served at /assets/img/logo.jpg
site/assets/img/logo.jpg            the same file, for the customer site
admin/public/assets/favicon.png     browser tab icon (64x64)
site/assets/favicon.png
windows/pos.ico                     desktop shortcut icon (5 sizes)
```

`settings.logo_url` is set to the **relative** path `/assets/img/logo.jpg`, so
the same value works on `http://127.0.0.1:3000` and on your Netlify domain.

It appears on: the admin **login page**, the admin **sidebar**, the customer
**landing / order / track** headers, and the **printed receipt**.

- To use a different image: **Settings -> Business identity -> Logo image URL**
  (any URL works), or replace `logo.jpg` with your own file.
- To rebuild the derivatives from a new master image:
  ```bash
  magick master.jpg -resize 512x512 -quality 85 -strip admin/public/assets/img/logo.jpg
  cp admin/public/assets/img/logo.jpg site/assets/img/logo.jpg
  magick master.jpg -resize 64x64 -strip admin/public/assets/favicon.png
  cp admin/public/assets/favicon.png site/assets/favicon.png
  magick master.jpg -resize 256x256 -define icon:auto-resize=256,64,48,32,16 -strip windows/pos.ico
  ```
- **Do not paste a Facebook/CDN image link into the logo field.** Those are
  signed, expiring URLs: the one originally used here stopped working a few days
  later and would have quietly broken the logo on the customer site.

## Categories

Products and expenses each have their own **pick list**:

```
Category   [ Refill                                     ▾ ]   [ Manage ]
```

**Manage** opens a small window where the list is edited:

```
Product categories
  [ New category name…              ]   [ Add ]

  Category                     Actions
  Refill                       Rename  Delete
  Container                    Rename  Delete

                                      [ Close ]
```

- Pick a category from the dropdown - no free typing
- **Add** at the top of the window (Enter works too)
- **Rename** edits the row in place and **updates every product/expense using
  that name**; if it was the one you had selected, the dropdown follows it
- **Delete** is refused while anything still uses it, and says how many do
- The two lists are **independent** - `Refill` never appears under expenses, and
  `rent` never under products
- Anything already in use is picked up automatically, so nothing is lost
- Closing the window refreshes the dropdown and the list behind it

Fresh installs are seeded with `Refill · Container · Bottled · Accessory` for
products and `general · maintenance · rent · utilities · supplies · salary ·
transport · equipment` for expenses.

> Note: the **Refill → "don't track stock"** rule matches the literal name
> `Refill`. If you rename that category, new products in it default to tracked
> again (existing products keep their own setting).

## Stock tracking

Not everything you sell is stock. A **refill** is a service - the customer brings
their own container - so counting it makes no sense. Each product has a
**Track stock** switch:

- **On** (default) - counted, capped at the quantity on hand, can run out
- **Off** - never counted, never capped, never "out of stock", and no stock
  ledger entries are written when it is sold

Choosing the **Refill** category in the product editor flips the switch off
automatically; anything else flips it on. It stays overridable - flip it back
and save if you want a "Refill" item counted anyway.

Untracked products:

- are **hidden from the Inventory tab** (that tab means "things we count")
- are ignored by **low-stock alerts** and the stock-value totals
- show **"Not tracked"** instead of a stock badge on the Products tab
- can't be given a stock movement (receive/adjust is refused with a message)

Their old ledger history is kept but ignored, so switching tracking back on
would restore whatever was counted before.

### Ordering more than you have

- **Admin order form** - each product shows its stock (`· 5 in stock`, or
  `· out of stock`) and a line that goes past it is flagged in red as you type.
  Saving asks **“More than you have in stock - record anyway?”**, so overselling
  is possible but never an accident. Confirming leaves stock negative until you
  receive more.
- **Customer site** - stricter: a customer simply cannot order past the stock on
  hand, and out-of-stock items can't be added at all.
- **Refills** are never flagged on either side - they are a service.

## Price history is immutable

Changing a product's price affects **future orders only**. Every order line
stores the name, unit and price it was **sold at**, so historical orders are
financial records that never move:

- `recalcOrder` sums the *stored* `line_total_cents`, never the products table
- Replacing an order's items keeps the price each product was already sold at
  and uses today's price only for newly added products
- The product editor says so: *"Only affects future orders"*

```
npm run test:history -- <owner-password>
```
proves it: it takes an order, changes the product price, and asserts the order's
line price, total, payments and status are untouched — while a new order does
pick up the new price. It cleans up after itself.

## Automatic backups

A snapshot of the local database is written whenever something has actually
changed - a quiet shop never produces a backup file.

| Trigger | When |
| --- | --- |
| Every **20 transactions** | An order, payment, expense or new/edited customer counts as one |
| Every **30 minutes** | Only if anything changed since the last backup |
| **On startup** | Catches a previous session that ended without one (crash, power cut) |
| **On shutdown** | Ctrl+C, `timeout`, or a service stop |

Snapshots go to `backups/pos-<date>_<time>-<reason>.db` and use SQLite's
`VACUUM INTO`, so they are complete, compact and safe to take mid-sale. The
newest **30** are kept; older ones are deleted automatically.

```bash
npm run backup              # back up now, if anything changed
npm run backup -- --force   # back up regardless
npm run restore -- --list   # show the available snapshots
npm run restore -- backups/pos-2026-10-14_135501-20txn.db
```

**Restoring:** stop the admin first. The restore keeps a safety copy of the
current database, resets the sync marker, and the next start re-reads the whole
cloud database - so any cloud row newer than the snapshot wins.

**Settings -> Backups** shows the last backup, how many are kept, disk used, the
newest snapshots, and a **Back up now** button.

Tuning (all optional, defaults shown):

```
BACKUP_ENABLED=true
BACKUP_EVERY_TRANSACTIONS=20
BACKUP_INTERVAL_MINUTES=30
BACKUP_KEEP=30
# BACKUP_DIR=D:\POS Backups
```

`backups/` holds real customer data, so it is gitignored, rejected by
`npm run check`, and excluded from the client ZIP.

## Project layout

```
Point Of Sale/
  admin/                     # local admin (never exposed to the network)
    server.js                # Express app bound to 127.0.0.1
    db.js  bootstrap.js      # local SQLite + first-run pull from TiDB
    auth.js                  # owner login (scrypt + session)
    routes/                  # settings, products, inventory, expenses,
                             # orders, customers, dashboard
    sync/                    # outbox.jsonl queue + the sync service
    public/                  # admin UI (Tokyo Night, sidebar, Chart.js)
  netlify/
    functions/               # settings, products, orders, track  (public API)
    lib/                     # shared db + http helpers
  site/                      # customer site (Netlify publish directory)
  shared/                    # code used by BOTH sides
    schema.js                # single source of truth for every table
    dialects.js              # renders the schema as MySQL or SQLite
    migrate.js               # adds new columns to existing databases
    ids.js  money.js         # ULIDs + centavo helpers
    store-status.js          # open/closed logic (also runs in the browser)
    time-buckets.js          # timezone-aware day/week/month grouping
    mysql.js  passwords.js  tables.js
  scripts/
    db-init.js               # create + seed the database
    backup.js  restore.js    # manual backup + disaster recovery
    check-secrets.js         # pre-push guard
    reset-password.js        # owner password recovery
    prepare-site.js          # copy browser-safe shared modules into site/
    site-dev.js              # local preview server for the customer site
  windows/                   # Windows installer + packaging (see above)
    Run-WaterStationPOS.ps1  # launcher + update hand-off (exit code 75)
    Update-WaterStationPOS.ps1 # installs a staged release, rolls back on failure
  Install.bat  Start POS.bat # double-click entry points for the client
  data/                      # generated: pos.db, outbox.jsonl, sync-state.json
  backups/                   # generated: automatic snapshots (never pushed)
```

## Database

| Table | Purpose |
| --- | --- |
| `users` | Owner login |
| `settings` | Business identity, store hours, ordering defaults |
| `products` | Catalogue with fixed prices |
| `inventory_logs` | Append-only stock ledger (on-hand = `SUM(change_qty)`) |
| `customers` | Customer records and notes |
| `orders` | Orders with delivery + payment status |
| `order_items` | Line items per order |
| `payments` | Payments received (supports partial payments) |
| `expenses` | Free-form outgoing money |

Design rules that make offline sync safe:

1. Every row has a **ULID** primary key, generated on the client.
2. Every row has `updated_at` (epoch ms) and a soft-delete `deleted_at`.
3. Stock is a **ledger** - additive rows, so it cannot drift between devices.
4. Money is stored as **integer centavos**.
5. Mutable rows resolve **last-write-wins** on `updated_at`.

## How offline sync works

- Every admin write goes to `data/pos.db` and appends one line to
  `data/outbox.jsonl`.
- Every ~15 seconds (and at startup, and when you click the sidebar pill) the
  sync service **pushes** those lines to TiDB with an upsert, then **pulls** any
  rows that changed in TiDB back into SQLite.
- Customer orders placed on the website appear in the admin on the next sync.
- On the customer side, a failed submission is stored on the device and retried
  automatically; the client-generated order id makes retries idempotent.

## Roadmap

- [x] **Step 1** - Foundation: schema, helpers, TiDB setup
- [x] **Step 2** - Local admin: login, dashboard, products, inventory, expenses,
      orders, sales, customers, settings
- [x] **Step 3** - Offline sync: outbox queue, push/pull service, status pill
- [x] **Step 4** - Customer site: landing, order panel, tracking, Netlify functions
- [ ] **Step 5** - Polish: final theme pass, end-to-end walkthrough

## Notes

- The admin is intentionally bound to `127.0.0.1`, so nothing outside the shop PC
  can reach it.
- Set a spend limit on the TiDB free tier so it cannot auto-bill unexpectedly.
- Free Netlify accounts allow commercial use; free Vercel Hobby accounts do not.
