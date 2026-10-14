/**
 * Dashboard - four Tokyo Night line graphs in a 2x2 grid:
 * daily sales, weekly sales, monthly sales and outgoing money.
 */

import { get } from '../api.js';
import { escapeHtml, peso } from '../ui.js';

let chartLibPromise = null;
let charts = [];

function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartLibPromise) {
    chartLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/vendor/chart.umd.min.js';
      script.onload = () => resolve(window.Chart);
      script.onerror = () => reject(new Error('Could not load the chart library'));
      document.head.appendChild(script);
    });
  }
  return chartLibPromise;
}

function gradient(context, from, to) {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return 'transparent';
  const fill = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  fill.addColorStop(0, from);
  fill.addColorStop(1, to);
  return fill;
}

function lineChart(canvas, { labels, values, color, from, to }) {
  return new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: color,
          backgroundColor: (context) => gradient(context, from, to),
          fill: true,
          tension: 0.36,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#1a1b26',
          pointHoverBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#16161e',
          borderColor: '#3b4261',
          borderWidth: 1,
          titleColor: '#c0caf5',
          bodyColor: '#a9b1d6',
          padding: 10,
          displayColors: false,
          callbacks: { label: (item) => peso(item.parsed.y) },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(59, 66, 97, 0.28)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#565f89', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 14 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(59, 66, 97, 0.28)', drawTicks: false },
          border: { display: false },
          ticks: {
            color: '#565f89',
            font: { size: 10 },
            maxTicksLimit: 5,
            callback: (value) => '\u20B1' + (Number(value) / 100).toLocaleString('en-PH'),
          },
        },
      },
    },
  });
}

function chartCard(id, title, hint) {
  return `
    <div class="card card--hover">
      <div class="card__head">
        <div>
          <h3 class="card__title">${title}</h3>
          <span class="card__hint">${hint}</span>
        </div>
        <span class="badge" id="${id}-total">-</span>
      </div>
      <div class="chart-card__canvas"><canvas id="${id}"></canvas></div>
    </div>`;
}

export async function render(container, ctx) {
  for (const chart of charts) chart.destroy();
  charts = [];

  container.innerHTML = `
    <div class="grid grid--4" id="kpis"></div>
    <div id="alerts" style="margin-top: 16px"></div>
    <div class="grid grid--2" style="margin-top: 16px">
      ${chartCard('chart-daily', 'Daily sales', 'Money collected per day · last 14 days')}
      ${chartCard('chart-weekly', 'Weekly sales', 'Per week · last 12 weeks')}
      ${chartCard('chart-monthly', 'Monthly sales', 'Per month · last 12 months')}
      ${chartCard('chart-outgoing', 'Outgoing money', 'Expenses per month · last 12 months')}
    </div>`;

  const currency = ctx?.state?.settings?.currency ?? 'PHP';
  void currency;

  try {
    const data = await get('/dashboard');

    container.querySelector('#kpis').innerHTML = [
      ['Sales today', peso(data.kpis.sales_today_cents), 'var(--green)'],
      ['Sales this month', peso(data.kpis.sales_month_cents), 'var(--green)'],
      ['Outgoing this month', peso(data.kpis.outgoing_month_cents), 'var(--orange)'],
      ['Discounts this month', peso(data.kpis.discount_month_cents), 'var(--purple)'],
      ['Outstanding', peso(data.kpis.outstanding_cents), data.kpis.outstanding_cents > 0 ? 'var(--red)' : 'var(--text)'],
      ['Pending orders', data.kpis.pending_orders, 'var(--blue)'],
      ['Low stock', data.kpis.low_stock, data.kpis.low_stock > 0 ? 'var(--yellow)' : 'var(--text)'],
    ]
      .map(
        ([label, value, color]) => `
        <div class="card card--hover"><div class="stat">
          <span class="stat__label">${label}</span>
          <span class="stat__value" style="color: ${color}">${value}</span>
        </div></div>`,
      )
      .join('');

    if (data.low_stock_items.length) {
      container.querySelector('#alerts').innerHTML = `
        <div class="card" style="border-color: rgba(224, 175, 104, 0.4)">
          <div class="card__head">
            <h3 class="card__title" style="color: var(--yellow)">⚠ Low stock</h3>
            <span class="card__hint">At or below the reorder level</span>
          </div>
          <div class="row" style="flex-wrap: wrap; gap: 8px">
            ${data.low_stock_items
              .map(
                (item) =>
                  `<span class="badge badge--yellow">${escapeHtml(item.name)} · ${item.on_hand} ${escapeHtml(item.unit)}</span>`,
              )
              .join('')}
          </div>
        </div>`;
    }

    if (ctx?.isCurrent && !ctx.isCurrent()) return;
    await loadChartJs();
    if (ctx?.isCurrent && !ctx.isCurrent()) return;

    const make = (id, series, color, from, to) => {
      const canvas = container.querySelector(`#${id}`);
      if (!canvas) return;

      // Never create a second chart on a canvas that still has one.
      const existing = window.Chart.getChart(canvas);
      if (existing) existing.destroy();

      const badge = container.querySelector(`#${id}-total`);
      if (badge) {
        badge.className = 'badge badge--blue';
        badge.textContent = peso(series.total_cents);
      }

      charts.push(lineChart(canvas, { labels: series.labels, values: series.values, color, from, to }));
    };

    make('chart-daily', data.daily, '#7aa2f7', 'rgba(122, 162, 247, 0.35)', 'rgba(122, 162, 247, 0.02)');
    make('chart-weekly', data.weekly, '#bb9af7', 'rgba(187, 154, 247, 0.35)', 'rgba(187, 154, 247, 0.02)');
    make('chart-monthly', data.monthly, '#7dcfff', 'rgba(125, 207, 255, 0.35)', 'rgba(125, 207, 255, 0.02)');
    make('chart-outgoing', data.outgoing, '#ff9e64', 'rgba(255, 158, 100, 0.35)', 'rgba(255, 158, 100, 0.02)');
  } catch (error) {
    container.querySelector('#kpis').innerHTML = `
      <div class="card"><p style="color: var(--red)">Failed to load dashboard: ${escapeHtml(error.message)}</p></div>`;
  }
}
