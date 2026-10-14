/** Printable receipt (opens a small print window with the shop's details). */

import { escapeHtml, formatDate, peso } from '../ui.js';

const PAYMENT_LABELS = { unpaid: 'UNPAID', partial: 'PARTIALLY PAID', paid: 'PAID' };

export function printReceipt({ order, items, payments }, settings = {}) {
  const popup = window.open('', '_blank', 'width=420,height=680');
  if (!popup) {
    alert('Please allow pop-ups for this site so receipts can be printed.');
    return;
  }

  const balance = Number(order.total_cents) - Number(order.amount_paid_cents);
  // Absolute URL: the receipt is a separate window, where a relative path can fail.
  const logoUrl = new URL(settings.logo_url || '/assets/img/logo.jpg', window.location.origin).href;
  const rows = items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.product_name)}</td>
        <td class="num">${item.qty}</td>
        <td class="num">${peso(item.unit_price_cents)}</td>
        <td class="num">${peso(item.line_total_cents)}</td>
      </tr>`,
    )
    .join('');

  const paymentRows = payments.length
    ? `<div class="hr"></div>
       <div class="line"><span>Payments</span><span></span></div>
       ${payments
         .map((payment) => {
           const paid = Number(payment.amount_cents ?? 0);
           const tendered = Number(payment.tendered_cents ?? 0);
           const change = Math.max(0, tendered - paid);
           return `
         <div class="line">
           <span>${formatDate(payment.paid_at)} · ${escapeHtml(payment.method)}</span>
           <span>${peso(paid)}</span>
         </div>
         ${
           change > 0
             ? `<div class="line"><span>&nbsp;&nbsp;Cash received</span><span>${peso(tendered)}</span></div>
                <div class="line"><span>&nbsp;&nbsp;Change</span><span>${peso(change)}</span></div>`
             : ''
         }`;
         })
         .join('')}`
    : '';

  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(order.id.slice(-6).toUpperCase())}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 12px;
      color: #000;
      margin: 0;
      padding: 16px;
      width: 300px;
    }
    h1 { font-size: 15px; margin: 0 0 2px; text-align: center; }
    img.logo {
      display: block;
      width: 88px;
      height: 88px;
      object-fit: contain;
      margin: 0 auto 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .muted { text-align: center; font-size: 11px; margin: 0; }
    .hr { border-top: 1px dashed #000; margin: 8px 0; }
    .line { display: flex; justify-content: space-between; gap: 8px; }
    .line span:last-child { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; }
    td { padding: 2px 0; vertical-align: top; }
    .num { text-align: right; }
    .total { font-weight: bold; font-size: 14px; }
    .status { text-align: center; font-weight: bold; margin-top: 6px; letter-spacing: 1px; }
    .footer { text-align: center; margin-top: 10px; font-size: 11px; }
    @media print { body { width: auto; } }
  </style>
</head>
<body>
  <img class="logo" src="${logoUrl}" alt="" onerror="this.style.display='none'" />
  <h1>${escapeHtml(settings.business_name ?? 'Water Station')}</h1>
  ${settings.address ? `<p class="muted">${escapeHtml(settings.address)}</p>` : ''}
  ${settings.phone ? `<p class="muted">${escapeHtml(settings.phone)}</p>` : ''}
  <div class="hr"></div>
  <div class="line"><span>Receipt</span><span>${escapeHtml(order.id.slice(-6).toUpperCase())}</span></div>
  <div class="line"><span>Date</span><span>${formatDate(order.placed_at, true)}</span></div>
  <div class="line"><span>Type</span><span>${order.order_type === 'delivery' ? 'Delivery' : 'Walk-in'}</span></div>
  <div class="line"><span>Customer</span><span>${escapeHtml(order.customer_name ?? 'Walk-in')}</span></div>
  ${order.customer_phone ? `<div class="line"><span>Phone</span><span>${escapeHtml(order.customer_phone)}</span></div>` : ''}
  ${order.address ? `<div class="line"><span>Address</span><span>${escapeHtml(order.address)}</span></div>` : ''}
  <div class="hr"></div>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="hr"></div>
  <div class="line"><span>Subtotal</span><span>${peso(order.subtotal_cents)}</span></div>
  ${
    Number(order.discount_cents) > 0
      ? `<div class="line">
           <span>Discount${Number(order.discount_percent) > 0 ? ` (${order.discount_percent}%)` : ''}</span>
           <span>-${peso(order.discount_cents)}</span>
         </div>
         ${order.discount_reason ? `<div class="line"><span>&nbsp;&nbsp;${escapeHtml(order.discount_reason)}</span><span></span></div>` : ''}`
      : ''
  }
  ${order.delivery_fee_cents > 0 ? `<div class="line"><span>Delivery fee</span><span>${peso(order.delivery_fee_cents)}</span></div>` : ''}
  <div class="line total"><span>TOTAL</span><span>${peso(order.total_cents)}</span></div>
  <div class="line"><span>Paid</span><span>${peso(order.amount_paid_cents)}</span></div>
  ${balance > 0 ? `<div class="line"><span>Balance</span><span>${peso(balance)}</span></div>` : ''}
  ${order.due_date && balance > 0 ? `<div class="line"><span>Due</span><span>${formatDate(order.due_date)}</span></div>` : ''}
  ${paymentRows}
  <div class="status">${PAYMENT_LABELS[order.payment_status] ?? ''}</div>
  <div class="footer">${escapeHtml(settings.receipt_footer ?? 'Thank you for your order!')}</div>
</body>
</html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
}
