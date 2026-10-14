/** Backup status and a manual "back up now". */

import express from 'express';
import { formatBytes } from '../backup.js';

export function mountBackupRoutes(api, backup) {
  api.get('/backup', (req, res) => {
    res.json({ backup: backup.getStatus() });
  });

  api.post('/backup/now', (req, res) => {
    const result = backup.runNow();
    if (!result) {
      const status = backup.getStatus();
      return res.status(500).json({ error: status.lastError || 'Backup could not be written.' });
    }
    return res.json({
      result: {
        name: result.name,
        path: result.path,
        size: result.size,
        sizeLabel: formatBytes(result.size),
        at: result.lastBackupAt,
        removed: result.removed,
      },
      backup: backup.getStatus(),
    });
  });
}
