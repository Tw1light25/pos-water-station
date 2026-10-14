/** Expenses - free-form outgoing money, with CSV export. */

import { del, get, post, put } from '../api.js';
import {
  downloadCsv,
  escapeHtml,
  formatDate,
  fromDateInput,
  modal,
  peso,
  plainAmount,
  toCents,
  toDateInput,
  toast,
} from '../ui.js';

const view = { expenses: [], categories: [], search: '', category: '' };

function expenseModal(existing, categories, onDone) {
  const isEdit = Boolean(existing);
  const body = `
    <div class="field">
      <label class="field__label" for="e-desc">What was it for?</label>
      <input class="input" id="e-desc" value="${escapeHtml(existing?.description ?? '')}" placeholder="Pump maintenance" />
    </div>
    <div class="grid grid--2" style="gap: 0 14px">
      <div class="field">
        <label class="field__label" for="e-amount">Amount (₱)</label>
        <input class="input" id="e-amount" type="number" step="0.01" min="0" value="${plainAmount(existing?.amount_cents ?? 0)}" />
      </div>
      <div class="field">
        <label class="field__label" for="e-date">Date</label>
        <input class="input" id="e-date" type="date" value="${toDateInput(existing?.spent_at)}" />
      </div>
    </div>
    <div class="field">
      <label class="field__label" for="e-category">Category</label>
      <input class="input" id="e-category" list="category-list" value="${escapeHtml(existing?.category ?? 'general')}" />
      <datalist id="category-list">
        ${categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join('')}
      </datalist>
    </div>
    <div class="field">
      <label class="field__label" for="e-note">Note</label>
      <input class="input" id="e-note" value="${escapeHtml(existing?.note ?? '')}" placeholder="Optional" />
    </div>`;

  modal({
    title: isEdit ? 'Edit expense' : 'Add expense',
    body,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
      {
        label: isEdit ? 'Save' : 'Add expense',
        className: 'btn--primary',
        onClick: async ({ close, modal: root }) => {
          const payload = {
            description: root.querySelector('#e-desc').value,
            amount_cents: toCents(root.querySelector('#e-amount').value),
            category: root.querySelector('#e-category').value,
            spent_at: fromDateInput(root.querySelector('#e-date').value),
            note: root.querySelector('#e-note').value,
          };
          try {
            if (isEdit) await put(`/expenses/${existing.id}`, payload);
            else await post('/expenses', payload);
            close();
            toast(isEdit ? 'Expense updated' : 'Expense recorded');
            onDone();
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    onMount: (root) => root.querySelector('#e-desc')?.focus(),
  });
}

export async function render(container) {
  container.innerHTML = `
    <div class="grid grid--3" id="summary"></div>

    <section class="card" style="margin-top: 16px">
      <div class="card__head">
        <div class="row">
          <h3 class="card__title">Expenses</h3>
          <span class="badge" id="count">-</span>
        </div>
        <div class="row">
          <input class="input" id="search" placeholder="Search description" style="width: 190px" />
          <select class="select" id="category" style="width: 160px"><option value="">All categories</option></select>
          <button class="btn" id="export">Export CSV</button>
          <button class="btn btn--primary" id="add">+ Add expense</button>
        </div>
      </div>
      <div id="list"></div>
    </section>`;

  const summary = container.querySelector('#summary');
  const list = container.querySelector('#list');
  const count = container.querySelector('#count');
  const categoryFilter = container.querySelector('#category');

  async function load() {
    list.innerHTML = '<div class="skeleton" style="height: 140px; margin: 8px"></div>';
    try {
      const query = new URLSearchParams();
      if (view.search) query.set('search', view.search);
      if (view.category) query.set('category', view.category);
      const data = await get(`/expenses?${query.toString()}`);

      view.expenses = data.expenses;
      view.categories = data.categories;
      count.textContent = `${data.expenses.length} entr${data.expenses.length === 1 ? 'y' : 'ies'}`;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
      const monthTotal = data.expenses
        .filter((row) => row.spent_at >= monthStart)
        .reduce((sum, row) => sum + row.amount_cents, 0);
      const yearTotal = data.expenses
        .filter((row) => row.spent_at >= yearStart)
        .reduce((sum, row) => sum + row.amount_cents, 0);

      summary.innerHTML = [
        ['Shown', peso(data.total_cents)],
        ['This month', peso(monthTotal)],
        ['This year', peso(yearTotal)],
      ]
        .map(
          ([label, value]) => `
          <div class="card card--hover"><div class="stat">
            <span class="stat__label">${label}</span>
            <span class="stat__value" style="color: var(--orange)">${value}</span>
          </div></div>`,
        )
        .join('');

      const selected = categoryFilter.value;
      categoryFilter.innerHTML =
        '<option value="">All categories</option>' +
        data.categories
          .map((row) => `<option value="${escapeHtml(row.category)}">${escapeHtml(row.category)} (${peso(row.total_cents)})</option>`)
          .join('');
      categoryFilter.value = selected;

      renderList();
    } catch (error) {
      list.innerHTML = `<div class="empty" style="color: var(--red)">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderList() {
    if (!view.expenses.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty__icon">🧾</div>
          <p>No expenses recorded. Click <strong>Add expense</strong> to log what you spent.</p>
        </div>`;
      return;
    }

    list.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>
            ${view.expenses
              .map(
                (row) => `
              <tr data-id="${row.id}">
                <td class="muted">${formatDate(row.spent_at)}</td>
                <td>${escapeHtml(row.description)}${row.note ? `<div class="muted" style="font-size: 11.5px">${escapeHtml(row.note)}</div>` : ''}</td>
                <td><span class="badge">${escapeHtml(row.category)}</span></td>
                <td class="num" style="font-weight: 600">${peso(row.amount_cents)}</td>
                <td class="num">
                  <button class="btn btn--sm" data-edit>Edit</button>
                  <button class="btn btn--sm btn--danger" data-delete>Delete</button>
                </td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    list.querySelectorAll('tr[data-id]').forEach((row) => {
      const expense = view.expenses.find((item) => item.id === row.dataset.id);
      row.querySelector('[data-edit]').addEventListener('click', () =>
        expenseModal(expense, view.categories, load),
      );
      row.querySelector('[data-delete]').addEventListener('click', async () => {
        try {
          await del(`/expenses/${expense.id}`);
          toast('Expense deleted');
          load();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  }

  let timer;
  container.querySelector('#search').addEventListener('input', (event) => {
    view.search = event.target.value;
    clearTimeout(timer);
    timer = setTimeout(load, 220);
  });

  categoryFilter.addEventListener('change', () => {
    view.category = categoryFilter.value;
    load();
  });

  container.querySelector('#add').addEventListener('click', () =>
    expenseModal(null, view.categories, load),
  );

  container.querySelector('#export').addEventListener('click', () => {
    if (!view.expenses.length) {
      toast('Nothing to export', 'error');
      return;
    }
    const rows = [['Date', 'Description', 'Category', 'Amount', 'Note']];
    for (const expense of view.expenses) {
      rows.push([
        formatDate(expense.spent_at),
        expense.description,
        expense.category,
        plainAmount(expense.amount_cents),
        expense.note ?? '',
      ]);
    }
    downloadCsv(`expenses-${toDateInput(Date.now())}.csv`, rows);
    toast('CSV exported');
  });

  await load();
}
