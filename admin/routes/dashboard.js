/**
 * Dashboard aggregates.
 *
 * Revenue is money actually collected (the payments table); outgoing money is
 * the expenses table. Rows are bucketed in JavaScript using the shop's timezone
 * so the daily / weekly / monthly graphs line up with the local calendar.
 */

import express from 'express';
import {
  bucketSeries,
  dayKey,
  lastDayKeys,
  lastMonthKeys,
  lastWeekKeys,
  monthKey,
  shortDayLabel,
  shortMonthLabel,
  weekKey,
} from '../../shared/time-buckets.js';

const MS_DAY = 86_400_000;
const ON_HAND =
  'COALESCE((SELECT SUM(l.change_qty) FROM inventory_logs l ' +
  'WHERE l.product_id = p.id AND l.deleted_at IS NULL), 0)';

export function mountDashboardRoutes(api, db) {
  api.get('/dashboard', (req, res) => {
    const settings = db
      .prepare('SELECT timezone FROM settings WHERE deleted_at IS NULL LIMIT 1')
      .get();
    const timezone = settings?.timezone || 'Asia/Manila';
    const now = Date.now();
    const cutoff = now - 400 * MS_DAY;

    const payments = db
      .prepare('SELECT amount_cents, paid_at FROM payments WHERE deleted_at IS NULL AND paid_at >= ?')
      .all(cutoff);
    const expenses = db
      .prepare('SELECT amount_cents, spent_at FROM expenses WHERE deleted_at IS NULL AND spent_at >= ?')
      .all(cutoff);
    const orders = db
      .prepare(
        'SELECT total_cents, amount_paid_cents, payment_status, fulfillment_status FROM orders WHERE deleted_at IS NULL',
      )
      .all();

    const dayKeys = lastDayKeys(14, timezone, now);
    const weekKeys = lastWeekKeys(12, timezone, now);
    const monthKeys = lastMonthKeys(12, timezone, now);

    const daily = bucketSeries(payments, {
      keys: dayKeys,
      keyOf: (row) => dayKey(row.paid_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const weekly = bucketSeries(payments, {
      keys: weekKeys,
      keyOf: (row) => weekKey(row.paid_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const monthly = bucketSeries(payments, {
      keys: monthKeys,
      keyOf: (row) => monthKey(row.paid_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const outgoing = bucketSeries(expenses, {
      keys: monthKeys,
      keyOf: (row) => monthKey(row.spent_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });

    const todayKey = dayKey(now, timezone);
    const thisMonth = monthKey(now, timezone);
    const sum = (list) => list.reduce((total, value) => total + value, 0);

    const salesToday = sum(
      payments.filter((p) => dayKey(p.paid_at, timezone) === todayKey).map((p) => Number(p.amount_cents) || 0),
    );
    const salesMonth = sum(
      payments.filter((p) => monthKey(p.paid_at, timezone) === thisMonth).map((p) => Number(p.amount_cents) || 0),
    );
    const outgoingThisMonth = sum(
      expenses
        .filter((e) => monthKey(e.spent_at, timezone) === thisMonth)
        .map((e) => Number(e.amount_cents) || 0),
    );
    const outstanding = sum(
      orders
        .filter((o) => o.payment_status !== 'paid')
        .map((o) => Math.max(0, Number(o.total_cents) - Number(o.amount_paid_cents))),
    );
    const pendingOrders = orders.filter((o) =>
      ['pending', 'out_for_delivery'].includes(o.fulfillment_status),
    ).length;

    const lowStockItems = db
      .prepare(
        `SELECT p.id, p.name, p.unit, p.reorder_level, ${ON_HAND} AS on_hand
         FROM products p
         WHERE p.deleted_at IS NULL AND p.active = 1 AND p.reorder_level > 0
           AND ${ON_HAND} <= p.reorder_level
         ORDER BY on_hand ASC LIMIT 8`,
      )
      .all();

    res.json({
      timezone,
      kpis: {
        sales_today_cents: salesToday,
        sales_month_cents: salesMonth,
        outgoing_month_cents: outgoingThisMonth,
        outstanding_cents: outstanding,
        pending_orders: pendingOrders,
        low_stock: lowStockItems.length,
      },
      daily: { labels: dayKeys.map(shortDayLabel), values: daily, total_cents: sum(daily) },
      weekly: { labels: weekKeys.map(shortDayLabel), values: weekly, total_cents: sum(weekly) },
      monthly: { labels: monthKeys.map(shortMonthLabel), values: monthly, total_cents: sum(monthly) },
      outgoing: { labels: monthKeys.map(shortMonthLabel), values: outgoing, total_cents: sum(outgoing) },
      low_stock_items: lowStockItems,
    });
  });
}
