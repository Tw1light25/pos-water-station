/**
 * Update routes. Mounted behind requireApiAuth with every other API route.
 *
 * GET  /update/check  - is there a newer release? (cached briefly)
 * POST /update/apply  - download and stage it, then ask the process to exit
 *
 * The actual file swap happens in the launcher (see Start POS.bat), because a
 * running Node process cannot safely replace the files it is executing.
 */

import {
  EXIT_UPDATE,
  check,
  cachedCheck,
  stageLatest,
  isApplying,
  stagedUpdate,
} from '../update.js';

const CACHE_MS = 60_000;

export function mountUpdateRoutes(api) {
  api.get('/update/check', async (req, res) => {
    const force = req.query.force === '1';
    const cached = cachedCheck();
    if (!force && cached && Date.now() - cached.checkedAt < CACHE_MS) {
      return res.json({ update: { ...cached, readyToRestart: Boolean(stagedUpdate()) } });
    }
    const result = await check();
    return res.json({ update: result });
  });

  /**
   * Acknowledge a finished update ("got it") and, on success, let the launcher
   * take over. `restart:false` stages without exiting, which is what the
   * manual fallback path ("close and reopen the POS") needs.
   */
  api.post('/update/apply', async (req, res) => {
    if (isApplying()) return res.status(409).json({ error: 'An update is already in progress.' });

    const result = await stageLatest();
    if (!result.ok) return res.status(400).json({ error: result.error });

    res.json({ ok: true, version: result.version, restarting: true });

    // Give the response a moment to flush before the process goes down.
    setTimeout(() => {
      console.log(`\n  update   staged v${result.version}; restarting to install...\n`);
      process.exit(EXIT_UPDATE);
    }, 750).unref();
  });
}
