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
  currentMonthDayKeys,
  currentWeekDayKeys,
  currentYearHalfMonthKeys,
  dayKey,
  halfMonthKey,
  hourOfDay,
  monthKey,
  shortDayLabel,
  shortHourLabel,
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
        'SELECT total_cents, amount_paid_cents, discount_cents, placed_at, payment_status, fulfillment_status ' +
          'FROM orders WHERE deleted_at IS NULL',
      )
      .all();

    const todayKey = dayKey(now, timezone);
    const thisMonth = monthKey(now, timezone);
    const hours = Array.from({ length: 24 }, (_, hour) => hour);
    const weekKeys = currentWeekDayKeys(timezone, now);
    const monthKeys = currentMonthDayKeys(timezone, now);
    const yearKeys = currentYearHalfMonthKeys(timezone, now);

    const daily = bucketSeries(
      payments.filter((payment) => dayKey(payment.paid_at, timezone) === todayKey),
      {
        keys: hours,
        keyOf: (row) => hourOfDay(row.paid_at, timezone),
        valueOf: (row) => Number(row.amount_cents) || 0,
      },
    );
    const weekly = bucketSeries(payments, {
      keys: weekKeys,
      keyOf: (row) => dayKey(row.paid_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const monthly = bucketSeries(payments, {
      keys: monthKeys,
      keyOf: (row) => dayKey(row.paid_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const outgoing = bucketSeries(expenses, {
      keys: monthKeys,
      keyOf: (row) => dayKey(row.spent_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const yearlySales = bucketSeries(payments, {
      keys: yearKeys,
      keyOf: (row) => halfMonthKey(row.paid_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });
    const yearlyOutgoing = bucketSeries(expenses, {
      keys: yearKeys,
      keyOf: (row) => halfMonthKey(row.spent_at, timezone),
      valueOf: (row) => Number(row.amount_cents) || 0,
    });

    const sum = (list) => list.reduce((total, value) => total + value, 0);

    const salesToday = sum(daily);
    const salesMonth = sum(monthly);
    const outgoingThisMonth = sum(outgoing);
    const outstanding = sum(
      orders
        .filter((o) => o.payment_status !== 'paid')
        .map((o) => Math.max(0, Number(o.total_cents) - Number(o.amount_paid_cents))),
    );
    const pendingOrders = orders.filter((o) =>
      ['pending', 'out_for_delivery'].includes(o.fulfillment_status),
    ).length;

    // How much the owner gave away this month.
    const discountsThisMonth = sum(
      orders
        .filter((o) => monthKey(Number(o.placed_at) || 0, timezone) === thisMonth)
        .map((o) => Number(o.discount_cents) || 0),
    );

    const lowStockItems = db
      .prepare(
        `SELECT p.id, p.name, p.unit, p.reorder_level, ${ON_HAND} AS on_hand
         FROM products p
         WHERE p.deleted_at IS NULL AND p.active = 1 AND p.track_stock = 1 AND p.reorder_level > 0
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
        discount_month_cents: discountsThisMonth,
        pending_orders: pendingOrders,
        low_stock: lowStockItems.length,
      },
      daily: { labels: hours.map(shortHourLabel), values: daily, total_cents: sum(daily) },
      weekly: { labels: weekKeys.map(shortDayLabel), values: weekly, total_cents: sum(weekly) },
      monthly: {
        labels: monthKeys.map(shortDayLabel),
        sales: monthly,
        outgoing,
        sales_total_cents: sum(monthly),
        outgoing_total_cents: sum(outgoing),
      },
      yearly: {
        labels: yearKeys.map(shortDayLabel),
        sales: yearlySales,
        outgoing: yearlyOutgoing,
        sales_total_cents: sum(yearlySales),
        outgoing_total_cents: sum(yearlyOutgoing),
      },
      low_stock_items: lowStockItems,
    });
  });
}
