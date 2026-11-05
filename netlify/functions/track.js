/**
 * POST /api/track
 *
 * Look up an order by the phone number it was placed with or by the
 * 6-character order code shown on the customer's confirmation. A single
 * `query` field accepts either: 7+ digits is treated as a phone number, while
 * exactly 6 alphanumeric characters is treated as an order code.
 *
 * A phone lookup returns the most recent order that is still in progress, or
 * the latest one if everything is finished. A code lookup returns that exact
 * order.
 *
 * Privacy: the response deliberately omits the delivery address and only
 * exposes what the customer needs to see. Lookups are rate limited per
 * connection.
 */

import { query } from '../lib/db.js';
import { fail, handler, json, readJson } from '../lib/http.js';

export const config = { path: '/api/track' };

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) ?? { count: 0, reset: now + 60_000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 60_000;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > 20;
}

const FINISHED = new Set(['delivered', 'completed', 'cancelled']);

const ORDER_COLUMNS =
  'id, fulfillment_status, payment_status, total_cents, amount_paid_cents, due_date, placed_at, ' +
  'order_type, is_preorder';

/**
 * Decide whether the raw input is a phone number or an order code.
 *
 * 6 all-digit characters are treated as a code, because phone numbers require
 * at least 7 digits. Anything with 7+ digits and no letters is a phone number.
 */
function detectLookup(raw) {
  const compact = raw.replace(/[\s#-]/g, '');
  const alnum = compact.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const digits = compact.replace(/\D/g, '');

  if (!/[A-Za-z]/.test(compact) && digits.length >= 7) {
    return { type: 'phone', value: digits };
  }
  if (alnum.length === 6) return { type: 'code', value: alnum };
  return null;
}

async function orderResponse(order, active) {
  const items = await query(
    'SELECT product_name, qty, line_total_cents FROM order_items WHERE order_id = ? AND deleted_at IS NULL',
    [order.id],
  );

  return {
    found: true,
    active,
    order: {
      code: String(order.id).slice(-6).toUpperCase(),
      fulfillment_status: order.fulfillment_status,
      payment_status: order.payment_status,
      total_cents: Number(order.total_cents),
      amount_paid_cents: Number(order.amount_paid_cents),
      due_date: order.due_date,
      placed_at: Number(order.placed_at),
      order_type: order.order_type,
      is_preorder: Boolean(order.is_preorder),
    },
    items: items.map((item) => ({
      name: item.product_name,
      qty: Number(item.qty),
      line_total_cents: Number(item.line_total_cents),
    })),
  };
}

export default handler(async (request) => {
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  const ip = request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (rateLimited(ip)) {
    return fail('Too many lookups. Please wait a minute and try again.', 429);
  }

  const body = await readJson(request);
  const raw = String(body.query ?? body.phone ?? body.code ?? '').trim();
  const lookup = detectLookup(raw);
  if (!lookup) {
    return fail('Enter a phone number or the 6-character order code.');
  }

  if (lookup.type === 'code') {
    const orders = await query(
      'SELECT ' +
        ORDER_COLUMNS +
        ' FROM orders WHERE UPPER(RIGHT(id, 6)) = ? AND deleted_at IS NULL ' +
        'ORDER BY placed_at DESC LIMIT 10',
      [lookup.value],
    );

    // A ULID suffix collision would make it unsafe to reveal either order.
    if (orders.length > 1) return json({ found: false, ambiguous: true });
    if (!orders.length) return json({ found: false });

    const order = orders[0];
    return json(await orderResponse(order, !FINISHED.has(order.fulfillment_status)));
  }

  const orders = await query(
    'SELECT ' +
      ORDER_COLUMNS +
      ' FROM orders ' +
      "WHERE REPLACE(REPLACE(customer_phone, ' ', ''), '-', '') = ? AND deleted_at IS NULL " +
      'ORDER BY placed_at DESC LIMIT 10',
    [lookup.value],
  );

  if (!orders.length) return json({ found: false });

  const active = orders.find((order) => !FINISHED.has(order.fulfillment_status));
  return json(await orderResponse(active ?? orders[0], Boolean(active)));
});
