#!/usr/bin/env node
/**
 * Proves that changing a product's price NEVER alters a past order.
 *
 * Order lines are financial history: the price is copied onto the line when the
 * order is taken and must stay there forever.
 *
 *   npm run test:history
 *
 * Requires the local admin to be running (npm run admin). Creates its own test
 * order, then deletes it and restores the product's original price.
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from '../shared/paths.js';

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const ADMIN = `http://127.0.0.1:${process.env.ADMIN_PORT || 3000}`;
const OWNER = process.env.OWNER_USERNAME || 'owner';
const PASSWORD = process.argv[2] || process.env.OWNER_PASSWORD || '';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    fail += 1;
    console.log(`  \u2717 ${label}${detail ? `  (${detail})` : ''}  <-- FAILED`);
  }
};
const peso = (cents) => `\u20B1${(Number(cents) / 100).toFixed(2)}`;
const line = (char = '-') => console.log(char.repeat(62));

let cookie = '';
async function api(url, options = {}) {
  const res = await fetch(ADMIN + url, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, json: await res.json().catch(() => null) };
}

line();
console.log('  Price history check');
line();

if (!PASSWORD) {
  console.log('\n  Pass the owner password:  npm run test:history -- <password>\n');
  process.exit(1);
}

const login = await api('/api/auth/login', { method: 'POST', body: { username: OWNER, password: PASSWORD } });
if (login.status !== 200) {
  console.log(`\n  Could not sign in as "${OWNER}" (status ${login.status}).\n`);
  process.exit(1);
}

const products = (await api('/api/products')).json?.products ?? [];
const product = products[0];
if (!product) {
  console.log('\n  No products found to test with.\n');
  process.exit(1);
}

const ORIGINAL_PRICE = Number(product.price_cents);
const NEW_PRICE = ORIGINAL_PRICE + 500; // +₱5.00
const QTY = 2;
console.log(`\n  Product: ${product.name}  (currently ${peso(ORIGINAL_PRICE)})`);

let orderId = null;

async function cleanup() {
  try {
    if (orderId) await api(`/api/orders/${orderId}`, { method: 'DELETE' });
    await api(`/api/products/${product.id}`, { method: 'PUT', body: { price_cents: ORIGINAL_PRICE } });
  } catch {
    /* best effort */
  }
}

try {
  console.log('\n1. Take an order at the current price');
  const created = await api('/api/orders', {
    method: 'POST',
    body: { order_type: 'walkin', items: [{ product_id: product.id, qty: QTY }] },
  });
  orderId = created.json?.order?.id ?? null;
  check('order created', Boolean(orderId), created.json?.order?.code ?? '');
  const originalTotal = Number(created.json.order.total_cents);
  check('priced at the catalogue price', originalTotal === ORIGINAL_PRICE * QTY, peso(originalTotal));

  console.log('\n2. Change the product price');
  const raised = await api(`/api/products/${product.id}`, { method: 'PUT', body: { price_cents: NEW_PRICE } });
  check('price changed', Number(raised.json?.product?.price_cents) === NEW_PRICE, peso(NEW_PRICE));

  console.log('\n3. The existing order must NOT move');
  const afterPriceChange = (await api(`/api/orders/${orderId}`)).json;
  check('line price unchanged', Number(afterPriceChange.items[0].unit_price_cents) === ORIGINAL_PRICE, peso(afterPriceChange.items[0].unit_price_cents));
  check('line total unchanged', Number(afterPriceChange.items[0].line_total_cents) === ORIGINAL_PRICE * QTY, peso(afterPriceChange.items[0].line_total_cents));
  check('order total unchanged', Number(afterPriceChange.order.total_cents) === originalTotal, peso(afterPriceChange.order.total_cents));

  console.log('\n4. Recalculating it (payment + status) must not re-price it');
  await api(`/api/orders/${orderId}/payments`, { method: 'POST', body: { tendered_cents: originalTotal } });
  await api(`/api/orders/${orderId}`, { method: 'PUT', body: { fulfillment_status: 'completed' } });
  const afterRecalc = (await api(`/api/orders/${orderId}`)).json;
  check('line price still the sold price', Number(afterRecalc.items[0].unit_price_cents) === ORIGINAL_PRICE, peso(afterRecalc.items[0].unit_price_cents));
  check('total still the sold total', Number(afterRecalc.order.total_cents) === originalTotal, peso(afterRecalc.order.total_cents));
  check('payment status recorded', afterRecalc.order.payment_status === 'paid', afterRecalc.order.payment_status);

  console.log('\n5. Replacing the items keeps the sold price');
  const replaced = await api(`/api/orders/${orderId}`, {
    method: 'PUT',
    body: { items: [{ product_id: product.id, qty: QTY + 1 }] },
  });
  check('still the sold price, not the new one', Number(replaced.json.items[0].unit_price_cents) === ORIGINAL_PRICE, peso(replaced.json.items[0].unit_price_cents));
  check('quantity did change', Number(replaced.json.items[0].qty) === QTY + 1);

  console.log('\n6. A NEW order does use the new price');
  const fresh = await api('/api/orders', {
    method: 'POST',
    body: { order_type: 'walkin', items: [{ product_id: product.id, qty: 1 }] },
  });
  check('new order priced at the new price', Number(fresh.json?.order?.total_cents) === NEW_PRICE, peso(fresh.json?.order?.total_cents ?? 0));
  if (fresh.json?.order?.id) await api(`/api/orders/${fresh.json.order.id}`, { method: 'DELETE' });
} finally {
  console.log('\n7. Clean up');
  await cleanup();
  const products2 = (await api('/api/products')).json?.products ?? [];
  const restored = products2.find((p) => p.id === product.id);
  check('original price restored', Number(restored?.price_cents) === ORIGINAL_PRICE, peso(restored?.price_cents ?? 0));
  const stillThere = (await api('/api/orders')).json?.orders?.some((o) => o.id === orderId);
  check('test order removed', !stillThere);
}

line();
console.log(failures(fail));
line();
console.log('');

function failures(count) {
  return count === 0
    ? `  All good - ${pass} checks passed. Past prices are safe.`
    : `  ${count} check(s) FAILED - past prices could be changing.`;
}

process.exit(fail === 0 ? 0 : 1);
