/**
 * GET /api/products
 *
 * The public catalogue: active products only, with stock so the order form can
 * flag anything that has run out.
 */

import { query } from '../lib/db.js';
import { fail, handler, json } from '../lib/http.js';

export const config = { path: '/api/products' };

const SQL = `
  SELECT p.id, p.name, p.unit, p.category, p.price_cents, p.track_stock,
         COALESCE((SELECT SUM(l.change_qty) FROM inventory_logs l
                   WHERE l.product_id = p.id AND l.deleted_at IS NULL), 0) AS on_hand
  FROM products p
  WHERE p.deleted_at IS NULL AND p.active = 1
  ORDER BY p.category, p.name`;

export default handler(async (request) => {
  if (request.method !== 'GET') return fail('Method not allowed', 405);

  const rows = await query(SQL);
  return json({
    products: rows.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      category: row.category,
      price_cents: Number(row.price_cents),
      // Refills are a service: never out of stock, never quantity-capped.
      track_stock: Number(row.track_stock) === 1,
      on_hand: Number(row.on_hand ?? 0),
    })),
  });
});
