/** Shared UI helpers: escaping, money, toasts, modals, small DOM helpers. */

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function peso(cents) {
  const value = (Number(cents) || 0) / 100;
  return (
    '\u20B1' +
    value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function plainAmount(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2);
}

/** "25.50" (or "₱25.50") -> 2550 */
export function toCents(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function toast(message, type = 'ok') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = el(`<div class="toast toast--${type === 'error' ? 'err' : 'ok'}">${escapeHtml(message)}</div>`);
  host.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity 220ms ease, transform 220ms ease';
    node.style.opacity = '0';
    node.style.transform = 'translateX(20px)';
    setTimeout(() => node.remove(), 240);
  }, 3200);
}

/**
 * Open a modal. `render` receives the modal element and a `close` function.
 * Returns the modal element.
 */
export function modal({ title, body, actions = [], onMount }) {
  const backdrop = el(`<div class="modal-backdrop"></div>`);
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h3 class="card__title">${escapeHtml(title)}</h3>
        <button class="btn btn--ghost btn--sm" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">${body}</div>
      <div class="modal__actions"></div>
    </div>`;

  const close = () => {
    backdrop.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 160);
  };

  const actionHost = backdrop.querySelector('.modal__actions');
  for (const action of actions) {
    const button = el(`<button class="btn ${action.className || ''}">${escapeHtml(action.label)}</button>`);
    button.addEventListener('click', async () => {
      if (action.onClick) await action.onClick({ close, modal: backdrop });
    });
    actionHost.appendChild(button);
  }

  backdrop.querySelector('[data-close]').addEventListener('click', close);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });

  document.body.appendChild(backdrop);
  if (onMount) onMount(backdrop, close);
  return backdrop;
}

export function withSpinner(button, label) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> ${escapeHtml(label)}`;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
  };
}

export function formatDate(epochMs, withTime = false) {
  if (!epochMs) return '-';
  const date = new Date(Number(epochMs));
  const text = date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  if (!withTime) return text;
  return `${text} ${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Epoch ms -> "YYYY-MM-DD" for a date input. */
export function toDateInput(epochMs) {
  const date = epochMs ? new Date(Number(epochMs)) : new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" -> epoch ms at local noon (keeps the calendar date stable). */
export function fromDateInput(value) {
  return Date.parse(`${value}T12:00:00`);
}

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '');
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(','),
    )
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
