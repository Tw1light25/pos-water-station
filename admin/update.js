/**
 * Self-update service.
 *
 * The GitHub repo is the "package repository": a tagged release is a version
 * the admin can install. The owner tags on GitHub; each client sees a red dot
 * in Settings and clicks "Update now" when it suits the shop.
 *
 * This module only *stages* an update. A running Node process cannot safely
 * overwrite the files it is executing, so the final swap happens in the
 * launcher (Start POS.bat) after this process exits with EXIT_UPDATE.
 *
 * What an update never touches: .env, data/, hide/, backups/, certs/,
 * node_modules/. Those hold the client's credentials and their live sales.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PROJECT_ROOT, DATA_DIR } from './env.js';
import { pendingCount } from './sync/outbox.js';

/** The server exits with this code when an update is staged and ready. */
export const EXIT_UPDATE = 75;

const REPO = 'Tw1light25/pos-water-station';
const API = `https://api.github.com/repos/${REPO}`;

/** Where the launcher looks for a downloaded, waiting-to-be-installed update. */
export const STAGING_DIR = path.join(DATA_DIR, 'update-staging');
export const STAGED_INFO = path.join(STAGING_DIR, 'update-info.json');
const STATE_PATH = path.join(DATA_DIR, 'update-state.json');

/** Folders and files an update must never overwrite. */
export const PROTECTED = ['.env', 'data', 'hide', 'backups', 'certs', 'node_modules', '.git'];

/** Read the local version from package.json. */
export function currentVersion() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')).version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

/** "v1.2.3" or "1.2.3" -> [1,2,3]; unparseable -> [0,0,0]. */
export function parseVersion(tag) {
  const match = String(tag ?? '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
}

/** Compare two version strings: >0 when a is newer than b. */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Is an update already downloaded and waiting for a restart?
 * Returns its info, or null.
 */
export function stagedUpdate() {
  try {
    return JSON.parse(fs.readFileSync(STAGED_INFO, 'utf8'));
  } catch {
    return null;
  }
}

let lastCheck = null;

/**
 * Last applied release, so the Settings card can say "updated to v1.2.0" once
 * even after a restart. Cleared by a fresh successful check at that version.
 */
export function lastResult() {
  return readState();
}

function releaseBody(release) {
  const version = String(release.tag_name ?? '').replace(/^v/i, '');
  const info = stagedUpdate();
  return {
    current: currentVersion(),
    latest: version,
    updateAvailable: compareVersions(version, currentVersion()) > 0,
    readyToRestart: Boolean(info && compareVersions(info.version, currentVersion()) > 0),
    publishedAt: release.published_at ? Date.parse(release.published_at) : null,
    notes: String(release.body ?? '').trim().slice(0, 4000),
    url: release.html_url ?? null,
    pending: pendingCount(),
    checkedAt: Date.now(),
    last: lastResult(),
  };
}

/**
 * Ask GitHub for the newest published release.
 * Never throws for "no network": returns a quiet, non-blocking error shape.
 */
export async function check({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'Accept-Encoding': 'identity',
        'User-Agent': `WaterStationPOS/${currentVersion()}`,
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      lastCheck = { current: currentVersion(), latest: null, updateAvailable: false, noRelease: true, pending: pendingCount(), checkedAt: Date.now() };
      return lastCheck;
    }
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const release = await response.json();
    if (release.draft || release.prerelease) {
      lastCheck = { current: currentVersion(), latest: null, updateAvailable: false, noRelease: true, pending: pendingCount(), checkedAt: Date.now() };
      return lastCheck;
    }

    lastCheck = releaseBody(release);
    return lastCheck;
  } catch (error) {
    lastCheck = {
      current: currentVersion(),
      latest: null,
      updateAvailable: false,
      error: controller.signal.aborted ? 'Update check timed out.' : error.message,
      pending: pendingCount(),
      checkedAt: Date.now(),
    };
    return lastCheck;
  } finally {
    clearTimeout(timer);
  }
}

export function cachedCheck() {
  return lastCheck;
}

/** Recursively copy src into dest, skipping protected top-level names. */
function copyTree(src, dest, relative = '') {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (!relative && PROTECTED.includes(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, rel);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyTree(from, dest, rel);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

let applying = false;

export function isApplying() {
  return applying;
}

/**
 * Download the latest release and stage it for the launcher to install.
 * Returns { ok, version, restarting } or { ok:false, error }.
 * The caller is responsible for exiting with EXIT_UPDATE afterwards.
 */
export async function stageLatest({ onProgress = () => {} } = {}) {
  if (applying) return { ok: false, error: 'An update is already being prepared.' };
  applying = true;
  try {
    const info = lastCheck ?? (await check());
    if (!info.updateAvailable || !info.latest) {
      return { ok: false, error: 'You are already running the latest version.' };
    }

    // Start clean so a previously failed attempt cannot be picked up.
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
    fs.mkdirSync(STAGING_DIR, { recursive: true });

    onProgress({ step: 'download', message: `Downloading ${info.latest}...` });
    const url = `${API}/tarball/v${info.latest.replace(/^v/i, '')}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    let buffer;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `WaterStationPOS/${info.current}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      buffer = Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }

    onProgress({ step: 'extract', message: 'Extracting...' });
    const tarPath = path.join(STAGING_DIR, 'release.tar.gz');
    fs.writeFileSync(tarPath, buffer);
    const extractDir = path.join(STAGING_DIR, 'release');
    fs.mkdirSync(extractDir, { recursive: true });
    extractTarGz(tarPath, extractDir);

    // GitHub tarballs wrap everything in one folder (owner-repo-sha/).
    const [rootEntry] = fs.readdirSync(extractDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    if (!rootEntry) throw new Error('The release archive was empty.');
    const source = path.join(extractDir, rootEntry.name);

    // Never install a release whose package.json disagrees with its tag.
    const shipped = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
    if (compareVersions(shipped.version, info.latest) !== 0) {
      throw new Error(`Release ${info.latest} contains version ${shipped.version}; refusing to install.`);
    }

    onProgress({ step: 'stage', message: 'Preparing files...' });
    const payloadDir = path.join(STAGING_DIR, 'payload');
    fs.mkdirSync(payloadDir, { recursive: true });
    copyTree(source, payloadDir);

    // The launcher reads this and swaps payload/ into place.
    const record = {
      version: info.latest,
      from: info.current,
      stagedAt: Date.now(),
      payload: payloadDir,
      notes: info.notes,
    };
    fs.writeFileSync(STAGED_INFO, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    fs.rmSync(tarPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });

    writeState({ ...record, status: 'staged' });
    onProgress({ step: 'done', message: `Version ${info.latest} is ready. Restarting...` });

    return { ok: true, version: info.latest, restarting: true };
  } catch (error) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
    writeState({ status: 'failed', error: error.message, at: Date.now() });
    return { ok: false, error: error.message };
  } finally {
    applying = false;
  }
}

/**
 * Minimal tar.gz extractor (ustar + gzip) so the admin needs no extra package.
 * Only regular files and directories are extracted; anything else is skipped.
 */
export function extractTarGz(archivePath, destination) {
  const compressed = fs.readFileSync(archivePath);
  const tar = zlib.gunzipSync(compressed);
  const outRoot = path.resolve(destination);
  let offset = 0;
  let longName = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = readString(header, 0, 100);
    const mode = readOctal(header, 100, 8);
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = readString(header, 345, 155);
    const entryName = longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = null;

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (!entryName) continue;

    if (type === 'L') {
      // GNU long name: the data is the real name of the next entry.
      longName = tar.subarray(dataStart, dataEnd).toString('utf8').replace(/\0+$/g, '');
      continue;
    }
    if (type === 'x' || type === 'g') continue;

    const target = path.resolve(outRoot, entryName);
    // Zip-slip guard: never write outside the destination.
    if (target !== outRoot && !target.startsWith(outRoot + path.sep)) continue;

    if (type === '5') {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    if (type !== '0' && type !== '\0' && type !== '') continue;

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, tar.subarray(dataStart, dataEnd));

    // Keep the executable bit where the archive has one.
    if (mode & 0o111) {
      try {
        fs.chmodSync(target, mode & 0o777);
      } catch {
        /* Windows: not applicable */
      }
    }
  }
}

function readString(buffer, start, length) {
  const slice = buffer.subarray(start, start + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? slice.length : end).toString('utf8');
}

function readOctal(buffer, start, length) {
  const text = readString(buffer, start, length).trim();
  if (!text) return 0;
  const value = Number.parseInt(text, 8);
  return Number.isFinite(value) ? value : 0;
}

/** Clear a completed update record once the new version is confirmed running. */
export function acknowledgeApplied() {
  const state = readState();
  if (!state) return;
  if (state.status === 'installed' && compareVersions(state.version, currentVersion()) === 0) {
    writeState({ status: 'idle', version: state.version, at: Date.now() });
  }
}

/**
 * The staged update a just-finished restart was meant to install, or null.
 * Written by the launcher, consumed once here.
 */
export function previousInstall() {
  const marker = path.join(DATA_DIR, 'update-installing.json');
  try {
    const record = JSON.parse(fs.readFileSync(marker, 'utf8'));
    fs.rmSync(marker, { force: true });
    return record;
  } catch {
    return null;
  }
}

export function markInstalled(version) {
  writeState({ status: 'installed', version, at: Date.now() });
}
