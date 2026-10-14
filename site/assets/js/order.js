/** Order panel: pick products, quantities, delivery details, submit. */

import { api } from './api.js';
import { loadProducts, loadSettings } from './store.js';
import { enqueue, onChange, pendingCount, startAutoFlush } from './queue.js';
import { errorCard, escapeHtml, peso, renderFooter, renderHeader } from './chrome.js';
import { computeStoreStatus, describeStatus } from '../shared/store-status.js';
import { ulid } from '../shared/ids.js';

const app = document.getElementById('app');
const bar = document.getElementById('bar');

const state = {
  settings: null,
  products: [],
  cart: new Map(),
  type: 'delivery',
  offline: false,
};

/* ----------------------------------------------------------------- render */

function productsHtml() {
  if (!state.products.length) {
    return `<div class="empty"><div class="empty__icon">💧</div><p>No products are available right now.</p></div>`;
  }

  return state.products
    .map((product) => {
      const available = Math.max(0, Number(product.on_hand) || 0);
      const out = available <= 0;
      const qty = out ? 0 : Math.min(state.cart.get(product.id) ?? 0, available);

      const meta = out
        ? '<span style="color: var(--red); font-weight: 600">Out of stock</span>'
        : `${escapeHtml(product.category ?? product.unit)} · ${available} available`;

      return `
      <div class="product ${out ? 'is-out' : ''}" data-id="${product.id}">
        <div class="grow">
          <div class="product__name">${escapeHtml(product.name)}</div>
          <div class="product__meta">${meta}</div>
        </div>
        <div class="product__price">${peso(product.price_cents)}</div>
        <div class="stepper">
          <button type="button" data-minus aria-label="Less" ${out || qty <= 0 ? 'disabled' : ''}>−</button>
          <input type="number" min="0" max="${available}" value="${qty}" data-qty aria-label="Quantity"
            ${out ? 'disabled' : ''} />
          <button type="button" data-plus aria-label="More" ${out || qty >= available ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
    })
    .join('');
}

function summaryHtml() {
  const lines = [...state.cart.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const product = state.products.find((item) => item.id === id);
      if (!product) return '';
      return `<div class="cart-line"><span>${escapeHtml(product.name)} × ${qty}</span><span>${peso(product.price_cents * qty)}</span></div>`;
    })
    .join('');

  const subtotal = cartSubtotal();
  const fee = deliveryFee();

  return `
    <h3 class="card__title">Your order</h3>
    ${lines || '<p class="muted" style="font-size: 13.5px">Nothing selected yet.</p>'}
    <div class="cart-total"><span>Total</span><span>${peso(subtotal + fee)}</span></div>
    ${fee > 0 ? `<div class="cart-line muted"><span>Includes delivery fee</span><span>${peso(fee)}</span></div>` : ''}`;
}

function detailsHtml() {
  const status = storeStatus();
  return `
    <h3 class="card__title">Your details</h3>
    ${!status.isOpen ? `<div class="alert alert--warn" style="margin-bottom: 14px">
        ${escapeHtml(state.settings?.closed_message ?? 'We are closed right now.')}<br />
        <span class="muted">Your order will be prepared when we open (${escapeHtml(describeStatus(status))}).</span>
      </div>` : ''}

    <div class="field">
      <span class="field__label">How would you like it?</span>
      <div class="choice">
        <label><input type="radio" name="otype" value="delivery" ${state.type === 'delivery' ? 'checked' : ''} /><span>🛵 Delivery</span></label>
        <label><input type="radio" name="otype" value="walkin" ${state.type === 'walkin' ? 'checked' : ''} /><span>🏪 Pick up</span></label>
      </div>
    </div>

    <div class="field">
      <label class="field__label" for="name">Name</label>
      <input class="input" id="name" autocomplete="name" placeholder="Your name" />
    </div>

    <div class="field">
      <label class="field__label" for="phone">Phone number <span class="muted">(used to track your order)</span></label>
      <input class="input" id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0917 000 0000" required />
    </div>

    <div class="field ${state.type === 'delivery' ? '' : 'hidden'}" id="address-field">
      <label class="field__label" for="address">Delivery address</label>
      <textarea class="textarea" id="address" placeholder="House number, street, barangay, landmark"></textarea>
    </div>

    <div class="field">
      <label class="field__label" for="note">Note <span class="muted">(optional)</span></label>
      <input class="input" id="note" placeholder="e.g. gate code, preferred time" />
    </div>

    <div id="form-error" class="alert alert--error hidden" style="margin-bottom: 12px"></div>

    <button class="btn btn--primary btn--block btn--lg" id="submit" type="button">Place order</button>
    <p class="muted center" style="font-size: 12px; margin-top: 10px">
      Pay on delivery or pickup — no online payment needed.
    </p>`;
}

/* ------------------------------------------------------------------ logic */

function cartSubtotal() {
  let total = 0;
  for (const [id, qty] of state.cart) {
    const product = state.products.find((item) => item.id === id);
    if (product) total += product.price_cents * qty;
  }
  return total;
}

function deliveryFee() {
  if (state.type !== 'delivery') return 0;
  return cartSubtotal() > 0 ? Number(state.settings?.delivery_fee_cents ?? 0) : 0;
}

function cartCount() {
  let count = 0;
  for (const qty of state.cart.values()) count += qty;
  return count;
}

function storeStatus() {
  return computeStoreStatus({
    override: state.settings?.store_override,
    hours: state.settings?.hours_json,
    timezone: state.settings?.timezone,
  });
}

function paint() {
  // Drop anything that has since run out before painting.
  for (const [id] of state.cart) {
    const product = state.products.find((item) => item.id === id);
    if (!product || Number(product.on_hand) <= 0) state.cart.delete(id);
  }

  const productsHost = document.getElementById('products');
  if (productsHost) productsHost.innerHTML = productsHtml();

  const summaryHost = document.getElementById('summary');
  if (summaryHost) summaryHost.innerHTML = summaryHtml();

  const detailsHost = document.getElementById('details');
  if (detailsHost) {
    const phone = document.getElementById('phone')?.value ?? '';
    const name = document.getElementById('name')?.value ?? '';
    const address = document.getElementById('address')?.value ?? '';
    const note = document.getElementById('note')?.value ?? '';
    detailsHost.innerHTML = detailsHtml();
    document.getElementById('phone').value = phone;
    document.getElementById('name').value = name;
    document.getElementById('address').value = address;
    document.getElementById('note').value = note;
    wireDetails();
  }

  wireProducts();
  paintBar();
}

function paintBar() {
  const count = cartCount();
  const total = cartSubtotal() + deliveryFee();
  bar.innerHTML = `
    <div class="wrap sticky-bar__inner">
      <div class="grow">
        <div class="sticky-bar__meta">${count} item${count === 1 ? '' : 's'}</div>
        <div class="sticky-bar__total">${peso(total)}</div>
      </div>
      <button class="btn btn--primary" id="bar-submit" ${count ? '' : 'disabled'}>Place order</button>
    </div>`;
  bar.classList.toggle('is-visible', count > 0 || pendingCount() > 0);
  document.getElementById('bar-submit')?.addEventListener('click', submit);
}

function wireProducts() {
  document.querySelectorAll('.product').forEach((card) => {
    const id = card.dataset.id;
    const product = state.products.find((item) => item.id === id);
    const available = Math.max(0, Number(product?.on_hand) || 0);

    // Out of stock: nothing on this card is interactive.
    if (available <= 0) return;

    const setQty = (value) => {
      const qty = Math.max(0, Math.min(available, Math.round(Number(value) || 0)));
      if (qty === 0) state.cart.delete(id);
      else state.cart.set(id, qty);
      paint();
    };

    card.querySelector('[data-minus]').addEventListener('click', () => setQty((state.cart.get(id) ?? 0) - 1));
    card.querySelector('[data-plus]').addEventListener('click', () => setQty((state.cart.get(id) ?? 0) + 1));
    card.querySelector('[data-qty]').addEventListener('change', (event) => setQty(event.target.value));
  });
}

function wireDetails() {
  document.querySelectorAll('input[name="otype"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      state.type = radio.value;
      const field = document.getElementById('address-field');
      field?.classList.toggle('hidden', state.type !== 'delivery');
      document.getElementById('summary').innerHTML = summaryHtml();
      paintBar();
    });
  });

  document.getElementById('submit')?.addEventListener('click', submit);
}

function showError(message) {
  const box = document.getElementById('form-error');
  if (!box) return;
  if (!message) {
    box.classList.add('hidden');
    return;
  }
  box.textContent = message;
  box.classList.remove('hidden');
}

/* ----------------------------------------------------------------- submit */

async function submit() {
  showError(null);

  const items = [...state.cart.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([product_id, qty]) => ({ product_id, qty }));

  const phone = document.getElementById('phone').value.trim();
  const name = document.getElementById('name').value.trim();
  const address = document.getElementById('address').value.trim();
  const note = document.getElementById('note').value.trim();

  if (!items.length) return showError('Please choose at least one item.');
  if (phone.replace(/\D/g, '').length < 7) return showError('Please enter a valid phone number.');
  if (state.type === 'delivery' && !address) return showError('Please enter your delivery address.');

  const payload = {
    id: ulid(),
    customer_name: name || null,
    customer_phone: phone,
    order_type: state.type,
    address: state.type === 'delivery' ? address : null,
    note: note || null,
    items,
  };

  const button = document.getElementById('submit');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    const data = await api('/api/orders', { method: 'POST', body: payload });
    showSuccess(data.order, false, data.preorder);
  } catch (error) {
    if (error.offline || !error.status || error.status >= 500) {
      enqueue(payload);
      showSuccess({ code: payload.id.slice(-6).toUpperCase(), total_cents: cartSubtotal() + deliveryFee() }, true, false);
      return;
    }
    button.disabled = false;
    button.innerHTML = original;
    showError(error.message);
  }
}

function showSuccess(order, queued, preorder) {
  bar.classList.remove('is-visible');
  document.getElementById('offline-pill')?.remove();

  app.innerHTML = `
    <div class="card animate" style="max-width: 560px; margin: 20px auto">
      <div class="success">
        <div class="success__icon">${queued ? '📥' : '✓'}</div>
        <h2 style="font-size: 22px">${queued ? 'Saved on your device' : 'Order received!'}</h2>
        <p class="muted" style="margin: 10px 0 18px">
          ${
            queued
              ? 'You seem to be offline. Your order is saved and will be sent automatically as soon as you have signal.'
              : 'Thank you! We will prepare your order right away.'
          }
        </p>

        <div class="card" style="background: var(--bg-elev); text-align: left">
          <div class="between" style="margin-bottom: 10px">
            <span class="muted">Order code</span>
            <span class="code">${escapeHtml(order.code ?? '—')}</span>
          </div>
          <div class="between" style="margin-bottom: 10px">
            <span class="muted">Total</span>
            <strong>${peso(order.total_cents)}</strong>
          </div>
          <div class="between">
            <span class="muted">Payment</span>
            <span class="badge badge--yellow">Pay on ${state.type === 'delivery' ? 'delivery' : 'pickup'}</span>
          </div>
        </div>

        ${
          preorder
            ? `<div class="alert alert--warn" style="margin-top: 14px; text-align: left">
                 We're closed right now, so this is a <strong>pre-order</strong>. We'll deliver it once we open.
               </div>`
            : ''
        }

        <div class="row" style="justify-content: center; gap: 10px; margin-top: 20px">
          <a class="btn" href="/track">Track this order</a>
          <a class="btn btn--primary" href="/order">Order more</a>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------- boot */

async function boot() {
  app.innerHTML = '<div class="skeleton" style="height: 300px; margin-top: 20px"></div>';

  try {
    const [settingsData, productsData] = await Promise.all([loadSettings(), loadProducts()]);
    state.settings = settingsData.settings;
    state.products = productsData.products;
    state.offline = settingsData.offline || productsData.offline;

    renderHeader(state.settings, 'order');
    renderFooter(state.settings);

    app.innerHTML = `
      <div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 20px; align-items: start" class="order-layout">
        <section class="card animate">
          <h3 class="card__title">Choose your water</h3>
          <div class="products" id="products"></div>
        </section>
        <aside class="animate" style="display: grid; gap: 16px; position: sticky; top: 86px">
          <div class="card" id="summary"></div>
          <div class="card" id="details"></div>
        </aside>
      </div>`;

    paint();

    if (state.offline) {
      const pill = document.createElement('div');
      pill.className = 'offline-pill';
      pill.id = 'offline-pill';
      pill.textContent = 'Offline - you can still place an order, it will send when you are back online';
      document.body.appendChild(pill);
    }

    startAutoFlush();
    onChange((count) => {
      const pill = document.getElementById('offline-pill');
      if (pill) pill.textContent = `${count} order${count === 1 ? '' : 's'} waiting to send`;
    });

    window.addEventListener('online', () => {
      document.getElementById('offline-pill')?.remove();
    });
  } catch (error) {
    app.innerHTML = errorCard(error.message);
  }
}

boot();
