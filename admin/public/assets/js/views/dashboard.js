/**
 * Dashboard - Tokyo Night line graphs for today by hour, this week by date,
 * and this month / this year with sales and outgoing expenses overlaid.
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

function chartOptions({ showLegend = false, label = (item) => peso(item.parsed.y) } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: showLegend
        ? {
            display: true,
            position: 'top',
            align: 'end',
            labels: { color: '#a9b1d6', font: { size: 11 }, boxWidth: 10, boxHeight: 10 },
          }
        : { display: false },
      tooltip: {
        backgroundColor: '#16161e',
        borderColor: '#3b4261',
        borderWidth: 1,
        titleColor: '#c0caf5',
        bodyColor: '#a9b1d6',
        padding: 10,
        displayColors: showLegend,
        callbacks: { label },
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
  };
}

function lineDataset({ label, values, color, from, to, fill = true }) {
  return {
    label,
    data: values,
    borderColor: color,
    backgroundColor: (context) => gradient(context, from, to),
    fill,
    tension: 0.36,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: color,
    pointHoverBorderColor: '#1a1b26',
    pointHoverBorderWidth: 2,
  };
}

function lineChart(canvas, options) {
  return new window.Chart(canvas, {
    type: 'line',
    data: { labels: options.labels, datasets: [lineDataset(options)] },
    options: chartOptions(),
  });
}

function multiLineChart(canvas, { labels, series }) {
  return new window.Chart(canvas, {
    type: 'line',
    data: { labels, datasets: series.map(lineDataset) },
    options: chartOptions({
      showLegend: true,
      label: (item) => `${item.dataset.label}: ${peso(item.parsed.y)}`,
    }),
  });
}

function chartCard(id, title, hint, { outgoing = false } = {}) {
  return `
    <div class="card card--hover">
      <div class="card__head">
        <div>
          <h3 class="card__title">${title}</h3>
          <span class="card__hint">${hint}</span>
        </div>
        <div class="row" style="gap: 6px">
          <span class="badge badge--blue" id="${id}-sales-total">-</span>
          ${outgoing ? `<span class="badge badge--orange" id="${id}-outgoing-total">-</span>` : ''}
        </div>
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
      ${chartCard('chart-daily', 'Daily sales', 'Money collected per hour · today')}
      ${chartCard('chart-weekly', 'Weekly sales', 'Money collected per day · Sunday to Saturday')}
    </div>
    <div class="grid" style="margin-top: 16px">
      ${chartCard('chart-monthly', 'Monthly sales & outgoing', 'Sales vs expenses per day · this month', { outgoing: true })}
      ${chartCard('chart-yearly', 'Yearly sales & outgoing', 'Sales vs expenses · every mid-month and month-end', { outgoing: true })}
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

    const setBadge = (id, value, className) => {
      const badge = container.querySelector(`#${id}`);
      if (!badge) return;
      badge.className = className;
      badge.textContent = value;
    };

    const prepareCanvas = (id) => {
      const canvas = container.querySelector(`#${id}`);
      if (!canvas) return null;

      // Never create a second chart on a canvas that still has one.
      const existing = window.Chart.getChart(canvas);
      if (existing) existing.destroy();
      return canvas;
    };

    const make = (id, series, color, from, to) => {
      const canvas = prepareCanvas(id);
      if (!canvas) return;

      setBadge(`${id}-sales-total`, peso(series.total_cents), 'badge badge--blue');
      charts.push(lineChart(canvas, { labels: series.labels, values: series.values, color, from, to }));
    };

    const makeDual = (id, series) => {
      const canvas = prepareCanvas(id);
      if (!canvas) return;

      setBadge(`${id}-sales-total`, peso(series.sales_total_cents), 'badge badge--blue');
      setBadge(`${id}-outgoing-total`, peso(series.outgoing_total_cents), 'badge badge--orange');

      charts.push(
        multiLineChart(canvas, {
          labels: series.labels,
          series: [
            {
              label: 'Sales',
              values: series.sales,
              color: '#7dcfff',
              from: 'rgba(125, 207, 255, 0.35)',
              to: 'rgba(125, 207, 255, 0.02)',
            },
            {
              label: 'Outgoing',
              values: series.outgoing,
              color: '#ff9e64',
              from: 'rgba(255, 158, 100, 0.35)',
              to: 'rgba(255, 158, 100, 0.02)',
              fill: false,
            },
          ],
        }),
      );
    };

    make('chart-daily', data.daily, '#7aa2f7', 'rgba(122, 162, 247, 0.35)', 'rgba(122, 162, 247, 0.02)');
    make('chart-weekly', data.weekly, '#bb9af7', 'rgba(187, 154, 247, 0.35)', 'rgba(187, 154, 247, 0.02)');
    makeDual('chart-monthly', data.monthly);
    makeDual('chart-yearly', data.yearly);
  } catch (error) {
    container.querySelector('#kpis').innerHTML = `
      <div class="card"><p style="color: var(--red)">Failed to load dashboard: ${escapeHtml(error.message)}</p></div>`;
  }
}
