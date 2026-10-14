/** Landing page: business identity, live open/closed status, call to action. */

import { loadSettings } from './store.js';
import { errorCard, escapeHtml, logoMark, renderFooter, renderHeader } from './chrome.js';
import { computeStoreStatus, describeStatus } from '../shared/store-status.js';

const app = document.getElementById('app');
let settings = null;

function heroHtml() {
  const name = settings?.business_name ?? 'Water Station';
  const tagline = settings?.tagline ?? 'Purified drinking water, delivered to your door';
  const description =
    settings?.description ??
    'Order in a few taps and we will deliver fresh purified water to your doorstep.';

  return `
    <section class="hero">
      <div>
        <span class="badge badge--blue" id="status-badge">
          <span class="dot" id="status-dot"></span>
          <span id="status-text">Checking...</span>
        </span>
        <h1 class="hero__title" style="margin-top: 16px">${escapeHtml(name)}</h1>
        <p class="hero__text">${escapeHtml(description)}</p>
        <div class="row" style="flex-wrap: wrap; gap: 12px">
          <a class="btn btn--primary btn--lg" href="/order">Order water</a>
          <a class="btn btn--lg" href="/track">Track my order</a>
        </div>
        <p class="muted" style="margin-top: 14px; font-size: 12.5px">${escapeHtml(tagline)}</p>
      </div>

      <div class="hero__card">
        <div class="row" style="margin-bottom: 16px">
          <span class="brand__logo" style="width: 52px; height: 52px; border-radius: 15px">${logoMark(settings)}</span>
          <div>
            <div style="font-weight: 700">${escapeHtml(name)}</div>
            <div class="muted" style="font-size: 12.5px">${escapeHtml(tagline)}</div>
          </div>
        </div>
        <div id="closed-note" class="hidden"></div>
      </div>
    </section>`;
}

function infoHtml() {
  const items = [
    settings?.address ? ['📍', 'Visit us', settings.address] : null,
    settings?.phone ? ['📞', 'Call or text', settings.phone] : null,
    settings?.facebook ? ['👍', 'Facebook', settings.facebook] : null,
    settings?.email ? ['✉️', 'Email', settings.email] : null,
  ].filter(Boolean);

  if (!items.length) return '';
  return `<div class="grid-3 animate-in">${items
    .map(
      ([icon, label, value]) => `
      <div class="card">
        <div class="info">
          <span class="info__icon">${icon}</span>
          <span>
            <span class="info__label">${escapeHtml(label)}</span><br />
            <span class="info__value">${isLink(value) ? `<a href="${escapeHtml(linkFor(value))}" target="_blank" rel="noopener">${escapeHtml(value)}</a>` : escapeHtml(value)}</span>
          </span>
        </div>
      </div>`,
    )
    .join('')}</div>`;
}

function isLink(value) {
  return /^https?:\/\//i.test(String(value)) || /facebook\.com/i.test(String(value));
}

function linkFor(value) {
  const text = String(value);
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function refreshStatus() {
  if (!settings) return;
  const badge = document.getElementById('status-badge');
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const note = document.getElementById('closed-note');
  if (!badge) return;

  const status = computeStoreStatus({
    override: settings.store_override,
    hours: settings.hours_json,
    timezone: settings.timezone,
  });

  badge.className = `badge ${status.isOpen ? 'badge--open' : 'badge--closed'}`;
  dot.className = `dot ${status.isOpen ? 'dot--open' : 'dot--closed'}`;
  text.textContent = status.isOpen ? 'Open now' : 'Closed now';

  if (note) {
    if (status.isOpen) {
      note.className = 'alert alert--ok';
      note.innerHTML = `We're open — <strong>${escapeHtml(describeStatus(status))}</strong>. Orders are delivered as soon as possible.`;
    } else {
      note.className = 'alert alert--warn';
      note.innerHTML =
        escapeHtml(settings.closed_message ?? 'We are closed right now, but you can still place an order for later.') +
        `<br /><span class="muted">${escapeHtml(describeStatus(status))}</span>`;
    }
    note.classList.remove('hidden');
  }
}

async function boot() {
  app.innerHTML = '<div class="skeleton" style="height: 260px; margin-top: 20px"></div>';

  try {
    const data = await loadSettings();
    settings = data.settings;
    renderHeader(settings);
    renderFooter(settings);
    app.innerHTML = heroHtml() + infoHtml();
    refreshStatus();
    setInterval(refreshStatus, 30_000);
    if (data.offline) {
      const pill = document.createElement('div');
      pill.className = 'offline-pill';
      pill.textContent = 'Offline - showing the last saved details';
      document.body.appendChild(pill);
    }
  } catch (error) {
    app.innerHTML = errorCard(error.message);
  }
}

boot();
