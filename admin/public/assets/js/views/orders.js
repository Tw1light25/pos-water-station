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

/** Read the discount controls into { cents, percent, label }. */
function readDiscount(root, subtotal) {
  const type = root.querySelector('#o-discount-type')?.value ?? 'none';
  const raw = Number(root.querySelector('#o-discount-value')?.value) || 0;

  if (type === 'percent') {
    const percent = Math.max(0, Math.min(100, Math.round(raw)));
    return { cents: Math.round((subtotal * percent) / 100), percent, label: `${percent}%` };
  }
  if (type === 'amount') {
    return { cents: Math.max(0, Math.min(subtotal, toCents(raw))), percent: 0, label: 'flat' };
  }
  return { cents: 0, percent: 0, label: '' };
}

/* ------------------------------------------------------------ order builder */

/** Tell the cashier what actually got saved - the server prices the order. */
function reportCreated(created, payload, subtotal, discount) {
  const fee = payload.order_type === 'delivery' ? payload.delivery_fee_cents : 0;
  const previewTotal = subtotal - discount.cents + fee;
  const savedTotal = Number(created?.order?.total_cents);

  if (Number.isFinite(savedTotal) && savedTotal !== previewTotal) {
    toast(`Prices had changed - this order was saved at ${peso(savedTotal)}`, 'error');
  } else {
    toast('Order created');
  }
}

/** Ask before recording an order that goes past the stock on hand. */
function confirmOverStock(shortfalls, onConfirm) {
  const rows = shortfalls
    .map(
      (item) =>
        `<li>${escapeHtml(item.name)} - asked for <strong>${item.requested}</strong>, ${
          item.available <= 0
            ? '<strong>out of stock</strong>'
            : `only <strong>${item.available}</strong> in stock`
        }</li>`,
    )
    .join('');

  modal({
    title: 'More than you have in stock',
    body: `
      <p>These lines go past what is on hand:</p>
      <ul style="margin: 10px 0 0 18px; line-height: 1.8">${rows}</ul>
      <p class="muted" style="margin-top: 14px">
        Recording it anyway is fine - the stock count simply goes negative until you receive more.
      </p>`,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: 'Record anyway',
        className: 'btn--primary',
        onClick: ({ close }) => {
          close();
          onConfirm();
        },
      },
    ],
  });
}

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

    <div class="field">
      <label class="field__label" for="o-discount-type">Discount</label>
      <div class="row" style="gap: 8px">
        <select class="select" id="o-discount-type" style="width: 158px">
          <option value="none">No discount</option>
          <option value="percent">Percent (%)</option>
          <option value="amount">Flat amount (₱)</option>
        </select>
        <input class="input" id="o-discount-value" type="number" step="0.01" min="0" value="0"
          style="width: 110px" disabled />
        <input class="input" id="o-discount-reason" list="discount-reasons" placeholder="Reason (optional)"
          style="flex: 1; min-width: 120px" />
      </div>
      <datalist id="discount-reasons">
        <option value="Senior citizen"></option>
        <option value="PWD"></option>
        <option value="Loyalty"></option>
        <option value="Wholesale"></option>
      </datalist>
      <div class="row" style="gap: 6px; margin-top: 8px">
        <span class="muted" style="font-size: 11.5px">Quick:</span>
        <button class="btn btn--sm" type="button" data-discount="5">5%</button>
        <button class="btn btn--sm" type="button" data-discount="10">10%</button>
        <button class="btn btn--sm" type="button" data-discount="20">20%</button>
      </div>
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
      <div class="row-between"><span class="muted" id="o-discount-label">Discount</span><span id="o-discount-view">₱0.00</span></div>
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
          const subtotal = state.items.reduce((sum, item) => {
            const product = products.find((p) => p.id === item.product_id);
            return sum + (product?.price_cents ?? 0) * item.qty;
          }, 0);
          const discount = readDiscount(root, subtotal);

          const payload = {
            order_type: root.querySelector('#o-type').value,
            customer_name: root.querySelector('#o-name').value,
            customer_phone: root.querySelector('#o-phone').value,
            address: root.querySelector('#o-address').value,
            save_customer: root.querySelector('#o-save').checked,
            delivery_fee_cents: toCents(root.querySelector('#o-fee').value),
            initial_payment_cents: toCents(root.querySelector('#o-payment').value),
            discount_cents: discount.cents,
            discount_percent: discount.percent,
            discount_reason: root.querySelector('#o-discount-reason').value,
            note: root.querySelector('#o-note').value,
            items: state.items.filter((item) => item.product_id && item.qty > 0),
          };
          if (!payload.items.length) {
            toast('Add at least one item', 'error');
            return;
          }
          try {
            const created = await post('/orders', payload);
            close();
            reportCreated(created, payload, subtotal, discount);
            onDone();
          } catch (error) {
            // Over stock is allowed, but only on purpose: the server asks us to
            // confirm, then we re-send flagging it.
            if (error.status === 409 && Array.isArray(error.data?.over_stock)) {
              confirmOverStock(error.data.over_stock, async () => {
                try {
                  const created = await post('/orders', { ...payload, allow_over_stock: true });
                  close();
                  reportCreated(created, payload, subtotal, discount);
                  onDone();
                } catch (retryError) {
                  toast(retryError.message, 'error');
                }
              });
              return;
            }
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => {
      const itemsHost = root.querySelector('#o-items');

      function renderItems() {
        const stockSuffix = (product) => {
          if (product.track_stock === false) return '';
          const onHand = Math.max(0, Number(product.on_hand) || 0);
          return onHand > 0 ? ` · ${onHand} in stock` : ' · out of stock';
        };

        itemsHost.innerHTML = state.items
          .map(
            (item, index) => `
          <div data-index="${index}" style="margin-bottom: 8px">
            <div class="row" style="gap: 8px">
              <select class="select" data-product style="flex: 1; min-width: 0">
                ${products
                  .map(
                    (product) =>
                      `<option value="${product.id}" ${product.id === item.product_id ? 'selected' : ''}>${escapeHtml(product.name)} — ${peso(product.price_cents)}${stockSuffix(product)}</option>`,
                  )
                  .join('')}
              </select>
              <input class="input" data-qty type="number" min="1" value="${item.qty}" style="width: 74px" />
              <span class="muted" data-line style="width: 86px; text-align: right"></span>
              <button class="btn btn--sm btn--danger" data-remove type="button">×</button>
            </div>
            <span class="field__hint" data-stock-warning style="display: none"></span>
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

          // Warn (without blocking) when a tracked line asks for more than we have.
          const warning = row.querySelector('[data-stock-warning]');
          const tracked = product?.track_stock !== false;
          const available = Math.max(0, Number(product?.on_hand) || 0);

          if (product && tracked && item.qty > available) {
            warning.style.display = '';
            warning.style.color = 'var(--red)';
            warning.textContent =
              available <= 0
                ? `${product.name} is out of stock — you will be asked to confirm`
                : `Only ${available} in stock — you will be asked to confirm`;
          } else {
            warning.style.display = 'none';
            warning.textContent = '';
          }
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
        const discount = readDiscount(root, subtotal);
        const fee = isDelivery ? toCents(root.querySelector('#o-fee').value) : 0;
        const total = subtotal - discount.cents + fee;

        const cash = toCents(root.querySelector('#o-payment').value);
        const change = Math.max(0, cash - total);
        const shortfall = Math.max(0, total - cash);

        root.querySelector('#o-subtotal').textContent = peso(subtotal);
        root.querySelector('#o-discount-label').textContent =
          discount.percent > 0 ? `Discount (${discount.percent}%)` : 'Discount';
        root.querySelector('#o-discount-view').textContent =
          discount.cents > 0 ? `-${peso(discount.cents)}` : peso(0);
        root.querySelector('#o-discount-view').style.color =
          discount.cents > 0 ? 'var(--purple)' : 'inherit';
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

      const discountType = root.querySelector('#o-discount-type');
      const discountValue = root.querySelector('#o-discount-value');

      discountType.addEventListener('change', () => {
        const chosen = discountType.value !== 'none';
        discountValue.disabled = !chosen;
        if (chosen && !(Number(discountValue.value) > 0)) {
          discountValue.value = discountType.value === 'percent' ? 20 : '';
        }
        if (!chosen) discountValue.value = 0;
        renderTotals();
      });

      discountValue.addEventListener('input', renderTotals);
      root.querySelector('#o-discount-reason').addEventListener('input', renderTotals);

      root.querySelectorAll('[data-discount]').forEach((button) => {
        button.addEventListener('click', () => {
          discountType.value = 'percent';
          discountValue.disabled = false;
          discountValue.value = button.dataset.discount;
          renderTotals();
        });
      });
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

  const discountAmount = Number(order.discount_cents) || 0;
  const discountPercent = Number(order.discount_percent) || 0;
  const discountType = discountPercent > 0 ? 'percent' : discountAmount > 0 ? 'amount' : 'none';
  const discountValue = discountPercent > 0 ? discountPercent : plainAmount(discountAmount);

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
        ${
          Number(order.discount_cents) > 0
            ? `<div class="row-between">
                 <span class="muted">Discount${Number(order.discount_percent) > 0 ? ` (${order.discount_percent}%)` : ''}${order.discount_reason ? ` · ${escapeHtml(order.discount_reason)}` : ''}</span>
                 <span style="color: var(--purple)">-${peso(order.discount_cents)}</span>
               </div>`
            : ''
        }
        <div class="row-between"><span class="muted">Delivery fee</span><span>${peso(order.delivery_fee_cents)}</span></div>
        <div class="row-between" style="font-weight: 700; margin-top: 4px"><span>Total</span><span>${peso(order.total_cents)}</span></div>
        <div class="row-between"><span class="muted">Paid</span><span style="color: var(--green)">${peso(order.amount_paid_cents)}</span></div>
        ${balance > 0 ? `<div class="row-between"><span class="muted">Balance</span><span style="color: var(--red); font-weight: 600">${peso(balance)}</span></div>` : ''}
      </div>

      <div class="grid grid--4" style="gap: 0 14px; margin-top: 14px">
        <div class="field">
          <label class="field__label" for="d-discount-type">Discount</label>
          <select class="select" id="d-discount-type">
            <option value="none" ${discountType === 'none' ? 'selected' : ''}>None</option>
            <option value="percent" ${discountType === 'percent' ? 'selected' : ''}>Percent (%)</option>
            <option value="amount" ${discountType === 'amount' ? 'selected' : ''}>Flat (₱)</option>
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="d-discount-value">Value</label>
          <input class="input" id="d-discount-value" type="number" step="0.01" min="0" value="${discountValue}" />
        </div>
        <div class="field" style="grid-column: span 2">
          <label class="field__label" for="d-discount-reason">Reason</label>
          <input class="input" id="d-discount-reason" list="discount-reasons-d" value="${escapeHtml(order.discount_reason ?? '')}" placeholder="Senior citizen, PWD, loyalty..." />
          <datalist id="discount-reasons-d">
            <option value="Senior citizen"></option>
            <option value="PWD"></option>
            <option value="Loyalty"></option>
            <option value="Wholesale"></option>
          </datalist>
        </div>
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

        const type = root.querySelector('#d-discount-type').value;
        const raw = Number(root.querySelector('#d-discount-value').value) || 0;
        const percent = type === 'percent' ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
        const cents =
          type === 'amount'
            ? toCents(raw)
            : type === 'percent'
              ? Math.round((Number(order.subtotal_cents) * percent) / 100)
              : 0;

        try {
          await put(`/orders/${order.id}`, {
            fulfillment_status: root.querySelector('#d-status').value,
            due_date: dueValue ? fromDateInput(dueValue) : null,
            discount_percent: percent,
            discount_cents: cents,
            discount_reason: root.querySelector('#d-discount-reason').value,
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

  /**
   * Product prices change, and this is a single-page app - so the list must be
   * re-fetched rather than cached for the session, or the order form would show
   * out-of-date prices (and calculate the wrong change).
   */
  async function loadProducts({ force = false } = {}) {
    if (products.length && !force) return;
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
    // Always re-read prices when opening the form - the catalogue may have
    // changed since this screen was first opened.
    await loadProducts({ force: true });
    if (!products.length) {
      toast('Add products first', 'error');
      return;
    }
    openOrderModal(load);
  });

  // ...and once on every visit to the tab.
  await loadProducts({ force: true });
  await load();
}
