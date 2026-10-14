/**
 * POST /api/track
 *
 * Look up an order by the phone number it was placed with. Returns the most
 * recent order that is still in progress, or the latest one if everything is
 * finished.
 *
 * Privacy: a phone number is all that is needed, so the response deliberately
 * omits the delivery address and only exposes what the customer needs to see.
 * Lookups are rate limited per connection.
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

export default handler(async (request) => {
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  const ip = request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (rateLimited(ip)) {
    return fail('Too many lookups. Please wait a minute and try again.', 429);
  }

  const body = await readJson(request);
  const phone = String(body.phone ?? '').replace(/[\s-]/g, '');
  if (phone.replace(/\D/g, '').length < 7) {
    return fail('Enter the phone number you ordered with.');
  }

  const orders = await query(
    'SELECT id, fulfillment_status, payment_status, total_cents, amount_paid_cents, due_date, placed_at, ' +
      'order_type, is_preorder FROM orders ' +
      "WHERE REPLACE(REPLACE(customer_phone, ' ', ''), '-', '') = ? AND deleted_at IS NULL " +
      'ORDER BY placed_at DESC LIMIT 10',
    [phone],
  );

  if (!orders.length) return json({ found: false });

  const active = orders.find((order) => !FINISHED.has(order.fulfillment_status));
  const order = active ?? orders[0];

  const items = await query(
    'SELECT product_name, qty, line_total_cents FROM order_items WHERE order_id = ? AND deleted_at IS NULL',
    [order.id],
  );

  return json({
    found: true,
    active: Boolean(active),
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
  });
});
