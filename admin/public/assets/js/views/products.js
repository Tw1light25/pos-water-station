/** Products - catalogue with fixed prices and reorder levels. */

import { del, get, post, put } from '../api.js';
import { escapeHtml, modal, peso, plainAmount, toCents, toast, withSpinner } from '../ui.js';

const view = { products: [], search: '', showInactive: false };

function stockBadge(product) {
  const onHand = Number(product.on_hand) || 0;
  const reorder = Number(product.reorder_level) || 0;
  if (onHand <= 0) return `<span class="badge badge--red">Out (${onHand})</span>`;
  if (reorder > 0 && onHand <= reorder) return `<span class="badge badge--yellow">Low (${onHand})</span>`;
  return `<span class="badge badge--green">${onHand}</span>`;
}

function rowHtml(product) {
  return `
    <tr data-id="${product.id}">
      <td>
        <div style="font-weight:600">${escapeHtml(product.name)}</div>
        ${product.category ? `<div class="muted" style="font-size:11.5px">${escapeHtml(product.category)}</div>` : ''}
      </td>
      <td class="muted">${escapeHtml(product.unit)}</td>
      <td class="num">${peso(product.price_cents)}</td>
      <td>${stockBadge(product)}</td>
      <td class="num muted">${Number(product.reorder_level) || 0}</td>
      <td>${product.active ? '<span class="badge badge--blue">Active</span>' : '<span class="badge">Inactive</span>'}</td>
      <td class="num">
        <button class="btn btn--sm" data-edit>Edit</button>
        <button class="btn btn--sm btn--danger" data-delete>Delete</button>
      </td>
    </tr>`;
}

function openProductModal(existing, onSaved) {
  const isEdit = Boolean(existing);
  const body = `
    <div class="field">
      <label class="field__label" for="p-name">Name</label>
      <input class="input" id="p-name" value="${escapeHtml(existing?.name ?? '')}" placeholder="5-Gallon Refill" />
    </div>
    <div class="grid grid--2" style="gap: 0 14px">
      <div class="field">
        <label class="field__label" for="p-category">Category</label>
        <input class="input" id="p-category" value="${escapeHtml(existing?.category ?? '')}" placeholder="Refill" />
      </div>
      <div class="field">
        <label class="field__label" for="p-unit">Unit</label>
        <input class="input" id="p-unit" value="${escapeHtml(existing?.unit ?? 'container')}" placeholder="container" />
      </div>
    </div>
    <div class="grid grid--2" style="gap: 0 14px">
      <div class="field">
        <label class="field__label" for="p-price">Price (₱)</label>
        <input class="input" id="p-price" type="number" step="0.01" min="0"
          value="${plainAmount(existing?.price_cents ?? 0)}" />
        ${
          isEdit
            ? '<span class="field__hint">Only affects future orders — past orders keep the price they were sold at.</span>'
            : ''
        }
      </div>
      <div class="field">
        <label class="field__label" for="p-reorder">Low-stock level</label>
        <input class="input" id="p-reorder" type="number" min="0" value="${Number(existing?.reorder_level) || 0}" />
      </div>
    </div>
    ${
      isEdit
        ? ''
        : `<div class="field">
             <label class="field__label" for="p-stock">Opening stock</label>
             <input class="input" id="p-stock" type="number" value="0" />
             <span class="field__hint">Recorded as the first entry in the stock ledger.</span>
           </div>`
    }
    <label class="switch" style="margin-top: 4px">
      <input type="checkbox" id="p-active" ${existing?.active === false ? '' : 'checked'} />
      <span class="switch__track"></span>
      <span>Active (visible to customers)</span>
    </label>`;

  modal({
    title: isEdit ? 'Edit product' : 'Add product',
    body,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: isEdit ? 'Save' : 'Create',
        className: 'btn--primary',
        onClick: async ({ close, modal: root }) => {
          const payload = {
            name: root.querySelector('#p-name').value,
            category: root.querySelector('#p-category').value,
            unit: root.querySelector('#p-unit').value,
            price_cents: toCents(root.querySelector('#p-price').value),
            reorder_level: Math.round(Number(root.querySelector('#p-reorder').value) || 0),
            active: root.querySelector('#p-active').checked,
          };
          if (!payload.name.trim()) {
            toast('Product name is required', 'error');
            return;
          }
          if (!isEdit) payload.initial_stock = Math.round(Number(root.querySelector('#p-stock').value) || 0);

          try {
            const data = isEdit
              ? await put(`/products/${existing.id}`, payload)
              : await post('/products', payload);
            close();
            toast(isEdit ? 'Product updated' : 'Product created');
            onSaved(data.product);
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => {
      root.querySelector('.modal__body input')?.focus();
    },
  });
}

export async function render(container) {
  container.innerHTML = `
    <section class="card">
      <div class="card__head">
        <div class="row">
          <h3 class="card__title">Products</h3>
          <span class="badge" id="count">-</span>
        </div>
        <div class="row">
          <input class="input" id="search" placeholder="Search name or category" style="width: 220px" />
          <label class="switch">
            <input type="checkbox" id="show-inactive" />
            <span class="switch__track"></span>
            <span class="muted" style="font-size: 12px">Show inactive</span>
          </label>
          <button class="btn btn--primary" id="add">+ Add product</button>
        </div>
      </div>
      <div id="list"></div>
    </section>`;

  const list = container.querySelector('#list');
  const count = container.querySelector('#count');

  async function load() {
    list.innerHTML = '<div class="skeleton" style="height: 160px; margin: 8px"></div>';
    try {
      const query = new URLSearchParams();
      if (view.search) query.set('search', view.search);
      if (view.showInactive) query.set('all', '1');
      const data = await get(`/products?${query.toString()}`);
      view.products = data.products;
      count.textContent = `${data.products.length} item${data.products.length === 1 ? '' : 's'}`;
      renderList();
    } catch (error) {
      list.innerHTML = `<div class="empty" style="color: var(--red)">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderList() {
    if (!view.products.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty__icon">📦</div>
          <p>No products yet. Click <strong>Add product</strong> to create your first one.</p>
        </div>`;
      return;
    }

    list.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Product</th><th>Unit</th><th class="num">Price</th>
              <th>Stock</th><th class="num">Low at</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>${view.products.map(rowHtml).join('')}</tbody>
        </table>
      </div>`;

    list.querySelectorAll('tr[data-id]').forEach((row) => {
      const product = view.products.find((item) => item.id === row.dataset.id);
      row.querySelector('[data-edit]')?.addEventListener('click', () => {
        openProductModal(product, () => load());
      });
      row.querySelector('[data-delete]')?.addEventListener('click', () => {
        modal({
          title: 'Delete product',
          body: `<p>Delete <strong>${escapeHtml(product.name)}</strong>? It will be hidden from the catalogue and the customer site. Past orders keep their records.</p>`,
          actions: [
            { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
            {
              label: 'Delete',
              className: 'btn--danger',
              onClick: async ({ close }) => {
                try {
                  await del(`/products/${product.id}`);
                  close();
                  toast('Product deleted');
                  load();
                } catch (error) {
                  toast(error.message, 'error');
                }
              },
            },
          ],
        });
      });
    });
  }

  let timer;
  container.querySelector('#search').addEventListener('input', (event) => {
    view.search = event.target.value;
    clearTimeout(timer);
    timer = setTimeout(load, 220);
  });

  container.querySelector('#show-inactive').addEventListener('change', (event) => {
    view.showInactive = event.target.checked;
    load();
  });

  container.querySelector('#add').addEventListener('click', () => {
    openProductModal(null, () => load());
  });

  await load();
}
