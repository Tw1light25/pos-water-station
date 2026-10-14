/* GENERATED FILE - do not edit.
 * Copied from /shared/ by scripts/prepare-site.js so the browser, the admin
 * and the Netlify functions all run identical code.
 * Edit the original in /shared/ instead.
 */

/**
 * ULID generator.
 *
 * ULIDs are lexicographically sortable, URL safe, and 26 characters long:
 *
 *    01JB3ZK9WQ4M8YQ2V7N6T5R1XS
 *    |--------|--------------|
 *    48-bit ms    80-bit random
 *
 * We use them as primary keys everywhere so that a device which is offline can
 * create a row (an order, a payment, a stock move) and it will never collide
 * with anything created on another device. That is what makes the offline queue
 * idempotent: sending the same record twice just upserts the same id.
 *
 * No dependency needed - this is a small, dependency-free implementation that
 * runs in Node and in the browser alike (Web Crypto is available in both).
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = -1;
let lastRandom = '';

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function encodeTime(time, length) {
  let remaining = time;
  let out = '';
  for (let i = length - 1; i >= 0; i -= 1) {
    const mod = remaining % ENCODING_LEN;
    out = ENCODING[mod] + out;
    remaining = (remaining - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(length) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ENCODING[bytes[i] % ENCODING_LEN];
  }
  return out;
}

/** Increment the random part by one so ids stay monotonic within a millisecond. */
function incrementRandom(value) {
  const chars = value.split('');
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const index = ENCODING.indexOf(chars[i]);
    if (index === ENCODING_LEN - 1) {
      chars[i] = ENCODING[0];
    } else {
      chars[i] = ENCODING[index + 1];
      return chars.join('');
    }
  }
  return encodeRandom(RANDOM_LEN); // overflowed: extremely unlikely
}

/** Generate a new ULID. Pass a timestamp (epoch ms) to force one - used in tests. */
export function ulid(now = Date.now()) {
  if (now === lastTime && lastRandom) {
    lastRandom = incrementRandom(lastRandom);
  } else {
    lastTime = now;
    lastRandom = encodeRandom(RANDOM_LEN);
  }
  return encodeTime(now, TIME_LEN) + lastRandom;
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value) {
  return typeof value === 'string' && ULID_RE.test(value);
}

/** Extract the creation time (epoch ms) encoded in a ULID. */
export function ulidTime(value) {
  if (!isUlid(value)) return null;
  let time = 0;
  for (const char of value.slice(0, TIME_LEN)) {
    time = time * ENCODING_LEN + ENCODING.indexOf(char);
  }
  return time;
}

export default ulid;
