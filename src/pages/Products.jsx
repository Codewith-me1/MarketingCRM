import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { money } from '../common/format';
import { uid } from '../common/crm';
import PageTitle from '../components/ui/PageTitle';
import { Field, Modal } from '../components/ui/Modal';

export default function Products() {
  const { data, update } = useCRM();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const save = event => {
    event.preventDefault();
    if (!editing.name.trim()) return;
    const product = { ...editing, name: editing.name.trim(), price: Number(editing.price) || 0 };
    update('products', list => (product.id ? list.map(item => (item.id === product.id ? product : item)) : [{ ...product, id: uid() }, ...list]));
    setEditing(null);
  };

  const rows = data.products.filter(item => `${item.name} ${item.sku} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="CATALOG"
        title="Products & services"
        description="Price list used when building quotes and invoices."
        actions={<button className="primary-button" type="button" onClick={() => setEditing({ name: '', sku: '', price: '', description: '', active: true })}><SafeIcon icon={FiIcons.FiPlus} /> Add product</button>}
      />
      <section className="panel table-panel">
        <div className="table-toolbar"><label className="table-search"><SafeIcon icon={FiIcons.FiSearch} /><input placeholder="Search products…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map(product => (
                <tr key={product.id}>
                  <td><b className="table-strong">{product.name}</b><small className="table-sub">{product.description}</small></td>
                  <td>{product.sku || '—'}</td>
                  <td><b className="table-strong">{money(product.price)}</b></td>
                  <td><span className={`status-chip ${product.active ? 'status-qualified' : 'status-lost'}`}>{product.active ? 'Active' : 'Archived'}</span></td>
                  <td>
                    <button className="icon-button small-icon" type="button" aria-label={`Edit ${product.name}`} onClick={() => setEditing(product)}><SafeIcon icon={FiIcons.FiEdit2} /></button>
                    <button className="icon-button small-icon" type="button" aria-label={`Delete ${product.name}`} onClick={() => window.confirm(`Delete ${product.name}?`) && update('products', list => list.filter(item => item.id !== product.id))}><SafeIcon icon={FiIcons.FiTrash2} /></button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td className="empty-cell" colSpan="5">No products yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <Modal
          eyebrow="CATALOG"
          title={editing.id ? 'Edit product' : 'Add product'}
          onClose={() => setEditing(null)}
          onSubmit={save}
          footer={<><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" type="submit">Save product</button></>}
        >
          <div className="editor-grid">
            <Field label="Name" required wide><input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} required /></Field>
            <Field label="SKU"><input value={editing.sku} onChange={event => setEditing({ ...editing, sku: event.target.value })} /></Field>
            <Field label="Unit price ($)"><input type="number" min="0" step="0.01" value={editing.price} onChange={event => setEditing({ ...editing, price: event.target.value })} /></Field>
            <Field label="Description" wide><input value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} /></Field>
            <Field label="Status"><select value={editing.active ? 'on' : 'off'} onChange={event => setEditing({ ...editing, active: event.target.value === 'on' })}><option value="on">Active</option><option value="off">Archived</option></select></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
