/**
 * GET /api/settings
 *
 * The public slice of the store settings plus the live open/closed status.
 * Served with no-store so the landing page always reflects the owner's latest
 * change.
 */

import { query, parseJson } from '../lib/db.js';
import { fail, handler, json } from '../lib/http.js';
import { computeStoreStatus, describeStatus, normalizeHours } from '../../shared/store-status.js';

export const config = { path: '/api/settings' };

export default handler(async (request) => {
  if (request.method !== 'GET') return fail('Method not allowed', 405);

  const rows = await query(
    'SELECT * FROM settings WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1',
  );
  const row = rows[0];
  if (!row) return json({ settings: null, status: null });

  const hours = parseJson(row.hours_json, null);
  const status = computeStoreStatus({
    override: row.store_override,
    hours,
    timezone: row.timezone,
  });

  return json({
    settings: {
      business_name: row.business_name,
      logo_url: row.logo_url,
      tagline: row.tagline,
      description: row.description,
      address: row.address,
      phone: row.phone,
      facebook: row.facebook,
      email: row.email,
      currency: row.currency,
      delivery_fee_cents: row.delivery_fee_cents,
      closed_message: row.closed_message,
      timezone: row.timezone,
      hours_json: normalizeHours(hours),
      receipt_footer: row.receipt_footer,
    },
    status: {
      is_open: status.isOpen,
      label: describeStatus(status),
      reason: status.reason,
      server_time: Date.now(),
    },
  });
});
