/**
 * FinCalc Tools - Invoice Generator Engine
 * Manages itemized rows, subtotal, tax, discounts, and print/PDF formatting.
 */

import { trackToolUsage } from './analytics.js';

export class InvoiceManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.items = [
      { id: 1, description: 'Web Design & Development', quantity: 10, rate: 85 },
      { id: 2, description: 'UI/UX Wireframing & Prototyping', quantity: 5, rate: 90 }
    ];
    this.nextId = 3;
    this.currencySymbol = '$';
  }

  addItem(description = '', quantity = 1, rate = 0) {
    this.items.push({
      id: this.nextId++,
      description: description,
      quantity: quantity,
      rate: rate
    });
    this.render();
  }

  removeItem(id) {
    if (this.items.length <= 1) return; // Keep at least one row
    this.items = this.items.filter(item => item.id !== id);
    this.render();
  }

  updateItem(id, field, value) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      if (field === 'description') item.description = value;
      else if (field === 'quantity') item.quantity = Math.max(0, parseFloat(value) || 0);
      else if (field === 'rate') item.rate = Math.max(0, parseFloat(value) || 0);
      this.calculateTotals();
    }
  }

  calculateTotals() {
    trackToolUsage('Invoice Generator');
    let subtotal = 0;
    this.items.forEach(item => {
      subtotal += item.quantity * item.rate;
    });

    const taxRate = parseFloat(document.getElementById('invoice-tax-rate')?.value) || 0;
    const discountRate = parseFloat(document.getElementById('invoice-discount-rate')?.value) || 0;
    const shipping = parseFloat(document.getElementById('invoice-shipping')?.value) || 0;

    const discountAmount = subtotal * (discountRate / 100);
    const taxableSubtotal = subtotal - discountAmount;
    const taxAmount = taxableSubtotal * (taxRate / 100);
    const total = taxableSubtotal + taxAmount + shipping;

    // Update DOM totals
    const elSubtotal = document.getElementById('inv-subtotal');
    const elTaxAmount = document.getElementById('inv-tax-amount');
    const elDiscountAmount = document.getElementById('inv-discount-amount');
    const elTotal = document.getElementById('inv-total');

    if (elSubtotal) elSubtotal.textContent = `${this.currencySymbol}${subtotal.toFixed(2)}`;
    if (elTaxAmount) elTaxAmount.textContent = `${this.currencySymbol}${taxAmount.toFixed(2)}`;
    if (elDiscountAmount) elDiscountAmount.textContent = `${this.currencySymbol}${discountAmount.toFixed(2)}`;
    if (elTotal) elTotal.textContent = `${this.currencySymbol}${total.toFixed(2)}`;

    // Update row totals in table
    this.items.forEach(item => {
      const elRowTotal = document.getElementById(`row-total-${item.id}`);
      if (elRowTotal) {
        elRowTotal.textContent = `${this.currencySymbol}${(item.quantity * item.rate).toFixed(2)}`;
      }
    });

    return { subtotal, discountAmount, taxAmount, shipping, total };
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = '';
    this.items.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-slate-50/50 transition-colors';
      tr.innerHTML = `
        <td class="py-3 px-2 text-xs font-semibold text-slate-400 w-8 text-center">${index + 1}</td>
        <td class="py-3 px-2">
          <input type="text" data-id="${item.id}" data-field="description" value="${item.description}" 
            placeholder="Item or service description" 
            class="w-full text-xs font-medium text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-none py-1" />
        </td>
        <td class="py-3 px-2 w-24">
          <input type="number" min="0" step="1" data-id="${item.id}" data-field="quantity" value="${item.quantity}" 
            class="w-full text-xs font-medium text-slate-800 bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:border-emerald-500 focus:outline-none" />
        </td>
        <td class="py-3 px-2 w-28">
          <input type="number" min="0" step="0.01" data-id="${item.id}" data-field="rate" value="${item.rate}" 
            class="w-full text-xs font-medium text-slate-800 bg-transparent border border-slate-200 rounded px-2 py-1 text-right focus:border-emerald-500 focus:outline-none" />
        </td>
        <td class="py-3 px-2 w-28 text-right font-semibold text-xs text-slate-900" id="row-total-${item.id}">
          ${this.currencySymbol}${(item.quantity * item.rate).toFixed(2)}
        </td>
        <td class="py-3 px-2 w-10 text-center no-print">
          <button type="button" data-remove-id="${item.id}" class="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </td>
      `;
      this.container.appendChild(tr);
    });

    // Attach listeners
    this.container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'));
        const field = e.target.getAttribute('data-field');
        this.updateItem(id, field, e.target.value);
      });
    });

    this.container.querySelectorAll('[data-remove-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(btn.getAttribute('data-remove-id'));
        this.removeItem(id);
      });
    });

    this.calculateTotals();
  }
}
