/** Orders - list, manual entry for customers, statuses and payments. */

import { del, get, post, put } from '../api.js';
import {
  escapeHtml,
  formatDate,
  fromDateInput,
  modal,
  peso,
  plainAmount,
  toCents,
  toDateInput,
  toast,
} from '../ui.js';
import { printReceipt } from './receipt.js';

export const FULFILLMENT_LABELS = {
  pending: 'Pending',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABELS = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid' };

export function fulfillmentBadge(status) {
  const colors = {
    pending: 'yellow',
    out_for_delivery: 'blue',
    delivered: 'green',
    completed: 'green',
    cancelled: 'red',
  };
  return `<span class="badge badge--${colors[status] ?? ''}">${FULFILLMENT_LABELS[status] ?? status}</span>`;
}

export function paymentBadge(status) {
  const colors = { unpaid: 'red', partial: 'yellow', paid: 'green' };
  return `<span class="badge badge--${colors[status] ?? ''}">${PAYMENT_LABELS[status] ?? status}</span>`;
}

const view = { orders: [], totals: {}, settings: null, status: '', payment: '', search: '' };
let products = [];

/* ------------------------------------------------------------ order builder */

function openOrderModal(onDone) {
  const state = { type: 'walkin', items: [{ product_id: products[0]?.id ?? '', qty: 1 }] };

  const body = `
    <div class="grid grid--2" style="gap: 0 14px">
      <div class="field">
        <label class="field__label" for="o-type">Order type</label>
        <select class="select" id="o-type">
          <option value="walkin">Walk-in</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="o-name">Customer name</label>
        <input class="input" id="o-name" placeholder="Optional" />
      </div>
    </div>
    <div class="grid grid--2" style="gap: 0 14px">
      <div class="field">
        <label class="field__label" for="o-phone">Phone</label>
        <input class="input" id="o-phone" placeholder="0917 000 0000" />
      </div>
      <div class="field">
        <label class="field__label" for="o-save">Save as customer</label>
        <label class="switch" style="height: 40px">
          <input type="checkbox" id="o-save" checked />
          <span class="switch__track"></span>
          <span class="muted" style="font-size: 12px">Keep in records</span>
        </label>
      </div>
    </div>
    <div class="field hidden" id="o-address-field">
      <label class="field__label" for="o-address">Delivery address</label>
      <input class="input" id="o-address" placeholder="Street, barangay" />
    </div>

    <div class="field">
      <label class="field__label">Items</label>
      <div id="o-items"></div>
      <button class="btn btn--sm" type="button" id="o-add-item" style="margin-top: 8px">+ Add item</button>
    </div>

    <div class="grid grid--2" style="gap: 0 14px">
      <div class="field" id="o-fee-field">
        <label class="field__label" for="o-fee">Delivery fee (₱)</label>
        <input class="input" id="o-fee" type="number" step="0.01" min="0" value="${plainAmount(view.settings?.delivery_fee_cents ?? 0)}" />
      </div>
      <div class="field">
        <label class="field__label" for="o-payment">Cash received (₱)</label>
        <input class="input" id="o-payment" type="number" step="0.01" min="0" value="0.00" />
        <span class="field__hint" id="o-payment-hint">Only the amount due is recorded.</span>
      </div>
    </div>
    <div class="field">
      <label class="field__label" for="o-note">Note</label>
      <input class="input" id="o-note" placeholder="Optional" />
    </div>

    <div class="card" style="background: var(--bg-elev); padding: 12px">
      <div class="row-between"><span class="muted">Subtotal</span><span id="o-subtotal">₱0.00</span></div>
      <div class="row-between"><span class="muted">Delivery fee</span><span id="o-fee-view">₱0.00</span></div>
      <div class="row-between" style="margin-top: 6px; font-weight: 700; font-size: 15px">
        <span>Total</span><span id="o-total">₱0.00</span>
      </div>
      <div class="row-between" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border)">
        <span class="muted">Change (sukli)</span>
        <span id="o-change" style="font-weight: 700; color: var(--green)">₱0.00</span>
      </div>
    </div>`;

  modal({
    title: 'New order',
    body,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: 'Create order',
        className: 'btn--primary',
        onClick: async ({ close, modal: root }) => {
          const payload = {
            order_type: root.querySelector('#o-type').value,
            customer_name: root.querySelector('#o-name').value,
            customer_phone: root.querySelector('#o-phone').value,
            address: root.querySelector('#o-address').value,
            save_customer: root.querySelector('#o-save').checked,
            delivery_fee_cents: toCents(root.querySelector('#o-fee').value),
            initial_payment_cents: toCents(root.querySelector('#o-payment').value),
            note: root.querySelector('#o-note').value,
            items: state.items.filter((item) => item.product_id && item.qty > 0),
          };
          if (!payload.items.length) {
            toast('Add at least one item', 'error');
            return;
          }
          try {
            await post('/orders', payload);
            close();
            toast('Order created');
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => {
      const itemsHost = root.querySelector('#o-items');

      function renderItems() {
        itemsHost.innerHTML = state.items
          .map(
            (item, index) => `
          <div class="row" data-index="${index}" style="margin-bottom: 8px">
            <select class="select" data-product style="flex: 1">
              ${products
                .map(
                  (product) =>
                    `<option value="${product.id}" ${product.id === item.product_id ? 'selected' : ''}>${escapeHtml(product.name)} — ${peso(product.price_cents)}</option>`,
                )
                .join('')}
            </select>
            <input class="input" data-qty type="number" min="1" value="${item.qty}" style="width: 74px" />
            <span class="muted" data-line style="width: 86px; text-align: right"></span>
            <button class="btn btn--sm btn--danger" data-remove type="button">×</button>
          </div>`,
          )
          .join('');

        itemsHost.querySelectorAll('[data-index]').forEach((row) => {
          const index = Number(row.dataset.index);
          row.querySelector('[data-product]').addEventListener('change', (event) => {
            state.items[index].product_id = event.target.value;
            renderItems();
          });
          row.querySelector('[data-qty]').addEventListener('input', (event) => {
            state.items[index].qty = Math.max(1, Math.round(Number(event.target.value) || 1));
            renderTotals();
            renderLines();
          });
          row.querySelector('[data-remove]').addEventListener('click', () => {
            state.items.splice(index, 1);
            if (!state.items.length) state.items.push({ product_id: products[0]?.id ?? '', qty: 1 });
            renderItems();
          });
        });
        renderLines();
        renderTotals();
      }

      function renderLines() {
        itemsHost.querySelectorAll('[data-index]').forEach((row) => {
          const item = state.items[Number(row.dataset.index)];
          const product = products.find((p) => p.id === item.product_id);
          const line = (product?.price_cents ?? 0) * item.qty;
          row.querySelector('[data-line]').textContent = peso(line);
        });
      }

      function renderTotals() {
        const isDelivery = root.querySelector('#o-type').value === 'delivery';
        root.querySelector('#o-address-field').classList.toggle('hidden', !isDelivery);
        root.querySelector('#o-fee-field').style.display = isDelivery ? '' : 'none';

        const subtotal = state.items.reduce((sum, item) => {
          const product = products.find((p) => p.id === item.product_id);
          return sum + (product?.price_cents ?? 0) * item.qty;
        }, 0);
        const fee = isDelivery ? toCents(root.querySelector('#o-fee').value) : 0;
        const total = subtotal + fee;

        const cash = toCents(root.querySelector('#o-payment').value);
        const change = Math.max(0, cash - total);
        const shortfall = Math.max(0, total - cash);

        root.querySelector('#o-subtotal').textContent = peso(subtotal);
        root.querySelector('#o-fee-view').textContent = peso(fee);
        root.querySelector('#o-total').textContent = peso(total);
        root.querySelector('#o-change').textContent = peso(change);
        root.querySelector('#o-change').style.color = change > 0 ? 'var(--green)' : 'var(--muted)';

        const hint = root.querySelector('#o-payment-hint');
        if (change > 0) hint.textContent = `Records ${peso(total)} paid, ${peso(change)} change`;
        else if (shortfall > 0 && cash > 0) hint.textContent = `Partial — ${peso(shortfall)} will remain unpaid`;
        else hint.textContent = 'Only the amount due is recorded.';
      }

      root.querySelector('#o-type').addEventListener('change', renderTotals);
      root.querySelector('#o-fee').addEventListener('input', renderTotals);
      root.querySelector('#o-payment').addEventListener('input', renderTotals);
      root.querySelector('#o-add-item').addEventListener('click', () => {
        state.items.push({ product_id: products[0]?.id ?? '', qty: 1 });
        renderItems();
      });

      renderItems();
    },
  });
}

/* -------------------------------------------------------------- order detail */

export async function openOrderDetail(id, onDone) {
  const data = await get(`/orders/${id}`);
  const { order, items, payments } = data;
  const balance = Number(order.total_cents) - Number(order.amount_paid_cents);

  modal({
    title: `Order ${order.id.slice(-6).toUpperCase()}`,
    body: `
      <div class="grid grid--2" style="gap: 0 14px">
        <div class="field"><span class="field__label">Customer</span><span>${escapeHtml(order.customer_name ?? 'Walk-in')}</span></div>
        <div class="field"><span class="field__label">Phone</span><span>${escapeHtml(order.customer_phone ?? '-')}</span></div>
        <div class="field"><span class="field__label">Placed</span><span>${formatDate(order.placed_at, true)}</span></div>
        <div class="field"><span class="field__label">Type</span><span>${order.order_type === 'delivery' ? 'Delivery' : 'Walk-in'}</span></div>
      </div>
      ${order.address ? `<div class="field"><span class="field__label">Address</span><span>${escapeHtml(order.address)}</span></div>` : ''}
      ${order.note ? `<div class="field"><span class="field__label">Note</span><span>${escapeHtml(order.note)}</span></div>` : ''}

      <div class="table-wrap" style="margin-bottom: 14px">
        <table class="table">
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
          <tbody>${items
            .map(
              (item) => `<tr>
                <td>${escapeHtml(item.product_name)}</td>
                <td class="num">${item.qty}</td>
                <td class="num">${peso(item.unit_price_cents)}</td>
                <td class="num">${peso(item.line_total_cents)}</td>
              </tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>

      <div class="card" style="background: var(--bg-elev); padding: 12px">
        <div class="row-between"><span class="muted">Subtotal</span><span>${peso(order.subtotal_cents)}</span></div>
        <div class="row-between"><span class="muted">Delivery fee</span><span>${peso(order.delivery_fee_cents)}</span></div>
        <div class="row-between" style="font-weight: 700; margin-top: 4px"><span>Total</span><span>${peso(order.total_cents)}</span></div>
        <div class="row-between"><span class="muted">Paid</span><span style="color: var(--green)">${peso(order.amount_paid_cents)}</span></div>
        ${balance > 0 ? `<div class="row-between"><span class="muted">Balance</span><span style="color: var(--red); font-weight: 600">${peso(balance)}</span></div>` : ''}
      </div>

      ${
        payments.length
          ? `<div class="field" style="margin-top: 14px"><span class="field__label">Payments</span>
               <div class="table-wrap"><table class="table">
                 <thead><tr><th>When</th><th>Method</th><th class="num">Amount</th><th></th></tr></thead>
                 <tbody>${payments
                   .map(
                     (payment) => `<tr data-pid="${payment.id}">
                       <td class="muted">${formatDate(payment.paid_at, true)}</td>
                       <td>${escapeHtml(payment.method)}</td>
                       <td class="num">
                         ${peso(payment.amount_cents)}
                         ${
                           Number(payment.tendered_cents) > Number(payment.amount_cents)
                             ? `<div class="muted" style="font-size: 11px">cash ${peso(payment.tendered_cents)} · change ${peso(Number(payment.tendered_cents) - Number(payment.amount_cents))}</div>`
                             : ''
                         }
                       </td>
                       <td class="num"><button class="btn btn--sm btn--danger" data-del-payment>×</button></td>
                     </tr>`,
                   )
                   .join('')}</tbody>
               </table></div></div>`
          : ''
      }

      <div class="grid grid--2" style="gap: 0 14px; margin-top: 14px">
        <div class="field">
          <label class="field__label" for="d-status">Fulfillment</label>
          <select class="select" id="d-status">
            ${Object.entries(FULFILLMENT_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${order.fulfillment_status === value ? 'selected' : ''}>${label}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="d-due">Due date (for unpaid)</label>
          <input class="input" id="d-due" type="date" value="${order.due_date ? toDateInput(order.due_date) : ''}" />
        </div>
      </div>

      <div class="grid grid--2" style="gap: 0 14px">
        <div class="field">
          <label class="field__label" for="d-amount">Cash received (₱)</label>
          <input class="input" id="d-amount" type="number" step="0.01" min="0" value="${balance > 0 ? plainAmount(balance) : '0.00'}" />
          <span class="field__hint" id="d-change"></span>
        </div>
        <div class="field">
          <label class="field__label" for="d-method">Method</label>
          <select class="select" id="d-method">
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div class="row" style="flex-wrap: wrap; gap: 8px">
        <button class="btn btn--sm" data-save-status type="button">Save status</button>
        <button class="btn btn--sm btn--primary" data-add-payment type="button">Record payment</button>
        <button class="btn btn--sm" data-print type="button">Print receipt</button>
        <button class="btn btn--sm" data-mark-paid type="button">Mark fully paid</button>
      </div>`,
    actions: [
      {
        label: 'Delete order',
        className: 'btn--danger',
        onClick: async ({ close }) => {
          try {
            await del(`/orders/${order.id}`);
            close();
            toast('Order deleted');
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
      {
        label: 'Close',
        className: 'btn--ghost',
        onClick: async ({ close }) => {
          close();
          onDone();
        },
      },
    ],
    onMount: (root, close) => {
      const changeHint = root.querySelector('#d-change');
      const refreshChange = () => {
        const cash = toCents(root.querySelector('#d-amount').value);
        const change = Math.max(0, cash - balance);
        const shortfall = Math.max(0, balance - cash);
        if (change > 0) changeHint.textContent = `Records ${peso(balance)} paid, ${peso(change)} change`;
        else if (shortfall > 0 && cash > 0) changeHint.textContent = `${peso(shortfall)} will remain unpaid`;
        else changeHint.textContent = '';
      };
      root.querySelector('#d-amount').addEventListener('input', refreshChange);
      refreshChange();

      root.querySelector('[data-print]').addEventListener('click', () =>
        printReceipt({ order, items, payments }, view.settings),
      );

      root.querySelector('[data-save-status]').addEventListener('click', async () => {
        const dueValue = root.querySelector('#d-due').value;
        try {
          await put(`/orders/${order.id}`, {
            fulfillment_status: root.querySelector('#d-status').value,
            due_date: dueValue ? fromDateInput(dueValue) : null,
          });
          toast('Order updated');
          close();
          onDone();
        } catch (error) {
          toast(error.message, 'error');
        }
      });

      root.querySelector('[data-add-payment]').addEventListener('click', async () => {
        const cash = toCents(root.querySelector('#d-amount').value);
        if (cash <= 0) {
          toast('Enter an amount', 'error');
          return;
        }
        try {
          const result = await post(`/orders/${order.id}/payments`, {
            tendered_cents: cash,
            method: root.querySelector('#d-method').value,
          });
          const change = result?.change_cents ?? 0;
          toast(change > 0 ? `Payment recorded — change ${peso(change)}` : 'Payment recorded');
          close();
          onDone();
        } catch (error) {
          toast(error.message, 'error');
        }
      });

      root.querySelector('[data-mark-paid]').addEventListener('click', async () => {
        if (balance <= 0) {
          toast('Already fully paid', 'error');
          return;
        }
        try {
          await post(`/orders/${order.id}/payments`, {
            tendered_cents: balance,
            method: root.querySelector('#d-method').value,
            note: 'Settled in full',
          });
          toast('Marked as paid');
          close();
          onDone();
        } catch (error) {
          toast(error.message, 'error');
        }
      });

      root.querySelectorAll('[data-del-payment]').forEach((button) => {
        button.addEventListener('click', async () => {
          const row = button.closest('tr');
          try {
            await del(`/orders/${order.id}/payments/${row.dataset.pid}`);
            toast('Payment removed');
            close();
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        });
      });
    },
  });
}

/* ------------------------------------------------------------------- screen */

export async function render(container, ctx) {
  view.settings = ctx?.state?.settings ?? null;

  container.innerHTML = `
    <div class="grid grid--4" id="summary"></div>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <div class="row">
          <h3 class="card__title">Orders</h3>
          <span class="badge" id="count">-</span>
        </div>
        <div class="row">
          <input class="input" id="search" placeholder="Search customer" style="width: 180px" />
          <select class="select" id="status" style="width: 165px">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select class="select" id="payment" style="width: 150px">
            <option value="">All payments</option>
            <option value="due">Unpaid / partial</option>
            <option value="paid">Paid</option>
          </select>
          <button class="btn btn--primary" id="add">+ New order</button>
        </div>
      </div>
      <div id="list"></div>
    </section>`;

  const list = container.querySelector('#list');
  const summary = container.querySelector('#summary');
  const count = container.querySelector('#count');

  async function loadProducts() {
    if (products.length) return;
    const data = await get('/products');
    products = data.products;
  }

  async function load() {
    list.innerHTML = '<div class="skeleton" style="height: 160px; margin: 8px"></div>';
    try {
      const query = new URLSearchParams();
      if (view.status) query.set('status', view.status);
      if (view.payment) query.set('payment', view.payment);
      if (view.search) query.set('search', view.search);

      const data = await get(`/orders?${query.toString()}`);
      view.orders = data.orders;
      view.totals = data.totals;
      count.textContent = `${data.orders.length} order${data.orders.length === 1 ? '' : 's'}`;

      summary.innerHTML = [
        ['Collected', peso(data.totals.collected_cents)],
        ['Outstanding', peso(data.totals.outstanding_cents)],
        ['Orders', data.totals.count],
      ]
        .map(
          ([label, value]) => `
          <div class="card card--hover"><div class="stat">
            <span class="stat__label">${label}</span>
            <span class="stat__value">${value}</span>
          </div></div>`,
        )
        .join('');

      renderList();
    } catch (error) {
      list.innerHTML = `<div class="empty" style="color: var(--red)">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderList() {
    if (!view.orders.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty__icon">🧾</div>
          <p>No orders yet. Click <strong>New order</strong> to take one, or they arrive from the customer site.</p>
        </div>`;
      return;
    }

    list.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>When</th><th>Customer</th><th>Type</th><th class="num">Units</th>
              <th class="num">Total</th><th>Fulfillment</th><th>Payment</th><th></th></tr>
          </thead>
          <tbody>
            ${view.orders
              .map(
                (order) => `
              <tr data-id="${order.id}">
                <td class="muted">${formatDate(order.placed_at, true)}</td>
                <td>
                  <div style="font-weight: 600">${escapeHtml(order.customer_name ?? 'Walk-in')}</div>
                  ${order.is_preorder ? '<span class="badge badge--purple">Pre-order</span>' : ''}
                </td>
                <td class="muted">${order.order_type === 'delivery' ? 'Delivery' : 'Walk-in'}</td>
                <td class="num muted">${order.units}</td>
                <td class="num" style="font-weight: 600">${peso(order.total_cents)}</td>
                <td>${fulfillmentBadge(order.fulfillment_status)}</td>
                <td>${paymentBadge(order.payment_status)}</td>
                <td class="num"><button class="btn btn--sm" data-open>Open</button></td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    list.querySelectorAll('tr[data-id]').forEach((row) => {
      row.querySelector('[data-open]').addEventListener('click', () =>
        openOrderDetail(row.dataset.id, load),
      );
    });
  }

  let timer;
  container.querySelector('#search').addEventListener('input', (event) => {
    view.search = event.target.value;
    clearTimeout(timer);
    timer = setTimeout(load, 220);
  });
  container.querySelector('#status').addEventListener('change', (event) => {
    view.status = event.target.value;
    load();
  });
  container.querySelector('#payment').addEventListener('change', (event) => {
    view.payment = event.target.value;
    load();
  });
  container.querySelector('#add').addEventListener('click', async () => {
    await loadProducts();
    if (!products.length) {
      toast('Add products first', 'error');
      return;
    }
    openOrderModal(load);
  });

  await load();
}
