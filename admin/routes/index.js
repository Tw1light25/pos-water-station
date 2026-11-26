/**
 * API routes. Everything mounted here sits behind requireApiAuth.
 *
 * Views are added one per step (settings, dashboard, products, ...).
 */

import express from 'express';
import { requireApiAuth } from '../auth.js';
import { mountSettingsRoutes } from './settings.js';
import { mountProductRoutes } from './products.js';
import { mountInventoryRoutes } from './inventory.js';
import { mountExpenseRoutes } from './expenses.js';
import { mountCustomerRoutes } from './customers.js';
import { mountOrderRoutes } from './orders.js';
import { mountDashboardRoutes } from './dashboard.js';
import { mountAccountRoutes } from './account.js';
import { mountBackupRoutes } from './backup.js';
import { mountCategoryRoutes } from './categories.js';
import { mountUpdateRoutes } from './update.js';

export function mountApi(app, db, sync, backup) {
  const api = express.Router();
  api.use(requireApiAuth);

  api.get('/health', (req, res) => {
    const status = sync?.getStatus() ?? {};
    res.json({
      ok: true,
      user: req.session.user,
      time: Date.now(),
      pending: status.pending ?? 0,
      online: status.online ?? true,
    });
  });

  api.get('/sync', (req, res) => {
    res.json({ sync: sync?.getStatus() ?? null });
  });

  api.post('/sync/now', async (req, res) => {
    if (!sync) return res.status(503).json({ error: 'Sync service unavailable.' });
    const result = await sync.syncNow();
    return res.json({ result, sync: sync.getStatus() });
  });

  mountSettingsRoutes(api, db);
  mountProductRoutes(api, db);
  mountInventoryRoutes(api, db);
  mountExpenseRoutes(api, db);
  mountCustomerRoutes(api, db);
  mountOrderRoutes(api, db);
  mountDashboardRoutes(api, db);
  mountAccountRoutes(api, db);
  if (backup) mountBackupRoutes(api, backup);
  mountCategoryRoutes(api, db);
  mountUpdateRoutes(api);

  app.use('/api', api);
}
