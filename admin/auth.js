/**
 * Owner authentication.
 *
 * Credentials are checked against the LOCAL database (scrypt hashes), so the
 * admin can log in with no internet. Sessions live in memory - fine for a
 * single-user local server.
 */

import express from 'express';
import { verifyPassword } from '../shared/passwords.js';

export function requireApiAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

export function requirePageAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.redirect('/login');
}

export function mountAuthRoutes(app, db) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL LIMIT 1')
      .get(username);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      role: user.role,
    };
    return res.json({ user: req.session.user });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ user: req.session.user });
  });

  // Used by the login page to explain the "first run needs internet" case.
  router.get('/status', (req, res) => {
    const row = db.prepare('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL').get();
    return res.json({
      hasOwner: Number(row?.n ?? 0) > 0,
      authenticated: Boolean(req.session?.user),
    });
  });

  app.use('/api/auth', router);
}
