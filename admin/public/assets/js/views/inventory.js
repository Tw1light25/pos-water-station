/** Inventory - stock levels from the ledger, receiving and adjustments. */

import { del, get, post } from '../api.js';
import { escapeHtml, modal, peso, formatDate, toast } from '../ui.js';

const REASON_LABELS = {
  receive: 'Received',
  sale: 'Sold',
  adjustment: 'Adjustment',
  return: 'Returned',
  damage: 'Damaged',
  initial: 'Opening',
};

const view = { items: [], movements: [], filter: '' };

function reasonBadge(reason) {
  const colors = { receive: 'green', sale: 'blue', adjustment: 'yellow', return: 'purple', damage: 'red', initial: 'blue' };
  return `<span class="badge badge--${colors[reason] ?? ''}">${escapeHtml(REASON_LABELS[reason] ?? reason)}</span>`;
}

function adjustModal(product, onDone) {
  const isReceive = !product;
  const options = view.items
    .map(
      (item) =>
        `<option value="${item.id}" ${product && item.id === product.id ? 'selected' : ''}>${escapeHtml(item.name)} (${item.on_hand} ${escapeHtml(item.unit)})</option>`,
    )
    .join('');

  modal({
    title: isReceive ? 'Receive stock' : `Adjust ${product.name}`,
    body: `
      ${isReceive ? `<div class="field"><label class="field__label" for="m-product">Product</label><select class="select" id="m-product">${options}</select></div>` : ''}
      <div class="grid grid--2" style="gap: 0 14px">
        <div class="field">
          <label class="field__label" for="m-qty">Change (use - to remove)</label>
          <input class="input" id="m-qty" type="number" placeholder="e.g. 24 or -3" />
        </div>
        <div class="field">
          <label class="field__label" for="m-reason">Reason</label>
          <select class="select" id="m-reason">
            ${Object.entries(REASON_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${value === (isReceive ? 'receive' : 'adjustment') ? 'selected' : ''}>${label}</option>`,
              )
              .join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="m-note">Note</label>
        <input class="input" id="m-note" placeholder="Optional" />
      </div>`,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: isReceive ? 'Add stock' : 'Save',
        className: 'btn--primary',
        onClick: async ({ close, modal: root }) => {
          const payload = {
            product_id: isReceive ? root.querySelector('#m-product').value : product.id,
            change_qty: Math.round(Number(root.querySelector('#m-qty').value) || 0),
            reason: root.querySelector('#m-reason').value,
            note: root.querySelector('#m-note').value,
          };
          if (!payload.change_qty) {
            toast('Enter a non-zero quantity', 'error');
            return;
          }
          try {
            await post('/inventory/movements', payload);
            close();
            toast('Stock updated');
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => root.querySelector('#m-qty')?.focus(),
  });
}

export async function render(container) {
  container.innerHTML = `
    <div class="grid grid--4" id="summary"></div>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <h3 class="card__title">Stock levels</h3>
        <div class="row">
          <select class="select" id="filter" style="width: 220px">
            <option value="">All products</option>
          </select>
          <button class="btn btn--primary" id="receive">+ Receive stock</button>
        </div>
      </div>
      <div id="stock"></div>
    </section>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <h3 class="card__title">Recent movements</h3>
        <button class="btn btn--sm btn--ghost" id="refresh">Refresh</button>
      </div>
      <div id="movements"></div>
    </section>`;

  const summary = container.querySelector('#summary');
  const stock = container.querySelector('#stock');
  const movements = container.querySelector('#movements');
  const filter = container.querySelector('#filter');

  async function load() {
    stock.innerHTML = '<div class="skeleton" style="height: 140px; margin: 8px"></div>';
    try {
      const data = await get('/inventory');
      view.items = data.items;

      const lowStock = data.items.filter(
        (item) => item.active && item.reorder_level > 0 && item.on_hand <= item.reorder_level,
      );
      summary.innerHTML = [
        ['Products', data.summary.products],
        ['Units in stock', data.summary.units],
        ['Stock value', peso(data.summary.stock_value_cents)],
        ['Low / out', `${data.summary.low_stock} / ${data.summary.out_of_stock}`],
      ]
        .map(
          ([label, value]) => `
          <div class="card card--hover">
            <div class="stat">
              <span class="stat__label">${label}</span>
              <span class="stat__value">${value}</span>
            </div>
          </div>`,
        )
        .join('');

      const selected = filter.value;
      filter.innerHTML =
        `<option value="">All products</option>` +
        data.items
          .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
          .join('');
      filter.value = selected;

      renderStock(lowStock);
      await loadMovements();
    } catch (error) {
      stock.innerHTML = `<div class="empty" style="color: var(--red)">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderStock(lowStock) {
    if (!view.items.length) {
      stock.innerHTML = '<div class="empty"><p class="muted">No products yet. Add them in the Products tab.</p></div>';
      return;
    }

    const rows = view.items
      .map((item) => {
        const low = item.active && item.reorder_level > 0 && item.on_hand <= item.reorder_level;
        return `
        <tr data-id="${item.id}">
          <td>
            <div style="font-weight: 600">${escapeHtml(item.name)}</div>
            <div class="muted" style="font-size: 11.5px">${escapeHtml(item.category ?? item.unit)}</div>
          </td>
          <td><span class="badge ${item.on_hand <= 0 ? 'badge--red' : low ? 'badge--yellow' : 'badge--green'}">${item.on_hand}</span></td>
          <td class="num muted">${item.reorder_level}</td>
          <td class="num">${peso(item.stock_value_cents)}</td>
          <td class="num"><button class="btn btn--sm" data-adjust>Adjust</button></td>
        </tr>`;
      })
      .join('');

    stock.innerHTML = `
      ${lowStock.length ? `<div class="badge badge--yellow" style="margin-bottom: 10px">⚠ ${lowStock.length} product(s) at or below the low-stock level</div>` : ''}
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Product</th><th>On hand</th><th class="num">Low at</th><th class="num">Value</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    stock.querySelectorAll('tr[data-id]').forEach((row) => {
      const item = view.items.find((entry) => entry.id === row.dataset.id);
      row.querySelector('[data-adjust]').addEventListener('click', () => adjustModal(item, load));
    });
  }

  async function loadMovements() {
    const query = view.filter ? `?product_id=${encodeURIComponent(view.filter)}` : '';
    const data = await get(`/inventory/movements${query}`);
    view.movements = data.movements;

    if (!data.movements.length) {
      movements.innerHTML = '<div class="empty"><p class="muted">No stock movements yet.</p></div>';
      return;
    }

    movements.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>When</th><th>Product</th><th class="num">Change</th><th>Reason</th><th>Note</th><th></th></tr></thead>
          <tbody>
            ${data.movements
              .map(
                (movement) => `
              <tr data-mid="${movement.id}">
                <td class="muted">${formatDate(movement.created_at, true)}</td>
                <td>${escapeHtml(movement.product_name ?? '(deleted product)')}</td>
                <td class="num" style="color: ${movement.change_qty < 0 ? 'var(--red)' : 'var(--green)'}; font-weight: 600">
                  ${movement.change_qty > 0 ? '+' : ''}${movement.change_qty}
                </td>
                <td>${reasonBadge(movement.reason)}</td>
                <td class="muted">${escapeHtml(movement.note ?? '')}</td>
                <td class="num"><button class="btn btn--sm btn--danger" data-undo>Undo</button></td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    movements.querySelectorAll('tr[data-mid]').forEach((row) => {
      row.querySelector('[data-undo]').addEventListener('click', async () => {
        try {
          await del(`/inventory/movements/${row.dataset.mid}`);
          toast('Movement undone');
          load();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  }

  filter.addEventListener('change', async () => {
    view.filter = filter.value;
    await loadMovements();
  });

  container.querySelector('#receive').addEventListener('click', () => adjustModal(null, load));
  container.querySelector('#refresh').addEventListener('click', load);

  await load();
}
