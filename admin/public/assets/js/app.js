/**
 * Admin shell: sidebar, routing between views, store-status chip and the
 * sync indicator. Views are loaded lazily so the shell stays snappy.
 */

import { get, post, put } from './api.js';
import { toast } from './ui.js';
import { icon, LOGO } from './icons.js';
import { computeStoreStatus, describeStatus } from '/shared/store-status.js';

const ROUTES = [
  { slug: 'dashboard', label: 'Dashboard', icon: 'dashboard', subtitle: 'Sales and outgoing money at a glance', load: () => import('./views/dashboard.js') },
  { slug: 'orders', label: 'Orders', icon: 'orders', subtitle: 'Incoming and manually entered orders', load: () => import('./views/orders.js') },
  { slug: 'sales', label: 'Sales', icon: 'sales', subtitle: 'Charge orders, mark delivered, record payments', load: () => import('./views/sales.js') },
  { slug: 'products', label: 'Products', icon: 'products', subtitle: 'Catalogue and prices', load: () => import('./views/products.js') },
  { slug: 'inventory', label: 'Inventory', icon: 'inventory', subtitle: 'Stock ledger and levels', load: () => import('./views/inventory.js') },
  { slug: 'expenses', label: 'Expenses', icon: 'expenses', subtitle: 'Outgoing money', load: () => import('./views/expenses.js') },
  { slug: 'customers', label: 'Customers', icon: 'customers', subtitle: 'Records, notes and balances', load: () => import('./views/customers.js') },
  { slug: 'settings', label: 'Settings', icon: 'settings', subtitle: 'Business identity, hours and ordering', load: () => import('./views/settings.js') },
];

const state = { user: null, settings: null };

const view = document.getElementById('view');

function currentSlug() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const slug = hash.split('?')[0];
  return ROUTES.some((route) => route.slug === slug) ? slug : 'dashboard';
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = ROUTES.map(
    (route) => `
      <div class="nav__item" data-slug="${route.slug}">
        ${icon(route.icon)}
        <span>${route.label}</span>
      </div>`,
  ).join('');

  nav.querySelectorAll('.nav__item').forEach((item) => {
    item.addEventListener('click', () => {
      window.location.hash = `#/${item.dataset.slug}`;
    });
  });
}

function setActive(slug) {
  document
    .querySelectorAll('.nav__item')
    .forEach((item) => item.classList.toggle('is-active', item.dataset.slug === slug));
}

function renderLoadError(message) {
  view.innerHTML = `
    <div class="card">
      <div class="empty">
        <div class="empty__icon">⚠️</div>
        <h3 style="margin-bottom: 6px">Could not load this screen</h3>
        <p class="muted" style="max-width: 44ch; margin: 0 auto 14px">${message}</p>
        <button class="btn" onclick="location.reload()">Reload</button>
      </div>
    </div>`;
}

// Guards against overlapping renders: a superseded render stops instead of
// painting over (and re-using the canvases of) the newest one.
let renderToken = 0;

async function renderRoute() {
  const token = (renderToken += 1);
  const slug = currentSlug();
  const route = ROUTES.find((item) => item.slug === slug);
  setActive(slug);
  document.getElementById('page-title').textContent = route.label;
  document.getElementById('page-subtitle').textContent = route.subtitle;

  view.classList.add('view-leave');
  await new Promise((resolve) => setTimeout(resolve, 60));
  if (token !== renderToken) return;

  view.classList.remove('view-leave');
  view.innerHTML = '';

  try {
    const module = await route.load();
    if (token !== renderToken) return;
    await module.render(view, { state, refreshShell, isCurrent: () => token === renderToken });
  } catch (error) {
    if (token !== renderToken) return;
    renderLoadError(error.message);
  }
}

/* --------------------------------------------------------------- status UI */

function refreshStatus() {
  const settings = state.settings;
  const chip = document.getElementById('store-chip');
  const label = document.getElementById('store-label');
  if (!settings) return;

  const status = computeStoreStatus({
    override: settings.store_override,
    hours: settings.hours_json,
    timezone: settings.timezone,
  });

  chip.classList.toggle('status-chip--open', status.isOpen);
  chip.classList.toggle('status-chip--closed', !status.isOpen);
  chip.querySelector('.dot').className = `dot ${status.isOpen ? 'dot--online' : 'dot--offline'}`;
  label.textContent = describeStatus(status);
  chip.title =
    settings.store_override === 'auto'
      ? 'Following operating hours · Click to close/open now'
      : 'Manual override · Click to switch · Right-click to follow operating hours again';
}

/** Save a new store override (writes locally + queues for sync, so it works offline). */
async function setStoreOverride(value) {
  if (!state.settings) return;
  try {
    const data = await put('/settings', { store_override: value });
    state.settings = data.settings;
    refreshStatus();
    const labels = {
      auto: 'Automatic - follows operating hours',
      force_open: 'Open (manual override)',
      force_closed: 'Closed (manual override)',
    };
    toast(`Store status: ${labels[value] ?? value}`);
    refreshSync();
  } catch (error) {
    toast(error.message, 'error');
  }
}

/** One click flips the shop open or closed. */
async function toggleStoreStatus() {
  if (!state.settings) return;
  const status = computeStoreStatus({
    override: state.settings.store_override,
    hours: state.settings.hours_json,
    timezone: state.settings.timezone,
  });
  await setStoreOverride(status.isOpen ? 'force_closed' : 'force_open');
}

async function refreshSync() {
  const dot = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if (!dot || !label) return;

  if (!navigator.onLine) {
    dot.className = 'dot dot--offline';
    label.textContent = 'Offline - changes queued';
    return;
  }

  try {
    const { sync } = await get('/sync');
    const pending = Number(sync?.pending ?? 0);

    if (!sync || sync.online === false) {
      dot.className = 'dot dot--offline';
      label.textContent = 'Cloud unreachable - queued';
    } else if (pending > 0) {
      dot.className = 'dot dot--pending';
      label.textContent = `Syncing - ${pending} pending`;
    } else {
      dot.className = 'dot dot--online';
      const when = sync.lastSyncAt
        ? new Date(sync.lastSyncAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
        : 'pending';
      label.textContent = `All saved - synced ${when}`;
    }
  } catch {
    dot.className = 'dot dot--offline';
    label.textContent = 'Offline - changes queued';
  }
}

export async function refreshShell() {
  await loadSettings();
  await refreshSync();
}

async function loadSettings() {
  try {
    const data = await get('/settings');
    state.settings = data.settings;
    if (state.settings?.business_name) {
      document.getElementById('business-name').textContent = state.settings.business_name;
      document.title = `${state.settings.business_name} - POS`;
    }
    refreshStatus();
  } catch {
    /* keep the shell usable even if settings fail */
  }
}

/* ------------------------------------------------------------------- boot */

async function boot() {
  document.getElementById('sidebar-logo').innerHTML = LOGO;
  renderNav();

  let me;
  try {
    me = await get('/auth/me');
  } catch {
    return; // api() already redirected to /login
  }

  state.user = me.user;
  document.getElementById('user-name').textContent = me.user.displayName;
  document.getElementById('avatar').textContent = (me.user.displayName || 'O').slice(0, 1).toUpperCase();

  await loadSettings();

  document.getElementById('logout').addEventListener('click', async () => {
    try {
      await post('/auth/logout');
    } catch {
      /* ignore */
    }
    window.location.assign('/login');
  });

  const syncPill = document.getElementById('sync-pill');
  syncPill.style.cursor = 'pointer';
  syncPill.title = 'Click to sync now';
  syncPill.addEventListener('click', async () => {
    const label = document.getElementById('sync-label');
    const previous = label.textContent;
    label.textContent = 'Syncing...';
    try {
      const result = await post('/sync/now');
      const pushed = result?.result?.pushed ?? 0;
      const pulled = result?.result?.pulled ?? 0;
      if (result?.result?.ok === false) toast(result.result.error || 'Sync failed', 'error');
      else toast(`Synced: ${pushed} sent, ${pulled} received`);
    } catch (error) {
      toast(error.message, 'error');
      label.textContent = previous;
    }
    refreshSync();
  });

  // Store status chip: click to open/close, right-click to follow hours again.
  const chip = document.getElementById('store-chip');
  chip.setAttribute('role', 'button');
  chip.tabIndex = 0;
  chip.addEventListener('click', toggleStoreStatus);
  chip.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    setStoreOverride('auto');
  });
  chip.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleStoreStatus();
    }
  });

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('online', () => {
    refreshSync();
    toast('Back online - syncing');
  });
  window.addEventListener('offline', refreshSync);

  // Setting the hash fires `hashchange`, which renders the route. Only render
  // directly when a hash is already present - otherwise the page would render
  // twice and the two passes would fight over the same chart canvases.
  if (window.location.hash) {
    await renderRoute();
  } else {
    window.location.hash = '#/dashboard';
  }

  refreshSync();
  setInterval(refreshStatus, 30_000);
  setInterval(refreshSync, 15_000);
}

boot();
