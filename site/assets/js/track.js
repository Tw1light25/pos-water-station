/** Track order: phone number lookup showing the newest in-progress order. */

import { api } from './api.js';
import { loadSettings } from './store.js';
import { errorCard, escapeHtml, peso, renderFooter, renderHeader } from './chrome.js';

const app = document.getElementById('app');

const FULFILLMENT = {
  pending: ['Pending', 'yellow'],
  out_for_delivery: ['Out for delivery', 'blue'],
  delivered: ['Delivered', 'green'],
  completed: ['Completed', 'green'],
  cancelled: ['Cancelled', 'red'],
};

const PAYMENT = {
  unpaid: ['Unpaid', 'red'],
  partial: ['Partially paid', 'yellow'],
  paid: ['Paid', 'green'],
};

const STEPS = ['pending', 'out_for_delivery', 'delivered'];

function formatDate(epochMs, withTime = false) {
  if (!epochMs) return '—';
  const date = new Date(Number(epochMs));
  const text = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return withTime ? `${text} ${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : text;
}

function progressHtml(order) {
  if (order.order_type === 'walkin') {
    const done = ['completed', 'delivered'].includes(order.fulfillment_status);
    return `<div class="row" style="gap: 8px">
      <span class="badge ${done ? 'badge--green' : 'badge--yellow'}">1. Order placed</span>
      <span class="muted">→</span>
      <span class="badge ${done ? 'badge--green' : ''}">2. Ready for pickup${done ? ' (done)' : ''}</span>
    </div>`;
  }

  const current = STEPS.indexOf(order.fulfillment_status);
  return `<div class="row" style="gap: 8px; flex-wrap: wrap">
    ${STEPS.map((step, index) => {
      const label = FULFILLMENT[step]?.[0] ?? step;
      const reached = current >= index || order.fulfillment_status === 'delivered';
      return `<span class="badge ${reached ? 'badge--green' : ''}">${index + 1}. ${escapeHtml(label)}</span>`;
    }).join('<span class="muted">→</span>')}
  </div>`;
}

function resultHtml(data) {
  const order = data.order;
  const [label, color] = FULFILLMENT[order.fulfillment_status] ?? [order.fulfillment_status, ''];
  const [payLabel, payColor] = PAYMENT[order.payment_status] ?? [order.payment_status, ''];
  const balance = Number(order.total_cents) - Number(order.amount_paid_cents);

  return `
    <div class="card animate" style="max-width: 640px; margin: 0 auto">
      <div class="between" style="margin-bottom: 4px">
        <h3 class="card__title">Order ${escapeHtml(order.code)}</h3>
        <span class="badge badge--${color}">${escapeHtml(label)}</span>
      </div>
      <p class="muted" style="font-size: 12.5px; margin: 0 0 18px">
        Placed ${formatDate(order.placed_at, true)} · ${order.order_type === 'delivery' ? 'Delivery' : 'Pick up'}
        ${data.active ? '' : ' · this order is finished'}
      </p>

      ${progressHtml(order)}

      ${
        order.is_preorder
          ? `<div class="alert alert--info" style="margin-top: 16px">This was placed while the shop was closed, so it is queued as a pre-order.</div>`
          : ''
      }

      <div class="card" style="background: var(--bg-elev); margin-top: 16px">
        <h4 style="font-size: 13px; margin-bottom: 8px" class="muted">ITEMS</h4>
        ${data.items
          .map(
            (item) =>
              `<div class="cart-line"><span>${escapeHtml(item.name)} × ${item.qty}</span><span>${peso(item.line_total_cents)}</span></div>`,
          )
          .join('')}
        <div class="cart-total"><span>Total</span><span>${peso(order.total_cents)}</span></div>
      </div>

      <div class="row" style="gap: 10px; margin-top: 16px; flex-wrap: wrap">
        <span class="badge badge--${payColor}">${escapeHtml(payLabel)}</span>
        ${balance > 0 ? `<span class="badge badge--red">Balance ${peso(balance)}</span>` : ''}
        ${order.due_date && balance > 0 ? `<span class="badge badge--yellow">Due ${formatDate(order.due_date)}</span>` : ''}
      </div>
    </div>`;
}

function formHtml() {
  return `
    <div class="card animate" style="max-width: 480px; margin: 0 auto">
      <h3 class="card__title">Track your order</h3>
      <p class="muted" style="font-size: 13px; margin-top: -6px">
        Enter the phone number you used when ordering.
      </p>
      <div class="field">
        <label class="field__label" for="phone">Phone number</label>
        <input class="input" id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0917 000 0000" />
      </div>
      <div id="error" class="alert alert--error hidden" style="margin-bottom: 12px"></div>
      <button class="btn btn--primary btn--block" id="lookup">Find my order</button>
    </div>`;
}

function wireForm() {
  const input = document.getElementById('phone');
  const error = document.getElementById('error');

  const lookup = async () => {
    error.classList.add('hidden');
    const phone = input.value.trim();
    if (phone.replace(/\D/g, '').length < 7) {
      error.textContent = 'Please enter a valid phone number.';
      error.classList.remove('hidden');
      return;
    }

    const button = document.getElementById('lookup');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Checking...';

    try {
      const data = await api('/api/track', { method: 'POST', body: { phone } });
      if (!data.found) {
        app.innerHTML = `
          <div class="card animate" style="max-width: 480px; margin: 0 auto">
            <div class="empty">
              <div class="empty__icon">🔍</div>
              <h3 style="margin-bottom: 6px">No order found</h3>
              <p class="muted">We could not find an order for that number. Double-check the number you ordered with.</p>
              <button class="btn" style="margin-top: 14px" onclick="location.reload()">Try again</button>
            </div>
          </div>`;
        return;
      }
      app.innerHTML = resultHtml(data);
    } catch (err) {
      button.disabled = false;
      button.innerHTML = 'Find my order';
      error.textContent = err.message;
      error.classList.remove('hidden');
    }
  };

  document.getElementById('lookup').addEventListener('click', lookup);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') lookup();
  });
  input.focus();
}

async function boot() {
  app.innerHTML = '<div class="skeleton" style="height: 240px; max-width: 480px; margin: 30px auto"></div>';
  try {
    const { settings } = await loadSettings();
    renderHeader(settings, 'track');
    renderFooter(settings);
    app.innerHTML = formHtml();
    wireForm();
  } catch (error) {
    app.innerHTML = errorCard(error.message);
  }
}

boot();
