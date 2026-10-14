#!/usr/bin/env node
/**
 * Reset the owner password from the command line - the safety net for when
 * nobody can sign in to the admin.
 *
 *   npm run password                      prompts (hidden input) on a terminal,
 *                                         or generates one when piped
 *   npm run password -- --set NewPass123  sets it directly
 *   npm run password -- --user owner      picks a specific username
 *
 * It writes to the LOCAL database and queues the change for sync, so the new
 * password reaches TiDB the next time the admin runs.
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from '../shared/paths.js';
import { openLocalDatabase } from '../admin/db.js';
import { hashPassword, generatePassword } from '../shared/passwords.js';
import { recordUpdate } from '../admin/sync/outbox.js';

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const MIN_LENGTH = 8;

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1] ?? '';
};
const SET_PASSWORD = flag('set');
const USERNAME = flag('user');

const line = (char = '-') => console.log(char.repeat(62));

function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char) => {
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u0003') {
        stdout.write('\n');
        process.exit(1); // Ctrl+C
      }
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };

    stdin.on('data', onData);
  });
}

async function choosePassword() {
  if (SET_PASSWORD !== null) {
    if (SET_PASSWORD.length < MIN_LENGTH) {
      console.error(`That password is too short - use at least ${MIN_LENGTH} characters.`);
      process.exit(1);
    }
    return { password: SET_PASSWORD, generated: false };
  }

  // No terminal (for example piped from another script): generate one.
  if (!process.stdin.isTTY) {
    return { password: generatePassword(), generated: true };
  }

  const first = await askHidden(`New password (min ${MIN_LENGTH} characters): `);
  if (first.length < MIN_LENGTH) {
    console.error(`\nThat password is too short - use at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }

  const second = await askHidden('Type it again to confirm: ');
  if (first !== second) {
    console.error('\nThe passwords did not match. Nothing was changed.');
    process.exit(1);
  }

  return { password: first, generated: false };
}

async function main() {
  console.log('');
  line();
  console.log('  Water Station POS - reset owner password');
  line();

  let db;
  try {
    db = openLocalDatabase();
  } catch (error) {
    console.error(`  Could not open the local database: ${error.message}`);
    console.error('  Start the admin once (npm run admin) so it can be created, then try again.');
    process.exit(1);
  }

  const users = db
    .prepare('SELECT id, username, display_name FROM users WHERE deleted_at IS NULL ORDER BY created_at')
    .all();

  if (!users.length) {
    console.error('  No owner account exists on this PC yet.');
    console.error('  Start the admin once while online so it can download the account, then try again.');
    process.exit(1);
  }

  let user = users[0];
  if (USERNAME) {
    const match = users.find((candidate) => candidate.username === USERNAME);
    if (!match) {
      console.error(`  No account called "${USERNAME}".`);
      console.error(`  Available: ${users.map((candidate) => candidate.username).join(', ')}`);
      process.exit(1);
    }
    user = match;
  }

  console.log(`  Account: ${user.username}`);

  const { password, generated } = await choosePassword();
  const now = Date.now();

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(password),
    now,
    user.id,
  );

  recordUpdate('users', db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));

  line();
  console.log(`  Password changed for "${user.username}".`);
  if (generated) {
    console.log('');
    console.log('  NEW PASSWORD (write this down, it will not be shown again):');
    console.log(`      ${password}`);
  }
  console.log('');
  console.log('  Sign in at http://127.0.0.1:3000');
  console.log('  The next admin start pushes the change to TiDB.');
  console.log('');
}

main().catch((error) => {
  console.error(`\n  ${error?.message ?? error}\n`);
  process.exit(1);
});
