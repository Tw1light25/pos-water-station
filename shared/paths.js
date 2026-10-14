/**
 * Project-root resolution.
 *
 * Anything that reads a path from .env resolves it against the project folder
 * (this file's parent) instead of the current working directory. That means the
 * whole folder can live anywhere on any machine - C:\POS, D:\Water Station, a
 * desktop shortcut - and every path still resolves.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARED_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SHARED_DIR, '..');

/** Absolute-ise a .env path (relative paths are resolved from the project root). */
export function fromProjectRoot(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(PROJECT_ROOT, value);
}
