/**
 * Sales - the cashier view.
 *
 * Focused on orders that still need something: prepare, deliver, charge. Every
 * action is one click and offline-safe (everything writes to the local DB).
 */

import { get, post, put } from '../api.js';
import { escapeHtml, formatDate, modal, peso, plainAmount, toCents, toast } from '../ui.js';
import { fulfillmentBadge, openOrderDetail, paymentBadge } from './orders.js';
import { printReceipt } from './receipt.js';

const view = { open: [], due: [], settings: null };

function chargeModal(order, onDone) {
  const balance = Math.max(0, Number(order.total_cents) - Number(order.amount_paid_cents));
  modal({
    title: `Charge ${order.customer_name ?? 'walk-in'}`,
    body: `
      <div class="row-between" style="margin-bottom: 14px">
        <span class="muted">Order total</span>
        <strong>${peso(order.total_cents)}</strong>
      </div>
      <div class="row-between" style="margin-bottom: 14px">
        <span class="muted">Balance</span>
        <strong style="color: var(--red)">${peso(balance)}</strong>
      </div>
      <div class="grid grid--2" style="gap: 0 14px">
        <div class="field">
          <label class="field__label" for="c-amount">Cash received (₱)</label>
          <input class="input" id="c-amount" type="number" step="0.01" min="0" value="${plainAmount(balance)}" />
          <span class="field__hint" id="c-change"></span>
        </div>
        <div class="field">
          <label class="field__label" for="c-method">Method</label>
          <select class="select" id="c-method">
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <label class="switch">
        <input type="checkbox" id="c-print" checked />
        <span class="switch__track"></span>
        <span>Print receipt after</span>
      </label>`,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: 'Record payment',
        className: 'btn--primary',
        onClick: async ({ close, modal: root }) => {
          const cash = toCents(root.querySelector('#c-amount').value);
          if (cash <= 0) {
            toast('Enter an amount', 'error');
            return;
          }
          try {
            const result = await post(`/orders/${order.id}/payments`, {
              tendered_cents: cash,
              method: root.querySelector('#c-method').value,
            });
            if (root.querySelector('#c-print').checked) {
              printReceipt(result, view.settings);
            }
            close();
            const change = result?.change_cents ?? 0;
            toast(change > 0 ? `Payment recorded — change ${peso(change)}` : 'Payment recorded');
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => {
      const hint = root.querySelector('#c-change');
      const refreshChange = () => {
        const cash = toCents(root.querySelector('#c-amount').value);
        const change = Math.max(0, cash - balance);
        const shortfall = Math.max(0, balance - cash);
        if (change > 0) hint.textContent = `Change (sukli) ${peso(change)}`;
        else if (shortfall > 0 && cash > 0) hint.textContent = `${peso(shortfall)} remains unpaid`;
        else hint.textContent = '';
      };
      root.querySelector('#c-amount').addEventListener('input', refreshChange);
      root.querySelector('#c-amount').select();
      refreshChange();
    },
  });
}

function quickActions(order) {
  const actions = [];
  if (order.fulfillment_status === 'pending') {
    if (order.order_type === 'delivery') actions.push(['out_for_delivery', 'Out for delivery']);
    else actions.push(['completed', 'Complete']);
  }
  if (order.fulfillment_status === 'out_for_delivery') actions.push(['delivered', 'Delivered']);
  return actions;
}

function orderCard(order) {
  const balance = Math.max(0, Number(order.total_cents) - Number(order.amount_paid_cents));
  const actions = quickActions(order);
  return `
    <div class="card card--hover" data-id="${order.id}" style="margin-bottom: 10px">
      <div class="row-between" style="align-items: flex-start">
        <div>
          <div style="font-weight: 600; font-size: 15px">${escapeHtml(order.customer_name ?? 'Walk-in')}</div>
          <div class="muted" style="font-size: 12px">
            ${order.id.slice(-6).toUpperCase()} · ${formatDate(order.placed_at, true)} ·
            ${order.order_type === 'delivery' ? 'Delivery' : 'Walk-in'} · ${order.units} unit(s)
          </div>
          <div class="row" style="margin-top: 8px">
            ${fulfillmentBadge(order.fulfillment_status)}
            ${paymentBadge(order.payment_status)}
            ${order.is_preorder ? '<span class="badge badge--purple">Pre-order</span>' : ''}
          </div>
        </div>
        <div style="text-align: right">
          <div style="font-size: 18px; font-weight: 700">${peso(order.total_cents)}</div>
          ${balance > 0 ? `<div style="color: var(--red); font-size: 12px">Balance ${peso(balance)}</div>` : '<div style="color: var(--green); font-size: 12px">Fully paid</div>'}
        </div>
      </div>
      <div class="row" style="margin-top: 12px; flex-wrap: wrap; gap: 8px">
        ${actions.map(([status, label]) => `<button class="btn btn--sm" data-status="${status}">${label}</button>`).join('')}
        ${balance > 0 ? '<button class="btn btn--sm btn--primary" data-charge>Charge</button>' : ''}
        <button class="btn btn--sm" data-open>Details</button>
        <button class="btn btn--sm btn--ghost" data-print>Print</button>
      </div>
    </div>`;
}

export async function render(container, ctx) {
  view.settings = ctx?.state?.settings ?? null;

  container.innerHTML = `
    <div class="grid grid--4" id="summary"></div>

    <div class="grid grid--2" style="margin-top: 16px">
      <section class="card">
        <div class="card__head">
          <h3 class="card__title">Needs action</h3>
          <span class="badge" id="open-count">-</span>
        </div>
        <div id="open-list"></div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3 class="card__title">Unpaid balances</h3>
          <span class="badge badge--red" id="due-count">-</span>
        </div>
        <div id="due-list"></div>
      </section>
    </div>`;

  const openList = container.querySelector('#open-list');
  const dueList = container.querySelector('#due-list');
  const summary = container.querySelector('#summary');

  async function load() {
    openList.innerHTML = '<div class="skeleton" style="height: 120px"></div>';
    try {
      const openData = await get('/orders?open=1&limit=60');
      const dueData = await get('/orders?payment=due&limit=60');
      view.open = openData.orders;
      view.due = dueData.orders.filter((order) => order.payment_status !== 'paid');

      container.querySelector('#open-count').textContent = view.open.length;
      container.querySelector('#due-count').textContent = view.due.length;

      const outstanding = dueData.totals.outstanding_cents;

      summary.innerHTML = [
        ['Pending', view.open.filter((o) => o.fulfillment_status === 'pending').length],
        ['Out for delivery', view.open.filter((o) => o.fulfillment_status === 'out_for_delivery').length],
        ['Unpaid / partial', view.due.length],
        ['Outstanding', peso(outstanding)],
      ]
        .map(
          ([label, value]) => `
          <div class="card card--hover"><div class="stat">
            <span class="stat__label">${label}</span>
            <span class="stat__value">${value}</span>
          </div></div>`,
        )
        .join('');

      openList.innerHTML = view.open.length
        ? view.open.map(orderCard).join('')
        : '<div class="empty"><p class="muted">Nothing to prepare right now.</p></div>';

      dueList.innerHTML = view.due.length
        ? view.due.map(orderCard).join('')
        : '<div class="empty"><p class="muted">No outstanding balances.</p></div>';

      wire(openList);
      wire(dueList);
    } catch (error) {
      openList.innerHTML = `<div class="empty" style="color: var(--red)">${escapeHtml(error.message)}</div>`;
    }
  }

  function wire(host) {
    host.querySelectorAll('[data-id]').forEach((card) => {
      const order = view.open.concat(view.due).find((item) => item.id === card.dataset.id);

      card.querySelectorAll('[data-status]').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await put(`/orders/${order.id}`, { fulfillment_status: button.dataset.status });
            toast('Order updated');
            load();
          } catch (error) {
            toast(error.message, 'error');
          }
        });
      });

      card.querySelector('[data-charge]')?.addEventListener('click', () => chargeModal(order, load));
      card.querySelector('[data-open]')?.addEventListener('click', () => openOrderDetail(order.id, load));
      card.querySelector('[data-print]')?.addEventListener('click', async () => {
        const data = await get(`/orders/${order.id}`);
        printReceipt(data, view.settings);
      });
    });
  }

  await load();
}
