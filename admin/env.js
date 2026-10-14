/**
 * Loads .env from the project root before anything else reads process.env.
 * Imported first by server.js so configuration is ready for every other module.
 *
 * Paths are resolved from the project folder, never the current directory, so
 * the app works no matter where it is launched from.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from '../shared/paths.js';

const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));

export { PROJECT_ROOT };
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const PUBLIC_DIR = path.join(ADMIN_DIR, 'public');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
