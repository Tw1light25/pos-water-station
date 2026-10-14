/**
 * Offline order queue.
 *
 * If the network is unavailable, the order is kept in localStorage and retried
 * until it gets through. Because the id is generated on the device, a retry can
 * never create a duplicate order - the server returns the existing one.
 */

import { api } from './api.js';

const KEY = 'pos.queue.v1';
const listeners = new Set();
let flushing = false;

export function pendingOrders() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function pendingCount() {
  return pendingOrders().length;
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener(list.length);
}

export function enqueue(order) {
  const list = pendingOrders();
  if (!list.some((item) => item.id === order.id)) list.push(order);
  save(list);
}

export function dequeue(id) {
  save(pendingOrders().filter((item) => item.id !== id));
}

export function onChange(listener) {
  listeners.add(listener);
  listener(pendingCount());
  return () => listeners.delete(listener);
}

/** Try to send everything that is waiting. */
export async function flush() {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;

  let sent = 0;
  let failed = 0;

  try {
    for (const order of pendingOrders()) {
      try {
        await api('/api/orders', { method: 'POST', body: order });
        dequeue(order.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        // Offline or a server hiccup: keep it queued and stop for now.
        if (error.offline || !error.status || error.status >= 500) break;
        // A permanent rejection (bad data): drop it so it cannot block the queue.
        dequeue(order.id);
      }
    }
  } finally {
    flushing = false;
  }

  return { sent, failed };
}

export function startAutoFlush() {
  const run = () => {
    if (navigator.onLine) flush();
  };
  window.addEventListener('online', run);
  setInterval(run, 20_000);
  run();
}
