/** Shared header / footer rendering, driven by the store settings. */

const DROPLET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
  <path d="M12 2.6c3.4 4.2 6 7.5 6 10.7a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.7Z" stroke-linejoin="round"/>
  <path d="M9.4 13.6c0 1.6 1.2 2.8 2.6 3" stroke-linecap="round"/>
</svg>`;

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function peso(cents) {
  const value = (Number(cents) || 0) / 100;
  return (
    '\u20B1' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function logoMark(settings) {
  if (settings?.logo_url) {
    return `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.business_name ?? '')}" />`;
  }
  return DROPLET;
}

export function renderHeader(settings, active = '') {
  const host = document.getElementById('header');
  if (!host) return;
  const name = settings?.business_name ?? 'Water Station';
  const tagline = settings?.tagline ?? 'Purified drinking water';

  host.className = 'header';
  host.innerHTML = `
    <div class="wrap header__inner">
      <a class="brand" href="/">
        <span class="brand__logo">${logoMark(settings)}</span>
        <span style="min-width: 0">
          <span class="brand__name">${escapeHtml(name)}</span><br />
          <span class="brand__tag">${escapeHtml(tagline)}</span>
        </span>
      </a>
      <nav class="header__nav">
        <a class="navlink ${active === 'order' ? 'is-active' : ''}" href="/order">Order</a>
        <a class="navlink ${active === 'track' ? 'is-active' : ''}" href="/track">Track</a>
      </nav>
    </div>`;
}

export function renderFooter(settings) {
  const host = document.getElementById('footer');
  if (!host) return;
  const name = settings?.business_name ?? 'Water Station';
  host.className = 'footer';
  host.innerHTML = `
    <div class="wrap">
      ${escapeHtml(name)}${settings?.address ? ` &middot; ${escapeHtml(settings.address)}` : ''}
      ${settings?.phone ? ` &middot; ${escapeHtml(settings.phone)}` : ''}
    </div>`;
}

/** A friendly, offline-aware error card. */
export function errorCard(message) {
  return `
    <div class="card animate">
      <div class="empty">
        <div class="empty__icon">📡</div>
        <h3 style="margin-bottom: 6px">Can't reach the shop right now</h3>
        <p class="muted" style="max-width: 42ch; margin: 0 auto 14px">${escapeHtml(message)}</p>
        <button class="btn" onclick="location.reload()">Try again</button>
      </div>
    </div>`;
}
