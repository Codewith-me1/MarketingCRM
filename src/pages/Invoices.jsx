import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { money, today } from '../common/format';
import { addDays, invoiceTotals, isOverdue, mailtoUrl, nextNumber, uid } from '../common/crm';
import { appConfig } from '../supabase/supabase';
import PageTitle from '../components/ui/PageTitle';
import StatCard from '../components/ui/StatCard';
import { Field, Modal } from '../components/ui/Modal';

const STATUSES = { Quote: ['Draft', 'Sent', 'Accepted', 'Declined'], Invoice: ['Draft', 'Sent', 'Paid', 'Void'] };
const STATUS_CLASS = { Draft: 'new', Sent: 'contacted', Accepted: 'qualified', Paid: 'converted', Declined: 'lost', Void: 'lost', Overdue: 'lost' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function printDocument(invoice, sender) {
  const totals = invoiceTotals(invoice);
  const rows = invoice.items.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${Number(item.qty)}</td><td>${money(item.price)}</td><td>${money(item.qty * item.price)}</td></tr>`).join('');
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) { window.alert('Allow pop-ups to print or save as PDF.'); return; }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.number)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#20283b;margin:48px}h1{margin:0;font-size:28px}table{width:100%;border-collapse:collapse;margin:28px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e7ef}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.meta{display:flex;justify-content:space-between;gap:24px;margin-top:28px}.totals{margin-left:auto;width:280px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.grand{font-weight:700;font-size:18px;border-top:2px solid #20283b;margin-top:6px;padding-top:8px!important}small{color:#6b7280}</style></head>
<body><div class="meta"><div><h1>${escapeHtml(invoice.type)}</h1><small>${escapeHtml(invoice.number)}</small></div><div style="text-align:right"><b>${escapeHtml(appConfig.name)}</b><br><small>${escapeHtml(sender)}</small></div></div>
<div class="meta"><div><small>Bill to</small><br><b>${escapeHtml(invoice.client)}</b><br>${escapeHtml(invoice.email)}</div><div style="text-align:right"><small>Issued</small> ${escapeHtml(invoice.issueDate)}<br><small>${invoice.type === 'Quote' ? 'Valid until' : 'Due'}</small> ${escapeHtml(invoice.dueDate)}</div></div>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Subtotal</span><span>${money(totals.subtotal)}</span></div>${totals.discount ? `<div><span>Discount</span><span>-${money(totals.discount)}</span></div>` : ''}<div><span>Tax (${Number(invoice.taxRate) || 0}%)</span><span>${money(totals.tax)}</span></div><div class="grand"><span>Total</span><span>${money(totals.total)}</span></div></div>
${invoice.notes ? `<p><small>Notes</small><br>${escapeHtml(invoice.notes)}</p>` : ''}<script>window.onload=()=>window.print()</${'script'}></body></html>`);
  win.document.close();
}

function InvoiceEditor({ invoice, onClose, onSave, onDelete }) {
  const { data } = useCRM();
  const [draft, setDraft] = useState(invoice);
  const totals = invoiceTotals(draft);
  const set = key => event => setDraft(current => ({ ...current, [key]: event.target.value }));
  const setItem = (id, changes) => setDraft(current => ({ ...current, items: current.items.map(item => (item.id === id ? { ...item, ...changes } : item)) }));
  const addProduct = productId => {
    const product = data.products.find(item => item.id === productId);
    setDraft(current => ({ ...current, items: [...current.items, { id: uid(), description: product?.name || '', qty: 1, price: product?.price || 0 }] }));
  };
  const clients = [...new Set([...data.companies.map(item => item.name), ...data.leads.map(item => item.company || item.name)].filter(Boolean))];

  const pickClient = event => {
    const client = event.target.value;
    const lead = data.leads.find(item => item.company === client || item.name === client);
    setDraft(current => ({ ...current, client, email: current.email || lead?.email || '' }));
  };

  return (
    <Modal
      eyebrow={draft.type.toUpperCase()}
      title={draft.number}
      wide
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (draft.client.trim() && draft.items.length) onSave(draft); }}
      footer={(
        <>
          {invoice.id && <button className="danger-button" type="button" onClick={() => onDelete(invoice)}><SafeIcon icon={FiIcons.FiTrash2} /></button>}
          <button className="secondary-button" type="button" onClick={() => printDocument(draft, '')}><SafeIcon icon={FiIcons.FiPrinter} /> Print / PDF</button>
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit"><SafeIcon icon={FiIcons.FiCheck} /> Save</button>
        </>
      )}
    >
      <div className="editor-grid">
        <Field label="Client" required><input list="invoice-clients" value={draft.client} onChange={pickClient} required /><datalist id="invoice-clients">{clients.map(name => <option key={name} value={name} />)}</datalist></Field>
        <Field label="Client email"><input type="email" value={draft.email} onChange={set('email')} /></Field>
        <Field label="Issue date"><input type="date" value={draft.issueDate} onChange={set('issueDate')} /></Field>
        <Field label={draft.type === 'Quote' ? 'Valid until' : 'Due date'}><input type="date" value={draft.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Status"><select value={draft.status} onChange={set('status')}>{STATUSES[draft.type].map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Tax rate (%)"><input type="number" min="0" step="0.01" value={draft.taxRate} onChange={set('taxRate')} /></Field>
        <div className="field-wide">
          <h3 className="drawer-section">Line items</h3>
          {draft.items.map(item => (
            <div className="action-row line-item" key={item.id}>
              <input value={item.description} onChange={event => setItem(item.id, { description: event.target.value })} placeholder="Description" aria-label="Description" />
              <input type="number" min="0" step="any" value={item.qty} onChange={event => setItem(item.id, { qty: event.target.value })} aria-label="Quantity" className="narrow-input" />
              <input type="number" min="0" step="0.01" value={item.price} onChange={event => setItem(item.id, { price: event.target.value })} aria-label="Unit price" className="price-input" />
              <b>{money((Number(item.qty) || 0) * (Number(item.price) || 0))}</b>
              <button className="icon-button small-icon" type="button" aria-label="Remove line" onClick={() => setDraft(current => ({ ...current, items: current.items.filter(line => line.id !== item.id) }))}><SafeIcon icon={FiIcons.FiX} /></button>
            </div>
          ))}
          <div className="action-row">
            <select className="soft-select" value="" onChange={event => event.target.value && addProduct(event.target.value)} aria-label="Add product">
              <option value="">+ Add product…</option>
              {data.products.filter(item => item.active).map(product => <option key={product.id} value={product.id}>{product.name} — {money(product.price)}</option>)}
            </select>
            <button className="text-link" type="button" onClick={() => addProduct('')}><SafeIcon icon={FiIcons.FiPlus} /> Custom line</button>
          </div>
        </div>
        <Field label="Discount ($)"><input type="number" min="0" step="0.01" value={draft.discount} onChange={set('discount')} /></Field>
        <div className="invoice-totals">
          <span>Subtotal <b>{money(totals.subtotal)}</b></span>
          {totals.discount > 0 && <span>Discount <b>-{money(totals.discount)}</b></span>}
          <span>Tax <b>{money(totals.tax)}</b></span>
          <span className="grand">Total <b>{money(totals.total)}</b></span>
        </div>
        <Field label="Notes / terms" wide><textarea rows="2" value={draft.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

export default function Invoices() {
  const { data, update, displayName } = useCRM();
  const [searchParams, setSearchParams] = useSearchParams();
  const [type, setType] = useState('All');
  const [editing, setEditing] = useState(null);

  const blank = kind => ({
    id: '', number: nextNumber(data.invoices, kind), type: kind, client: '', email: '', issueDate: today(),
    dueDate: addDays(kind === 'Quote' ? 30 : 14), status: 'Draft', taxRate: 0, discount: 0, notes: '', items: []
  });

  useEffect(() => {
    const id = searchParams.get('open');
    const kind = searchParams.get('new');
    if (id) { const found = data.invoices.find(item => item.id === id); if (found) setEditing(found); }
    if (kind) setEditing(blank(kind === 'quote' ? 'Quote' : 'Invoice'));
    if (id || kind) setSearchParams({}, { replace: true });
  }, [searchParams]);

  const rows = useMemo(() => data.invoices
    .filter(item => type === 'All' || item.type === type)
    .map(item => ({ ...item, totals: invoiceTotals(item), displayStatus: isOverdue(item) ? 'Overdue' : item.status }))
    .sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate))), [data.invoices, type]);

  const stats = useMemo(() => {
    const invoices = data.invoices.filter(item => item.type === 'Invoice' && item.status !== 'Void');
    const sum = list => list.reduce((total, item) => total + invoiceTotals(item).total, 0);
    return {
      outstanding: sum(invoices.filter(item => item.status !== 'Paid')),
      overdue: sum(invoices.filter(isOverdue)),
      paid: sum(invoices.filter(item => item.status === 'Paid')),
      openQuotes: sum(data.invoices.filter(item => item.type === 'Quote' && ['Draft', 'Sent'].includes(item.status)))
    };
  }, [data.invoices]);

  const save = draft => {
    const clean = { ...draft, taxRate: Number(draft.taxRate) || 0, discount: Number(draft.discount) || 0, items: draft.items.map(item => ({ ...item, qty: Number(item.qty) || 0, price: Number(item.price) || 0 })) };
    update('invoices', list => (clean.id ? list.map(item => (item.id === clean.id ? clean : item)) : [{ ...clean, id: uid() }, ...list]));
    setEditing(null);
  };

  const convertToInvoice = quote => {
    const invoice = { ...quote, id: uid(), type: 'Invoice', number: nextNumber(data.invoices, 'Invoice'), status: 'Draft', issueDate: today(), dueDate: addDays(14), notes: `${quote.notes ? `${quote.notes}\n` : ''}From quote ${quote.number}` };
    update('invoices', list => [invoice, ...list.map(item => (item.id === quote.id ? { ...item, status: 'Accepted' } : item))]);
    setEditing(invoice);
  };

  const emailLink = invoice => mailtoUrl({
    to: invoice.email ? [invoice.email] : [],
    subject: `${invoice.type} ${invoice.number} from ${appConfig.name}`,
    body: `Hi,\n\nPlease find ${invoice.type.toLowerCase()} ${invoice.number} for ${money(invoiceTotals(invoice).total)}${invoice.type === 'Invoice' ? `, due ${invoice.dueDate}` : ''}.\n\nThank you,\n${displayName}`
  });

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="BILLING"
        title="Quotes & invoices"
        description="Build quotes from your product catalog, convert them to invoices and track payment."
        actions={(
          <>
            <button className="secondary-button" type="button" onClick={() => setEditing(blank('Quote'))}><SafeIcon icon={FiIcons.FiFileText} /> New quote</button>
            <button className="primary-button" type="button" onClick={() => setEditing(blank('Invoice'))}><SafeIcon icon={FiIcons.FiPlus} /> New invoice</button>
          </>
        )}
      />
      <section className="stats-grid">
        <StatCard label="Outstanding" value={money(stats.outstanding)} change="●" note="unpaid invoices" icon={FiIcons.FiClock} tone="amber" />
        <StatCard label="Overdue" value={money(stats.overdue)} change={stats.overdue ? '-' : '●'} note="past due date" icon={FiIcons.FiAlertCircle} tone="violet" />
        <StatCard label="Collected" value={money(stats.paid)} change="●" note="paid invoices" icon={FiIcons.FiCheckCircle} tone="green" />
        <StatCard label="Open quotes" value={money(stats.openQuotes)} change="●" note="draft & sent" icon={FiIcons.FiFileText} tone="blue" />
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="segmented">{['All', 'Quote', 'Invoice'].map(item => <button type="button" key={item} className={type === item ? 'active' : ''} onClick={() => setType(item)}>{item === 'All' ? 'All' : `${item}s`}</button>)}</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {rows.map(invoice => (
                <tr key={invoice.id}>
                  <td><button type="button" className="lead-person" onClick={() => setEditing(invoice)}><span><b>{invoice.number}</b><small>{invoice.type}</small></span></button></td>
                  <td><b className="table-strong">{invoice.client}</b><small className="table-sub">{invoice.email}</small></td>
                  <td>{invoice.issueDate}</td>
                  <td>{invoice.dueDate}</td>
                  <td><span className={`status-chip status-${STATUS_CLASS[invoice.displayStatus]}`}>{invoice.displayStatus}</span></td>
                  <td><b className="table-strong">{money(invoice.totals.total)}</b></td>
                  <td className="row-actions">
                    <button className="icon-button small-icon" type="button" title="Print / PDF" aria-label={`Print ${invoice.number}`} onClick={() => printDocument(invoice, displayName)}><SafeIcon icon={FiIcons.FiPrinter} /></button>
                    <a className="icon-button small-icon" href={emailLink(invoice)} title="Email" aria-label={`Email ${invoice.number}`} onClick={() => invoice.status === 'Draft' && update('invoices', list => list.map(item => (item.id === invoice.id ? { ...item, status: 'Sent' } : item)))}><SafeIcon icon={FiIcons.FiMail} /></a>
                    {invoice.type === 'Quote' && invoice.status !== 'Declined' && <button className="icon-button small-icon" type="button" title="Convert to invoice" aria-label={`Convert ${invoice.number} to invoice`} onClick={() => convertToInvoice(invoice)}><SafeIcon icon={FiIcons.FiRepeat} /></button>}
                    {invoice.type === 'Invoice' && invoice.status !== 'Paid' && <button className="icon-button small-icon" type="button" title="Mark paid" aria-label={`Mark ${invoice.number} paid`} onClick={() => update('invoices', list => list.map(item => (item.id === invoice.id ? { ...item, status: 'Paid', paidDate: today() } : item)))}><SafeIcon icon={FiIcons.FiCheck} /></button>}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td className="empty-cell" colSpan="7">Nothing here yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editing && <InvoiceEditor key={editing.id || editing.number} invoice={editing} onClose={() => setEditing(null)} onSave={save} onDelete={invoice => { if (window.confirm(`Delete ${invoice.number}?`)) { update('invoices', list => list.filter(item => item.id !== invoice.id)); setEditing(null); } }} />}
    </div>
  );
}
