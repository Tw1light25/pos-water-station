/**
 * Shared category picker.
 *
 * A full-width dropdown of the saved categories plus a single **Manage**
 * button, which opens a floating window for adding, renaming and removing them.
 * Used by both the product and the expense editors so the two stay identical.
 *
 *   const field = createCategoryField({ host, kind: 'product', selected });
 *   await field.load();
 *   field.value();   // -> the chosen category name ('' = none)
 */

import { del, get, post, put } from './api.js';
import { escapeHtml, modal, toast } from './ui.js';

export async function loadCategories(kind) {
  const data = await get(`/categories?kind=${encodeURIComponent(kind)}`);
  return data.categories ?? [];
}

const LABEL = { product: 'Product categories', expense: 'Expense categories' };

/**
 * The floating "manage categories" window.
 *   onRenamed(oldName, newName) - so a caller can follow a rename
 *   onDeleted(name)             - so a caller can drop a stale selection
 *   onChanged()                 - something changed; refresh what is behind
 */
async function openCategoryManager({ kind, onRenamed, onDeleted, onChanged }) {
  let categories = await loadCategories(kind);

  modal({
    title: LABEL[kind] ?? 'Categories',
    body: `
      <div class="row" style="gap: 8px">
        <input class="input" data-new placeholder="New category name" maxlength="60" style="flex: 1; min-width: 0" />
        <button class="btn btn--primary" type="button" data-create>Add</button>
      </div>
      <div data-list style="margin-top: 14px"></div>`,
    actions: [
      {
        label: 'Close',
        className: 'btn--ghost',
        onClick: ({ close }) => {
          close();
          onChanged?.();
        },
      },
    ],
    onMount: (root) => {
      const listHost = root.querySelector('[data-list]');
      const newInput = root.querySelector('[data-new]');

      function renderList() {
        if (!categories.length) {
          listHost.innerHTML = '<p class="muted">No categories yet — add the first one above.</p>';
          return;
        }

        listHost.innerHTML = `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Category</th><th></th></tr></thead>
              <tbody>
                ${categories
                  .map(
                    (category) => `
                  <tr data-id="${category.id}">
                    <td data-name>${escapeHtml(category.name)}</td>
                    <td class="num">
                      <button class="btn btn--sm" type="button" data-rename>Rename</button>
                      <button class="btn btn--sm btn--danger" type="button" data-remove>Delete</button>
                    </td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`;

        listHost.querySelectorAll('tr[data-id]').forEach((row) => {
          const current = categories.find((item) => item.id === row.dataset.id);
          row.querySelector('[data-rename]').addEventListener('click', () => startRename(row, current));
          row.querySelector('[data-remove]').addEventListener('click', () => confirmRemove(current));
        });
      }

      async function refresh() {
        categories = await loadCategories(kind);
        renderList();
      }

      function startRename(row, current) {
        const cell = row.querySelector('[data-name]');
        cell.innerHTML = `
          <div class="row" style="gap: 6px">
            <input class="input" data-name-input value="${escapeHtml(current.name)}" maxlength="60" style="flex: 1; min-width: 0" />
            <button class="btn btn--sm btn--primary" type="button" data-save>Save</button>
            <button class="btn btn--sm btn--ghost" type="button" data-cancel>Cancel</button>
          </div>`;

        const input = cell.querySelector('[data-name-input]');
        input.focus();
        input.select();

        const save = async () => {
          const name = input.value.trim();
          if (!name) {
            toast('Enter a category name', 'error');
            return;
          }
          try {
            const data = await put(`/categories/${current.id}`, { name });
            if (data.renamed) toast(`Renamed — ${data.renamed} item(s) updated`);
            else toast('Renamed');
            onRenamed?.(current.name, name);
            await refresh();
          } catch (error) {
            toast(error.message, 'error');
          }
        };

        cell.querySelector('[data-save]').addEventListener('click', save);
        cell.querySelector('[data-cancel]').addEventListener('click', renderList);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') save();
        });
      }

      function confirmRemove(current) {
        modal({
          title: `Delete "${current.name}"`,
          body: '<p>This removes it from the list. It is only allowed while nothing uses it.</p>',
          actions: [
            { label: 'Cancel', className: 'btn--ghost', onClick: ({ close }) => close() },
            {
              label: 'Delete',
              className: 'btn--danger',
              onClick: async ({ close }) => {
                try {
                  await del(`/categories/${current.id}`);
                  close();
                  onDeleted?.(current.name);
                  await refresh();
                  toast('Category deleted');
                } catch (error) {
                  toast(error.message, 'error');
                }
              },
            },
          ],
        });
      }

      const create = async () => {
        const name = newInput.value.trim();
        if (!name) {
          toast('Enter a category name', 'error');
          return;
        }
        try {
          await post('/categories', { kind, name });
          newInput.value = '';
          await refresh();
          toast('Category added');
        } catch (error) {
          toast(error.message, 'error');
        }
      };

      root.querySelector('[data-create]').addEventListener('click', create);
      newInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') create();
      });

      renderList();
    },
  });
}

export function createCategoryField({ host, kind, selected = '', onChange = () => {}, onListChange = () => {} }) {
  let categories = [];
  let value = selected ?? '';

  host.innerHTML = `
    <div class="row" style="gap: 8px">
      <select class="select" data-category style="flex: 1; min-width: 0"></select>
      <button class="btn" type="button" data-manage>Manage</button>
    </div>`;

  const select = host.querySelector('[data-category]');

  function renderOptions() {
    const names = categories.map((item) => item.name);
    // Keep a selection that isn't in the list (an in-use value we haven't adopted).
    if (value && !names.some((name) => name.toLowerCase() === value.toLowerCase())) names.unshift(value);

    select.innerHTML = [
      '<option value="">No category</option>',
      ...names.map(
        (name) =>
          `<option value="${escapeHtml(name)}"${name === value ? ' selected' : ''}>${escapeHtml(name)}</option>`,
      ),
    ].join('');
    select.value = value;
  }

  async function refresh() {
    categories = await loadCategories(kind);
    renderOptions();
  }

  select.addEventListener('change', () => {
    value = select.value;
    onChange(value);
  });

  host.querySelector('[data-manage]').addEventListener('click', () => {
    openCategoryManager({
      kind,
      onRenamed: (oldName, newName) => {
        // Follow the rename so saving the form can't undo it.
        if (value === oldName) {
          value = newName;
          renderOptions();
          onChange(value);
        }
        // The records behind the window now carry the new name too.
        onListChange();
      },
      onDeleted: (name) => {
        if (value === name) {
          value = '';
          renderOptions();
          onChange(value);
        }
        onListChange();
      },
      onChanged: () => {
        refresh();
        onListChange();
      },
    });
  });

  renderOptions();

  return {
    load: refresh,
    refresh,
    value: () => value,
    setValue: (next) => {
      value = next ?? '';
      renderOptions();
    },
  };
}
