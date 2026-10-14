/**
 * Password hashing using Node's built-in scrypt.
 *
 * scrypt ships with Node, so there is no native module to compile - which
 * keeps installation painless on Windows and macOS shop PCs alike.
 *
 * Format: scrypt$<salt-hex>$<hash-hex>
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const hash = scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  let expected;
  try {
    expected = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  const actual = scryptSync(String(password), salt, KEY_LENGTH);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Readable random password for the first-run owner account. */
export function generatePassword(length = 14) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
