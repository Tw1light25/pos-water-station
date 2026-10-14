/**
 * Single source of truth for the database schema.
 *
 * Columns use abstract types (see `dialects.js`) so the exact same definition
 * can be rendered for TiDB/MySQL (the cloud hub) and SQLite (the local shop PC
 * database). Keeping one definition means the two sides can never drift.
 *
 * Conventions
 * -----------
 *  - `id`            ULID, CHAR(26)/TEXT - client generated so offline devices
 *                    can create rows without collisions.
 *  - timestamps      BIGINT Unix epoch milliseconds (UTC), so ordering and
 *                    last-write-wins comparisons are trivial and timezone free.
 *  - deletes         soft: `deleted_at` NULL means the row is live. Soft deletes
 *                    propagate through sync instead of vanishing.
 *  - money           integer centavos in `*_cents` columns (never floats).
 */

const id = () => ({ name: 'id', type: 'id' });

const audit = () => [
  { name: 'created_at', type: 'bigint' },
  { name: 'updated_at', type: 'bigint' },
  { name: 'deleted_at', type: 'bigint', nullable: true },
];

export const TABLE_DEFS = [
  // ---------------------------------------------------------------- accounts
  {
    name: 'users',
    columns: [
      id(),
      { name: 'username', type: 'string', length: 64, unique: true },
      { name: 'password_hash', type: 'string', length: 255 },
      { name: 'display_name', type: 'string', length: 120, nullable: true },
      { name: 'role', type: 'string', length: 20, default: 'owner' },
      ...audit(),
    ],
  },

  // ------------------------------------------------------ store configuration
  {
    name: 'settings',
    columns: [
      id(),
      { name: 'business_name', type: 'string', length: 160, default: 'Water Station' },
      { name: 'logo_url', type: 'string', length: 500, nullable: true },
      { name: 'tagline', type: 'string', length: 300, nullable: true },
      { name: 'description', type: 'text', nullable: true },
      { name: 'address', type: 'string', length: 300, nullable: true },
      { name: 'phone', type: 'string', length: 40, nullable: true },
      { name: 'facebook', type: 'string', length: 300, nullable: true },
      { name: 'email', type: 'string', length: 160, nullable: true },
      { name: 'currency', type: 'string', length: 8, default: 'PHP' },
      { name: 'delivery_fee_cents', type: 'int', default: 0 },
      { name: 'receipt_footer', type: 'string', length: 300, nullable: true },
      // Store status: 'auto' follows operating hours, or force open/closed.
      { name: 'store_override', type: 'string', length: 20, default: 'auto' },
      { name: 'closed_message', type: 'string', length: 300, nullable: true },
      { name: 'timezone', type: 'string', length: 64, default: 'Asia/Manila' },
      { name: 'hours_json', type: 'json', nullable: true },
      ...audit(),
    ],
  },

  // ------------------------------------------------------------- catalogue
  {
    name: 'products',
    columns: [
      id(),
      { name: 'name', type: 'string', length: 160 },
      { name: 'unit', type: 'string', length: 40, default: 'pc' },
      { name: 'category', type: 'string', length: 60, nullable: true },
      { name: 'price_cents', type: 'int', default: 0 },
      { name: 'reorder_level', type: 'int', default: 0 },
      { name: 'active', type: 'bool', default: 1 },
      // Refills are a service, not stock. Products with this off are never
      // counted, never run out, and get no stock ledger rows.
      { name: 'track_stock', type: 'bool', default: 1 },
      ...audit(),
    ],
    indexes: [{ name: 'idx_products_active', columns: ['active'] }],
  },

  // ------------------------------------------------- category pick lists
  // Two independent lists share one table, separated by `kind`:
  //   kind = 'product'  -> the catalogue (Refill, Container, ...)
  //   kind = 'expense'  -> business expenses (maintenance, rent, ...)
  {
    name: 'categories',
    columns: [
      id(),
      { name: 'kind', type: 'string', length: 20, default: 'product' },
      { name: 'name', type: 'string', length: 60 },
      { name: 'sort_order', type: 'int', default: 0 },
      ...audit(),
    ],
    indexes: [
      { name: 'uk_categories_kind_name', columns: ['kind', 'name'], unique: true },
      { name: 'idx_categories_kind', columns: ['kind'] },
    ],
  },

  // ------------------------------------------- stock ledger (append-only)
  // On-hand stock is SUM(change_qty) per product. Additive rows merge cleanly
  // across offline devices, so the number can never drift out of sync.
  {
    name: 'inventory_logs',
    columns: [
      id(),
      { name: 'product_id', type: 'id' },
      { name: 'change_qty', type: 'int' },
      { name: 'reason', type: 'string', length: 40, default: 'adjustment' },
      { name: 'reference', type: 'string', length: 60, nullable: true },
      { name: 'note', type: 'string', length: 300, nullable: true },
      ...audit(),
    ],
    indexes: [
      { name: 'idx_invlogs_product', columns: ['product_id'] },
      { name: 'idx_invlogs_created', columns: ['created_at'] },
    ],
  },

  // ------------------------------------------------------------- customers
  {
    name: 'customers',
    columns: [
      id(),
      { name: 'name', type: 'string', length: 160 },
      { name: 'phone', type: 'string', length: 40, nullable: true },
      { name: 'address', type: 'string', length: 300, nullable: true },
      { name: 'facebook', type: 'string', length: 300, nullable: true },
      { name: 'notes', type: 'text', nullable: true },
      ...audit(),
    ],
    indexes: [{ name: 'idx_customers_phone', columns: ['phone'] }],
  },

  // ---------------------------------------------------------------- orders
  {
    name: 'orders',
    columns: [
      id(),
      { name: 'customer_id', type: 'id', nullable: true },
      { name: 'customer_name', type: 'string', length: 160, nullable: true },
      { name: 'customer_phone', type: 'string', length: 40, nullable: true },
      // 'walkin' | 'delivery'
      { name: 'order_type', type: 'string', length: 20, default: 'walkin' },
      // 'admin' | 'customer'
      { name: 'source', type: 'string', length: 20, default: 'admin' },
      { name: 'is_preorder', type: 'bool', default: 0 },
      // pending | out_for_delivery | delivered | completed | cancelled
      { name: 'fulfillment_status', type: 'string', length: 30, default: 'pending' },
      // unpaid | partial | paid
      { name: 'payment_status', type: 'string', length: 20, default: 'unpaid' },
      { name: 'subtotal_cents', type: 'int', default: 0 },
      // Discount taken off the goods (never off the delivery fee).
      { name: 'discount_cents', type: 'int', default: 0 },
      // Display only, so a receipt can say "20% off". 0 when a flat amount was used.
      { name: 'discount_percent', type: 'int', default: 0 },
      // e.g. Senior citizen, PWD, Loyalty
      { name: 'discount_reason', type: 'string', length: 60, nullable: true },
      { name: 'delivery_fee_cents', type: 'int', default: 0 },
      { name: 'total_cents', type: 'int', default: 0 },
      { name: 'amount_paid_cents', type: 'int', default: 0 },
      { name: 'due_date', type: 'bigint', nullable: true },
      { name: 'address', type: 'string', length: 300, nullable: true },
      { name: 'note', type: 'string', length: 500, nullable: true },
      { name: 'placed_at', type: 'bigint' },
      { name: 'delivered_at', type: 'bigint', nullable: true },
      ...audit(),
    ],
    indexes: [
      { name: 'idx_orders_placed', columns: ['placed_at'] },
      { name: 'idx_orders_fulfillment', columns: ['fulfillment_status'] },
      { name: 'idx_orders_payment', columns: ['payment_status'] },
      { name: 'idx_orders_phone', columns: ['customer_phone'] },
    ],
  },

  // ----------------------------------------------------------- order lines
  {
    name: 'order_items',
    columns: [
      id(),
      { name: 'order_id', type: 'id' },
      { name: 'product_id', type: 'id', nullable: true },
      { name: 'product_name', type: 'string', length: 160 },
      { name: 'unit', type: 'string', length: 40, nullable: true },
      { name: 'qty', type: 'int', default: 1 },
      { name: 'unit_price_cents', type: 'int', default: 0 },
      { name: 'line_total_cents', type: 'int', default: 0 },
      ...audit(),
    ],
    indexes: [{ name: 'idx_items_order', columns: ['order_id'] }],
  },

  // -------------------------------------------------------------- payments
  {
    name: 'payments',
    columns: [
      id(),
      { name: 'order_id', type: 'id' },
      { name: 'amount_cents', type: 'int', default: 0 },
      // Cash the customer actually handed over (>= amount_cents). Difference is change.
      { name: 'tendered_cents', type: 'int', default: 0 },
      { name: 'method', type: 'string', length: 30, default: 'cash' },
      { name: 'paid_at', type: 'bigint' },
      { name: 'note', type: 'string', length: 200, nullable: true },
      ...audit(),
    ],
    indexes: [
      { name: 'idx_payments_order', columns: ['order_id'] },
      { name: 'idx_payments_paid', columns: ['paid_at'] },
    ],
  },

  // -------------------------------------------------------------- expenses
  {
    name: 'expenses',
    columns: [
      id(),
      { name: 'description', type: 'string', length: 300 },
      { name: 'amount_cents', type: 'int', default: 0 },
      { name: 'category', type: 'string', length: 60, default: 'general' },
      { name: 'spent_at', type: 'bigint' },
      { name: 'note', type: 'string', length: 300, nullable: true },
      ...audit(),
    ],
    indexes: [{ name: 'idx_expenses_spent', columns: ['spent_at'] }],
  },
];

export const TABLE_BY_NAME = Object.fromEntries(TABLE_DEFS.map((t) => [t.name, t]));
export const TABLE_NAMES = TABLE_DEFS.map((t) => t.name);
