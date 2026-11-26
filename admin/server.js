/**
 * Local admin server.
 *
 * Bound to 127.0.0.1 on purpose: nothing outside the shop PC can reach it.
 * Start it with `npm run admin`.
 */

import './env.js';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import { PROJECT_ROOT, PUBLIC_DIR } from './env.js';
import { DB_PATH, openLocalDatabase } from './db.js';
import { bootstrapIfNeeded } from './bootstrap.js';
import { mountAuthRoutes, requirePageAuth } from './auth.js';
import { mountApi } from './routes/index.js';
import { createSyncService } from './sync/sync.js';
import { createBackupService } from './backup.js';
import { currentVersion, compareVersions, previousInstall, markInstalled } from './update.js';
import { OUTBOX_PATH } from './sync/outbox.js';

const PORT = Number(process.env.ADMIN_PORT || 3000);
const HOST = '127.0.0.1';

const APP_PAGES = [
  '/',
  '/dashboard',
  '/orders',
  '/sales',
  '/products',
  '/inventory',
  '/expenses',
  '/customers',
  '/settings',
];

const line = (char = '-') => console.log(char.repeat(62));

const db = openLocalDatabase();

// If the launcher just installed a staged update, record it so Settings can
// confirm the upgrade once instead of silently moving on.
const previousUpdate = previousInstall();
if (previousUpdate && compareVersions(previousUpdate.version, currentVersion()) === 0) {
  markInstalled(previousUpdate.version);
}

let bootstrap;
try {
  bootstrap = await bootstrapIfNeeded(db);
} catch (error) {
  bootstrap = { pulled: false, reason: 'failed', error: error.message };
}

// Offline sync: drains the outbox to TiDB and pulls customer orders back.
const sync = createSyncService(db);
sync.start();

// Automatic local backups.
const backup = createBackupService(db);
backup.start();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(
  session({
    name: 'pos.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 },
  }),
);

mountAuthRoutes(app, db);
mountApi(app, db, sync, backup);

// Static assets (css / js / img).
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { index: false }));

// Serve the shared store-status module to the browser (single source of truth).
app.get('/shared/store-status.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(PROJECT_ROOT, 'shared', 'store-status.js'));
});

// Public page.
app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// Everything below needs a signed-in owner.
app.use(requirePageAuth);
app.get(APP_PAGES, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  return res.redirect('/');
});

const server = app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  line();
  console.log('  Water Station POS - local admin');
  line();
  console.log(`  Version     ${currentVersion()}`);
  console.log(`  Running     ${url}`);
  console.log(`  Project     ${PROJECT_ROOT}`);
  console.log(`  Local db    ${DB_PATH}`);
  console.log(`  Outbox      ${OUTBOX_PATH}`);
  console.log(`  Sync        every ${sync.getStatus().intervalMs / 1000}s, ${sync.getStatus().pending} pending`);
  if (bootstrap.pulled) {
    console.log(`  Bootstrap   pulled from TiDB: ${bootstrap.tables.join(', ')}`);
  } else if (bootstrap.reason === 'failed') {
    console.log(`  Bootstrap   SKIPPED (${bootstrap.error})`);
    console.log('              Connect to the internet once for the first run.');
  } else {
    console.log('  Bootstrap   already complete');
  }
  line();
  console.log('');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Set ADMIN_PORT in .env to another port.\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      // Take a final backup, then let sync settle before exiting.
      const finalBackup = backup.stop();
      if (finalBackup) console.log(`  backup   ${finalBackup.name} (shutdown)`);
      sync.stop().finally(() => process.exit(0));
    });
  });
}
