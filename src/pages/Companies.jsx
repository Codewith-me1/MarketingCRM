import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials, money } from '../common/format';
import { invoiceTotals, uid } from '../common/crm';
import PageTitle from '../components/ui/PageTitle';
import { Drawer, Field, Modal } from '../components/ui/Modal';

const blank = { name: '', industry: '', website: '', phone: '', size: '', city: '', owner: '', notes: '' };
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

function CompanyEditor({ company, onClose, onSave }) {
  const { ownerOptions } = useCRM();
  const [draft, setDraft] = useState({ ...blank, ...company });
  const set = key => event => setDraft(current => ({ ...current, [key]: event.target.value }));
  return (
    <Modal
      eyebrow={company?.id ? 'UPDATE ACCOUNT' : 'NEW ACCOUNT'}
      title={company?.id ? 'Edit company' : 'Add a company'}
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() }); }}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><SafeIcon icon={FiIcons.FiCheck} /> Save company</button></>}
    >
      <div className="editor-grid">
        <Field label="Company name" required><input value={draft.name} onChange={set('name')} required /></Field>
        <Field label="Industry"><input value={draft.industry} onChange={set('industry')} /></Field>
        <Field label="Website"><input value={draft.website} onChange={set('website')} placeholder="example.com" /></Field>
        <Field label="Phone"><input type="tel" value={draft.phone} onChange={set('phone')} /></Field>
        <Field label="Company size"><select value={draft.size} onChange={set('size')}><option value="">—</option>{SIZES.map(size => <option key={size}>{size}</option>)}</select></Field>
        <Field label="City"><input value={draft.city} onChange={set('city')} /></Field>
        <Field label="Account owner"><select value={draft.owner} onChange={set('owner')}><option value="">Unassigned</option>{ownerOptions.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Notes" wide><textarea rows="3" value={draft.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

export default function Companies() {
  const { data, update, displayName } = useCRM();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const id = searchParams.get('open');
    if (searchParams.get('new') === '1') setEditing({});
    if (id) setOpenId(id);
    if (id || searchParams.get('new')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.companies
      .filter(company => !query || `${company.name} ${company.industry} ${company.city} ${company.website}`.toLowerCase().includes(query))
      .map(company => {
        const leads = data.leads.filter(lead => same(lead.company, company.name));
        const deals = data.deals.filter(deal => same(deal.company, company.name));
        return {
          ...company,
          leadCount: leads.length,
          openValue: deals.filter(deal => !['Won', 'Lost'].includes(deal.stage)).reduce((sum, deal) => sum + Number(deal.value || 0), 0),
          wonValue: deals.filter(deal => deal.stage === 'Won').reduce((sum, deal) => sum + Number(deal.value || 0), 0)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.companies, data.leads, data.deals, search]);

  const missing = useMemo(() => {
    const names = new Map();
    data.leads.forEach(lead => {
      if (lead.company && !data.companies.some(company => same(company.name, lead.company)) && !names.has(lead.company.toLowerCase())) {
        names.set(lead.company.toLowerCase(), lead);
      }
    });
    return [...names.values()];
  }, [data.leads, data.companies]);

  const save = draft => {
    update('companies', list => (draft.id ? list.map(item => (item.id === draft.id ? draft : item)) : [{ ...draft, id: uid() }, ...list]));
    setEditing(null);
  };

  const importFromLeads = () => {
    update('companies', list => [...missing.map(lead => ({ ...blank, id: uid(), name: lead.company, city: lead.location || '', owner: lead.owner || displayName })), ...list]);
  };

  const open = data.companies.find(company => company.id === openId);
  const openLeads = open ? data.leads.filter(lead => same(lead.company, open.name)) : [];
  const openDeals = open ? data.deals.filter(deal => same(deal.company, open.name)) : [];
  const openInvoices = open ? data.invoices.filter(invoice => same(invoice.client, open.name)) : [];

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="ACCOUNTS"
        title="Companies"
        description="Every organisation you sell to, with its people, deals and invoices."
        actions={(
          <>
            {missing.length > 0 && <button className="secondary-button" type="button" onClick={importFromLeads}><SafeIcon icon={FiIcons.FiDownloadCloud} /> Add {missing.length} from leads</button>}
            <button className="primary-button" type="button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> Add company</button>
          </>
        )}
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="table-search"><SafeIcon icon={FiIcons.FiSearch} /><input placeholder="Search companies…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Company</th><th>Industry</th><th>Size</th><th>Contacts</th><th>Open pipeline</th><th>Won</th><th>Owner</th><th></th></tr></thead>
            <tbody>
              {rows.map(company => (
                <tr key={company.id}>
                  <td><button type="button" className="lead-person" onClick={() => setOpenId(company.id)}><span className="avatar avatar-green">{initials(company.name)}</span><span><b>{company.name}</b><small>{company.website || company.city}</small></span></button></td>
                  <td>{company.industry || '—'}</td>
                  <td>{company.size || '—'}</td>
                  <td>{company.leadCount}</td>
                  <td>{money(company.openValue)}</td>
                  <td><b className="table-strong">{money(company.wonValue)}</b></td>
                  <td>{company.owner || 'Unassigned'}</td>
                  <td><button className="icon-button small-icon" type="button" aria-label={`Edit ${company.name}`} onClick={() => setEditing(company)}><SafeIcon icon={FiIcons.FiEdit2} /></button></td>
                </tr>
              ))}
              {!rows.length && <tr><td className="empty-cell" colSpan="8">No companies yet. Add one, or import them from your leads.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <CompanyEditor company={editing} onClose={() => setEditing(null)} onSave={save} />}
      {open && (
        <Drawer
          title={open.name}
          subtitle={[open.industry, open.city].filter(Boolean).join(' · ')}
          onClose={() => setOpenId(null)}
          actions={(
            <>
              {open.website && <a className="secondary-button" href={/^https?:/.test(open.website) ? open.website : `https://${open.website}`} target="_blank" rel="noreferrer"><SafeIcon icon={FiIcons.FiGlobe} /> Website</a>}
              {open.phone && <a className="secondary-button" href={`tel:${open.phone}`}><SafeIcon icon={FiIcons.FiPhone} /> Call</a>}
              <button className="primary-button" type="button" onClick={() => { setOpenId(null); setEditing(open); }}><SafeIcon icon={FiIcons.FiEdit2} /> Edit</button>
              <button className="danger-button" type="button" onClick={() => { if (window.confirm(`Delete ${open.name}? Leads and deals are kept.`)) { update('companies', list => list.filter(item => item.id !== open.id)); setOpenId(null); } }}><SafeIcon icon={FiIcons.FiTrash2} /></button>
            </>
          )}
        >
          {open.notes && <p className="profile-notes">{open.notes}</p>}
          <h3 className="drawer-section">People ({openLeads.length})</h3>
          <div className="mini-list">
            {openLeads.map(lead => <button type="button" className="mini-row" key={lead.id} onClick={() => navigate(`/leads?open=${lead.id}`)}><b>{lead.name}</b><span>{lead.email}</span><span className={`status-chip status-${lead.status.toLowerCase()}`}>{lead.status}</span></button>)}
            {!openLeads.length && <p className="field-hint">No leads at this company.</p>}
          </div>
          <h3 className="drawer-section">Deals ({openDeals.length})</h3>
          <div className="mini-list">
            {openDeals.map(deal => <button type="button" className="mini-row" key={deal.id} onClick={() => navigate(`/deals?open=${deal.id}`)}><b>{deal.name}</b><span>{deal.stage}</span><strong>{money(deal.value)}</strong></button>)}
            {!openDeals.length && <p className="field-hint">No deals yet.</p>}
          </div>
          <h3 className="drawer-section">Quotes & invoices ({openInvoices.length})</h3>
          <div className="mini-list">
            {openInvoices.map(invoice => <button type="button" className="mini-row" key={invoice.id} onClick={() => navigate(`/invoices?open=${invoice.id}`)}><b>{invoice.number}</b><span>{invoice.status}</span><strong>{money(invoiceTotals(invoice).total)}</strong></button>)}
            {!openInvoices.length && <p className="field-hint">No quotes or invoices.</p>}
          </div>
        </Drawer>
      )}
    </div>
  );
}
