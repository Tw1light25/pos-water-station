/**
 * Owner account.
 *
 * The admin can change the owner password from Settings. The change is written
 * to the local database and queued for sync, so it reaches TiDB like every
 * other write.
 */

import express from 'express';
import { hashPassword, verifyPassword } from '../../shared/passwords.js';
import { recordUpdate } from '../sync/outbox.js';

const MIN_LENGTH = 8;

export function mountAccountRoutes(api, db) {
  api.put('/account/password', (req, res) => {
    const sessionUser = req.session?.user;
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });

    const body = req.body ?? {};
    const current = String(body.current_password ?? '');
    const next = String(body.new_password ?? '');

    if (!current || !next) {
      return res.status(400).json({ error: 'Enter your current and new password.' });
    }
    if (next.length < MIN_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_LENGTH} characters.` });
    }
    if (next === current) {
      return res.status(400).json({ error: 'The new password must be different from the current one.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(sessionUser.id);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    if (!verifyPassword(current, user.password_hash)) {
      return res.status(400).json({ error: 'Your current password is incorrect.' });
    }

    const now = Date.now();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      hashPassword(next),
      now,
      user.id,
    );

    recordUpdate('users', db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));

    return res.json({ ok: true, changed_at: now });
  });
}
