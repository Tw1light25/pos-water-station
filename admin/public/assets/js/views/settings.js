/**
 * Settings - business identity, store status and operating hours.
 * Everything here drives the customer landing page, the receipt and the
 * automatic open/closed status.
 */

import { get, post, put } from '../api.js';
import { checkForUpdate, onUpdateAvailable } from '../app.js';
import { escapeHtml, formatDate, toCents, plainAmount, toast, withSpinner } from '../ui.js';
import { normalizeHours, computeStoreStatus, describeStatus, formatTime12 } from '/shared/store-status.js';

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

const OVERRIDES = [
  ['auto', 'Automatic - follow operating hours'],
  ['force_open', 'Force open - ignore hours'],
  ['force_closed', 'Force closed - ignore hours'],
];

const field = (label, name, value, { type = 'text', hint = '', placeholder = '' } = {}) => `
  <div class="field">
    <label class="field__label" for="${name}">${label}</label>
    <input class="input" id="${name}" name="${name}" type="${type}" value="${escapeHtml(value ?? '')}"
      placeholder="${escapeHtml(placeholder)}" />
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </div>`;

export async function render(container, { state, refreshShell }) {
  const settings = state.settings ?? {};
  const hours = normalizeHours(settings.hours_json);

  container.innerHTML = `
    <form id="settings-form" novalidate>
      <div class="grid grid--2">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">Business identity</h3>
            <span class="card__hint">Shown on the landing page and receipt</span>
          </div>
          ${field('Business name', 'business_name', settings.business_name, { placeholder: 'Water Station' })}
          ${field('Tagline', 'tagline', settings.tagline, { placeholder: 'Purified drinking water, delivered' })}
          ${field('Logo image URL', 'logo_url', settings.logo_url, {
            placeholder: 'https://.../logo.png',
            hint: 'Paste a public image link. Leave empty to use the built-in droplet.',
          })}
          <div class="field">
            <label class="field__label" for="description">Description</label>
            <textarea class="textarea" id="description" name="description"
              placeholder="A short paragraph shown on the landing page">${escapeHtml(settings.description ?? '')}</textarea>
          </div>
          ${field('Address', 'address', settings.address, { placeholder: '123 Main Street, Barangay ...' })}
          <div class="grid grid--2" style="gap: 0 14px">
            ${field('Phone', 'phone', settings.phone, { placeholder: '0917 000 0000' })}
            ${field('Facebook', 'facebook', settings.facebook, { placeholder: 'https://facebook.com/yourpage' })}
          </div>
          ${field('Email', 'email', settings.email, { type: 'email', placeholder: 'hello@example.com' })}
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">Store status</h3>
            <span id="status-preview" class="badge"></span>
          </div>
          <div class="field">
            <span class="field__label">Quick toggle</span>
            <button type="button" class="switch" id="quick-open" role="switch" aria-checked="false">
              <span class="switch__track"></span>
              <span id="quick-open-label" style="font-weight: 600">Open</span>
            </button>
            <span class="field__hint">
              Switches the shop open or closed right away. Choose <strong>Automatic</strong> below to follow the operating hours again.
            </span>
          </div>
          <div class="field">
            <label class="field__label" for="store_override">Mode</label>
            <select class="select" id="store_override" name="store_override">
              ${OVERRIDES.map(
                ([value, label]) =>
                  `<option value="${value}" ${settings.store_override === value ? 'selected' : ''}>${label}</option>`,
              ).join('')}
            </select>
            <span class="field__hint">Use "Force open/closed" to override the schedule for today.</span>
          </div>
          <div class="field">
            <label class="field__label" for="closed_message">Message when closed</label>
            <textarea class="textarea" id="closed_message" name="closed_message"
              placeholder="We are closed right now - order now and we will deliver as soon as we open.">${escapeHtml(settings.closed_message ?? '')}</textarea>
          </div>
          ${field('Timezone', 'timezone', settings.timezone, {
            placeholder: 'Asia/Manila',
            hint: 'IANA timezone used to evaluate the operating hours.',
          })}
          <div class="grid grid--2" style="gap: 0 14px">
            ${field('Default delivery fee (₱)', 'delivery_fee', plainAmount(settings.delivery_fee_cents), { type: 'number' })}
            <div class="field">
              <span class="field__label">Currency</span>
              <div class="input" style="color: var(--muted)">₱ Philippine Peso (PHP)</div>
              <span class="field__hint">All amounts are stored as integer centavos.</span>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="receipt_footer">Receipt footer</label>
            <input class="input" id="receipt_footer" name="receipt_footer"
              value="${escapeHtml(settings.receipt_footer ?? '')}" placeholder="Thank you for your order!" />
          </div>
        </section>
      </div>

      <section class="card" style="margin-top: 16px">
        <div class="card__head">
          <h3 class="card__title">Operating hours</h3>
          <span class="card__hint">Drives the automatic open/closed status</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Day</th><th>Closed</th><th>Opens</th><th>Closes</th><th>Summary</th></tr>
            </thead>
            <tbody>
              ${DAYS.map(([key, label]) => {
                const day = hours[key];
                return `<tr data-day="${key}">
                  <td>${label}</td>
                  <td>
                    <label class="switch">
                      <input type="checkbox" data-closed ${day.closed ? 'checked' : ''} />
                      <span class="switch__track"></span>
                    </label>
                  </td>
                  <td><input class="input" type="time" data-open value="${day.open}" style="width: 130px" /></td>
                  <td><input class="input" type="time" data-close value="${day.close}" style="width: 130px" /></td>
                  <td class="muted" data-summary></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <div style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px">
        <button class="btn btn--primary" type="submit" id="save">Save changes</button>
      </div>
    </form>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <h3 class="card__title">App updates</h3>
        <span class="card__hint">New versions come from the developer's releases</span>
      </div>
      <div id="update-body">
        <p class="muted">Checking for updates...</p>
      </div>
    </section>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <h3 class="card__title">Account</h3>
        <span class="card__hint">Changes the owner sign-in password</span>
      </div>
      <div class="grid grid--3" style="gap: 0 14px">
        <div class="field">
          <label class="field__label" for="pw-current">Current password</label>
          <input class="input" id="pw-current" type="password" autocomplete="current-password" />
        </div>
        <div class="field">
          <label class="field__label" for="pw-new">New password</label>
          <input class="input" id="pw-new" type="password" autocomplete="new-password" />
          <span class="field__hint">At least ${8} characters.</span>
        </div>
        <div class="field">
          <label class="field__label" for="pw-confirm">Confirm new password</label>
          <input class="input" id="pw-confirm" type="password" autocomplete="new-password" />
        </div>
      </div>
      <div id="pw-error" class="alert alert--error hidden" style="margin-bottom: 12px"></div>
      <div class="row" style="justify-content: flex-end">
        <button class="btn btn--primary" type="button" id="pw-save">Change password</button>
      </div>
    </section>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <div>
          <h3 class="card__title">Backups</h3>
          <span class="card__hint">Automatic safety copies of this PC's data</span>
        </div>
        <button class="btn btn--sm btn--primary" type="button" id="backup-now">Back up now</button>
      </div>
      <div id="backup-body"><div class="skeleton" style="height: 90px"></div></div>
    </section>`;

  const form = container.querySelector('#settings-form');
  const preview = container.querySelector('#status-preview');

  function collectHours() {
    const result = {};
    for (const [key] of DAYS) {
      const row = form.querySelector(`tr[data-day="${key}"]`);
      result[key] = {
        closed: row.querySelector('[data-closed]').checked,
        open: row.querySelector('[data-open]').value || '08:00',
        close: row.querySelector('[data-close]').value || '18:00',
      };
    }
    return result;
  }

  function refreshPreview() {
    const draft = collectHours();
    const override = form.querySelector('#store_override').value;
    const timezone = form.querySelector('#timezone').value.trim() || 'Asia/Manila';
    const status = computeStoreStatus({ override, hours: draft, timezone });
    preview.className = `badge ${status.isOpen ? 'badge--green' : 'badge--red'}`;
    preview.textContent = status.isOpen ? 'Open now' : 'Closed now';

    const quick = form.querySelector('#quick-open');
    if (quick) {
      // A button-based switch: no native checkbox state to race with, so it is
      // always safe to re-derive the visual from the current mode.
      quick.classList.toggle('is-on', status.isOpen);
      quick.setAttribute('aria-checked', status.isOpen ? 'true' : 'false');
      quick.dataset.open = status.isOpen ? 'true' : 'false';
      const quickLabel = form.querySelector('#quick-open-label');
      quickLabel.textContent = status.isOpen ? 'Open' : 'Closed';
      quickLabel.style.color = status.isOpen ? 'var(--green)' : 'var(--red)';
    }

    for (const [key, label] of DAYS) {
      const row = form.querySelector(`tr[data-day="${key}"]`);
      const day = draft[key];
      const summary = row.querySelector('[data-summary]');
      if (day.closed) summary.textContent = 'Closed all day';
      else summary.textContent = `${formatTime12(day.open)} - ${formatTime12(day.close)}`;
      void label;

      row.querySelectorAll('input[type="time"]').forEach((input) => {
        input.disabled = day.closed;
        input.style.opacity = day.closed ? '0.45' : '1';
      });
    }
  }

  form.addEventListener('input', refreshPreview);
  form.addEventListener('change', refreshPreview);
  refreshPreview();

  // Quick open/close switch: applies immediately (like the topbar chip).
  const quickToggle = form.querySelector('#quick-open');
  quickToggle.addEventListener('click', async () => {
    const isOpen = quickToggle.dataset.open === 'true';
    const value = isOpen ? 'force_closed' : 'force_open';
    form.querySelector('#store_override').value = value;
    refreshPreview();

    try {
      const data = await put('/settings', { store_override: value });
      state.settings = data.settings;
      await refreshShell();
      refreshPreview();
      toast(value === 'force_open' ? 'Store is now OPEN' : 'Store is now CLOSED');
    } catch (error) {
      toast(error.message, 'error');
      refreshPreview();
    }
  });

  // Account: change the owner password.
  const pwButton = container.querySelector('#pw-save');
  const pwError = container.querySelector('#pw-error');

  const showPwError = (message) => {
    pwError.textContent = message;
    pwError.classList.toggle('hidden', !message);
  };

  pwButton.addEventListener('click', async () => {
    showPwError('');
    const current = container.querySelector('#pw-current').value;
    const next = container.querySelector('#pw-new').value;
    const confirm = container.querySelector('#pw-confirm').value;

    if (!current || !next) return showPwError('Enter your current and new password.');
    if (next.length < 8) return showPwError('New password must be at least 8 characters.');
    if (next !== confirm) return showPwError('The new passwords do not match.');

    const restore = withSpinner(pwButton, 'Saving');
    try {
      await put('/account/password', { current_password: current, new_password: next });
      for (const id of ['#pw-current', '#pw-new', '#pw-confirm']) container.querySelector(id).value = '';
      toast('Password changed');
    } catch (error) {
      showPwError(error.message);
    } finally {
      restore();
    }
  });

  // Backups: status + a manual snapshot.
  const backupBody = container.querySelector('#backup-body');
  const backupButton = container.querySelector('#backup-now');

  const ago = (ts) => {
    if (!ts) return 'never';
    const minutes = Math.round((Date.now() - ts) / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const sizeLabel = (bytes) => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  };

  async function loadBackups() {
    try {
      const { backup } = await get('/backup');

      if (!backup.enabled) {
        backupBody.innerHTML = '<p class="muted">Automatic backups are switched off (BACKUP_ENABLED=false).</p>';
        return;
      }

      const stats = [
        ['Last backup', ago(backup.lastBackupAt)],
        ['Snapshots kept', `${backup.count} of ${backup.keep}`],
        ['Disk used', sizeLabel(backup.totalBytes)],
        ['Since last backup', `${backup.changesSince} change(s)`],
      ];

      backupBody.innerHTML = `
        <div class="grid grid--4">
          ${stats
            .map(
              ([label, value]) => `
            <div><div class="stat">
              <span class="stat__label">${label}</span>
              <span class="stat__value" style="font-size: 17px">${value}</span>
            </div></div>`,
            )
            .join('')}
        </div>

        ${
          backup.lastError
            ? `<div class="alert alert--error" style="margin-top: 14px">Last backup failed: ${escapeHtml(backup.lastError)}</div>`
            : ''
        }

        <p class="field__hint" style="margin-top: 14px">
          Writes a snapshot after every ${backup.everyTransactions} transactions,
          or every ${backup.intervalMinutes} minutes if anything changed — and when the
          admin starts or stops. Nothing new means no new file.
        </p>

        ${
          backup.recent.length
            ? `<div class="table-wrap" style="margin-top: 10px">
                 <table class="table">
                   <thead><tr><th>Snapshot</th><th>When</th><th class="num">Size</th></tr></thead>
                   <tbody>${backup.recent
                     .map(
                       (file) => `<tr>
                         <td class="mono" style="font-size: 12px">${escapeHtml(file.name)}</td>
                         <td class="muted">${formatDate(file.at, true)}</td>
                         <td class="num">${sizeLabel(file.size)}</td>
                       </tr>`,
                     )
                     .join('')}</tbody>
                 </table>
               </div>`
            : '<p class="muted" style="margin-top: 10px">No snapshots yet — the first one is written as soon as there is something to save.</p>'
        }

        <p class="field__hint" style="margin-top: 10px">
          Folder: <span class="mono">${escapeHtml(backup.directory)}</span>
        </p>`;
    } catch (error) {
      backupBody.innerHTML = `<p style="color: var(--red)">${escapeHtml(error.message)}</p>`;
    }
  }

  backupButton.addEventListener('click', async () => {
    const restore = withSpinner(backupButton, 'Saving');
    try {
      const data = await post('/backup/now');
      toast(`Backup written: ${data.result.name} (${data.result.sizeLabel})`);
      await loadBackups();
    } catch (error) {
      toast(error.message, 'error');
      await loadBackups();
    } finally {
      restore();
    }
  });

  await loadBackups();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('#save');
    const restore = withSpinner(button, 'Saving');

    const payload = {
      business_name: form.querySelector('#business_name').value,
      tagline: form.querySelector('#tagline').value,
      logo_url: form.querySelector('#logo_url').value,
      description: form.querySelector('#description').value,
      address: form.querySelector('#address').value,
      phone: form.querySelector('#phone').value,
      facebook: form.querySelector('#facebook').value,
      email: form.querySelector('#email').value,
      store_override: form.querySelector('#store_override').value,
      closed_message: form.querySelector('#closed_message').value,
      timezone: form.querySelector('#timezone').value,
      delivery_fee_cents: toCents(form.querySelector('#delivery_fee').value),
      receipt_footer: form.querySelector('#receipt_footer').value,
      hours_json: collectHours(),
    };

    try {
      const data = await put('/settings', payload);
      state.settings = data.settings;
      await refreshShell();
      refreshPreview();
      toast('Settings saved');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });

  // Not awaited: the card paints itself once the check answers.
  wireUpdates(container, { isCurrent });
}

/**
 * The "App updates" card: current version, what is on the server, and a button
 * that only works when there is something to install.
 *
 * Updates are never automatic - the shop decides when to restart.
 */
async function wireUpdates(container, { isCurrent }) {
  const body = container.querySelector('#update-body');
  if (!body) return;

  const paint = (info) => {
    if (!isCurrent()) return;
    const current = escapeHtml(info?.current ?? '-');
    const latest = info?.latest ? escapeHtml(info.latest) : null;

    if (info?.readyToRestart) {
      body.innerHTML = `
        <div class="alert">Version ${latest} is downloaded. Close and reopen the POS to finish installing.</div>
        <p class="muted">Current version: ${current}</p>`;
      return;
    }

    if (info?.updateAvailable) {
      body.innerHTML = `
        <div class="row-between" style="margin-bottom: 10px">
          <span>Current version: <strong>${current}</strong></span>
          <span class="badge badge--green">${latest} available</span>
        </div>
        ${info.notes ? `<div class="alert" style="white-space: pre-wrap">${escapeHtml(info.notes)}</div>` : ''}
        ${info.pending ? `<p class="muted">${info.pending} change(s) are still sending to the database. They finish after the restart - nothing is lost.</p>` : ''}
        <button class="btn btn--primary" type="button" id="update-now">Update now</button>
        <p class="field__hint" style="margin-top: 8px">The POS closes and reopens by itself. Any order form on screen that you have not saved will be cleared.</p>`;
      const button = body.querySelector('#update-now');
      button?.addEventListener('click', async () => {
        const open = document.querySelector('.modal');
        if (open) {
          toast('Save or close the open form first', 'error');
          return;
        }
        button.disabled = true;
        button.textContent = 'Starting update...';
        try {
          await post('/update/apply');
          button.textContent = 'Restarting...';
          toast('Update started - the POS will reopen in a moment');
        } catch (error) {
          toast(error.message, 'error');
          button.disabled = false;
          button.textContent = 'Update now';
        }
      });
      return;
    }

    body.innerHTML = `
      <div class="row-between">
        <span>Current version: <strong>${current}</strong>${latest ? ` - latest is <strong>${latest}</strong>` : ''}</span>
        <button class="btn btn--sm" type="button" id="update-check">Check again</button>
      </div>
      <p class="muted" style="margin-top: 8px">${
        info?.error ? `Could not check for updates: ${escapeHtml(info.error)}` : 'You are running the latest version.'
      }</p>`;
    body.querySelector('#update-check')?.addEventListener('click', async () => {
      const info = await checkForUpdate();
      paint(info);
    });
  };

  const { checkForUpdate, onUpdateAvailable } = await import('../app.js');
  onUpdateAvailable(paint);
}
