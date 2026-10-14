/** Customers - records, notes, order history and outstanding balance. */

import { del, get, post, put } from '../api.js';
import { escapeHtml, formatDate, modal, peso, toast } from '../ui.js';

const view = { customers: [], search: '' };

const STATUS_LABELS = {
  pending: 'Pending',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

function customerModal(existing, onDone) {
  const isEdit = Boolean(existing);
  modal({
    title: isEdit ? 'Edit customer' : 'Add customer',
    body: `
      <div class="field">
        <label class="field__label" for="c-name">Name</label>
        <input class="input" id="c-name" value="${escapeHtml(existing?.name ?? '')}" placeholder="Maria Santos" />
      </div>
      <div class="grid grid--2" style="gap: 0 14px">
        <div class="field">
          <label class="field__label" for="c-phone">Phone</label>
          <input class="input" id="c-phone" value="${escapeHtml(existing?.phone ?? '')}" placeholder="0917 000 0000" />
        </div>
        <div class="field">
          <label class="field__label" for="c-facebook">Facebook</label>
          <input class="input" id="c-facebook" value="${escapeHtml(existing?.facebook ?? '')}" />
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="c-address">Address</label>
        <input class="input" id="c-address" value="${escapeHtml(existing?.address ?? '')}" placeholder="Delivery address" />
      </div>
      <div class="field">
        <label class="field__label" for="c-notes">Notes</label>
        <textarea class="textarea" id="c-notes" placeholder="Gate code, preferred delivery time, reminders...">${escapeHtml(existing?.notes ?? '')}</textarea>
      </div>`,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: isEdit ? 'Save' : 'Add customer',
        className: 'btn--primary',
        onClick: async ({ close, modal: root }) => {
          const payload = {
            name: root.querySelector('#c-name').value,
            phone: root.querySelector('#c-phone').value,
            address: root.querySelector('#c-address').value,
            facebook: root.querySelector('#c-facebook').value,
            notes: root.querySelector('#c-notes').value,
          };
          if (!payload.name.trim()) {
            toast('Customer name is required', 'error');
            return;
          }
          try {
            if (isEdit) await put(`/customers/${existing.id}`, payload);
            else await post('/customers', payload);
            close();
            toast(isEdit ? 'Customer updated' : 'Customer added');
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => root.querySelector('#c-name')?.focus(),
  });
}

async function openDetail(id) {
  const data = await get(`/customers/${id}`);
  const { customer, orders } = data;

  modal({
    title: customer.name,
    body: `
      <div class="grid grid--2" style="gap: 0 14px">
        <div class="field"><span class="field__label">Phone</span><span>${escapeHtml(customer.phone ?? '-')}</span></div>
        <div class="field"><span class="field__label">Facebook</span><span>${escapeHtml(customer.facebook ?? '-')}</span></div>
      </div>
      <div class="field"><span class="field__label">Address</span><span>${escapeHtml(customer.address ?? '-')}</span></div>
      <div class="field">
        <span class="field__label">Balance</span>
        <span style="font-weight: 600; color: ${customer.balance_cents > 0 ? 'var(--red)' : 'var(--green)'}">
          ${peso(customer.balance_cents)}
        </span>
      </div>
      <div class="field">
        <span class="field__label">Notes</span>
        <div class="card" style="padding: 12px; font-size: 13px">${escapeHtml(customer.notes ?? 'No notes yet.')}</div>
      </div>
      <div class="field">
        <span class="field__label">Recent orders (${orders.length})</span>
        ${
          orders.length
            ? `<div class="table-wrap"><table class="table">
                 <thead><tr><th>When</th><th>Type</th><th class="num">Total</th><th>Payment</th></tr></thead>
                 <tbody>${orders
                   .map(
                     (order) => `<tr>
                       <td class="muted">${formatDate(order.placed_at)}</td>
                       <td>${escapeHtml(order.order_type)}</td>
                       <td class="num">${peso(order.total_cents)}</td>
                       <td><span class="badge">${escapeHtml(STATUS_LABELS[order.payment_status] ?? order.payment_status)}</span></td>
                     </tr>`,
                   )
                   .join('')}</tbody>
               </table></div>`
            : '<p class="muted">No orders yet.</p>'
        }
      </div>`,
    actions: [{ label: 'Close', className: 'btn--ghost', onClick: ({ close }) => close() }],
  });
}

function rowHtml(customer) {
  const owes = Number(customer.balance_cents) > 0;
  return `
    <tr data-id="${customer.id}">
      <td>
        <div style="font-weight: 600">${escapeHtml(customer.name)}</div>
        ${customer.notes ? `<div class="muted" style="font-size: 11.5px">${escapeHtml(String(customer.notes).slice(0, 46))}</div>` : ''}
      </td>
      <td class="muted">${escapeHtml(customer.phone ?? '-')}</td>
      <td class="muted">${escapeHtml(customer.address ?? '-')}</td>
      <td class="num muted">${customer.orders_count}</td>
      <td class="num" style="font-weight: 600; color: ${owes ? 'var(--red)' : 'inherit'}">${peso(customer.balance_cents)}</td>
      <td class="num">
        <button class="btn btn--sm" data-view>View</button>
        <button class="btn btn--sm" data-edit>Edit</button>
        <button class="btn btn--sm btn--danger" data-delete>Delete</button>
      </td>
    </tr>`;
}

export async function render(container) {
  container.innerHTML = `
    <section class="card">
      <div class="card__head">
        <div class="row">
          <h3 class="card__title">Customers</h3>
          <span class="badge" id="count">-</span>
        </div>
        <div class="row">
          <input class="input" id="search" placeholder="Search name, phone or address" style="width: 240px" />
          <button class="btn btn--primary" id="add">+ Add customer</button>
        </div>
      </div>
      <div id="list"></div>
    </section>`;

  const list = container.querySelector('#list');
  const count = container.querySelector('#count');

  async function load() {
    list.innerHTML = '<div class="skeleton" style="height: 150px; margin: 8px"></div>';
    try {
      const query = view.search ? `?search=${encodeURIComponent(view.search)}` : '';
      const data = await get(`/customers${query}`);
      view.customers = data.customers;
      count.textContent = `${data.customers.length} customer${data.customers.length === 1 ? '' : 's'}`;

      if (!data.customers.length) {
        list.innerHTML = `
          <div class="empty">
            <div class="empty__icon">👥</div>
            <p>No customers yet. Click <strong>Add customer</strong>, or they will appear automatically from web orders.</p>
          </div>`;
        return;
      }

      list.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th class="num">Orders</th><th class="num">Balance</th><th></th></tr></thead>
            <tbody>${data.customers.map(rowHtml).join('')}</tbody>
          </table>
        </div>`;

      list.querySelectorAll('tr[data-id]').forEach((row) => {
        const customer = view.customers.find((item) => item.id === row.dataset.id);
        row.querySelector('[data-view]').addEventListener('click', () => openDetail(customer.id));
        row.querySelector('[data-edit]').addEventListener('click', () => customerModal(customer, load));
        row.querySelector('[data-delete]').addEventListener('click', () => {
          modal({
            title: 'Delete customer',
            body: `<p>Delete <strong>${escapeHtml(customer.name)}</strong>? Their past orders are kept.</p>`,
            actions: [
              { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
              {
                label: 'Delete',
                className: 'btn--danger',
                onClick: async ({ close }) => {
                  try {
                    await del(`/customers/${customer.id}`);
                    close();
                    toast('Customer deleted');
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
    } catch (error) {
      list.innerHTML = `<div class="empty" style="color: var(--red)">${escapeHtml(error.message)}</div>`;
    }
  }

  let timer;
  container.querySelector('#search').addEventListener('input', (event) => {
    view.search = event.target.value;
    clearTimeout(timer);
    timer = setTimeout(load, 220);
  });

  container.querySelector('#add').addEventListener('click', () => customerModal(null, load));

  await load();
}
