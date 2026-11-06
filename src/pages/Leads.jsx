import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials } from '../common/format';
import { downloadCsv, parseCsv } from '../utils/csv';
import PageTitle from '../components/ui/PageTitle';
import LeadEditor from '../components/leads/LeadEditor';

export default function Leads() {
  const { data, update, globalSearch, displayName } = useCRM();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All stages');
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const inputRef = useRef(null);
  const closeEditor = useCallback(() => setEditing(null), []);

  // Deep link from the dashboard: /leads?new=1 opens the "Add a lead" form.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditing({});
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const filtered = useMemo(() => data.leads.filter(lead => {
    const query = `${search} ${globalSearch}`.trim().toLowerCase();
    const matches = !query || `${lead.name} ${lead.email} ${lead.company} ${lead.source}`.toLowerCase().includes(query);
    return matches && (status === 'All stages' || lead.status === status);
  }), [data.leads, search, globalSearch, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const shown = filtered.slice((page - 1) * 6, page * 6);
  const saveLead = draft => {
    const isExisting = Boolean(editing?.id);
    update('leads', list => isExisting
      ? list.map(item => item.id === editing.id ? { ...draft, id: item.id } : item)
      : [{ ...draft, id: crypto.randomUUID(), createdAt: draft.createdAt || new Date().toISOString().slice(0, 10) }, ...list]);
    setEditing(null);
    if (!isExisting) {
      setSearch('');
      setStatus('All stages');
      setPage(1);
    }
  };
  const importFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text());
    const added = parsed.filter(row => row.name && row.email && !data.leads.some(item => item.email.toLowerCase() === row.email.toLowerCase()))
      .map(row => ({ id: crypto.randomUUID(), name: row.name, email: row.email, phone: row.phone || '', company: row.company || '', source: row.source || 'Import', status: row.status || 'New', priority: row.priority || 'Medium', owner: row.owner || displayName, budget: Number(row.budget) || 0, campaign: row.campaign || '', location: row.location || '', whatsapp: row.whatsapp || '', notes: row.notes || '', followUp: row.followup || '', createdAt: new Date().toISOString().slice(0, 10) }));
    update('leads', list => [...added, ...list]);
    event.target.value = '';
    window.alert(`Imported ${added.length} new leads. Duplicate emails and rows without name/email were skipped.`);
  };
  const removeSelected = () => {
    if (!window.confirm(`Delete ${selected.length} selected lead${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    update('leads', list => list.filter(lead => !selected.includes(lead.id)));
    setSelected([]);
  };

  return (
    <div className="page-content"><PageTitle eyebrow="RELATIONSHIP MANAGEMENT" title="Leads" description="Manage, qualify, and follow up with every opportunity." actions={<><button className="secondary-button" onClick={() => inputRef.current?.click()}><SafeIcon icon={FiIcons.FiUpload} /> Import</button><button className="secondary-button" onClick={() => downloadCsv(filtered)}><SafeIcon icon={FiIcons.FiDownload} /> Export</button><button className="primary-button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> Add lead</button></>} />
      <div className="lead-summary"><b>{data.leads.length} leads</b><span><i></i> {data.leads.filter(item => !['Converted', 'Lost'].includes(item.status)).length} active in pipeline</span><span className="summary-right">Updated just now</span></div>
      <section className="panel table-panel"><div className="table-toolbar"><label className="table-search"><SafeIcon icon={FiIcons.FiSearch} /><input placeholder="Search name, company, source..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><select className="soft-select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option>All stages</option>{['New', 'Contacted', 'Interested', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'].map(item => <option key={item}>{item}</option>)}</select>{selected.length > 0 && <button className="danger-button" onClick={removeSelected}>Delete {selected.length} selected</button>}<input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={importFile} /></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th><input type="checkbox" checked={shown.length > 0 && shown.every(item => selected.includes(item.id))} onChange={event => setSelected(event.target.checked ? [...new Set([...selected, ...shown.map(item => item.id)])] : selected.filter(id => !shown.some(item => item.id === id)))} /></th><th>Lead</th><th>Company</th><th>Source</th><th>Stage</th><th>Priority</th><th>Budget</th><th>Owner</th><th>Follow-up</th><th></th></tr></thead><tbody>
          {shown.map(lead => <tr key={lead.id}><td><input type="checkbox" checked={selected.includes(lead.id)} onChange={event => setSelected(event.target.checked ? [...selected, lead.id] : selected.filter(id => id !== lead.id))} /></td><td><button className="lead-person" onClick={() => setEditing(lead)}><span className="avatar avatar-blue">{initials(lead.name)}</span><span><b>{lead.name}</b><small>{lead.email}</small></span></button></td><td><b className="table-strong">{lead.company}</b><small className="table-sub">{lead.location}</small></td><td>{lead.source}</td><td><span className={`status-chip status-${lead.status.toLowerCase()}`}>{lead.status}</span></td><td><span className={`priority-dot priority-${lead.priority.toLowerCase()}`}></span>{lead.priority}</td><td>{lead.budget ? `$${Number(lead.budget).toLocaleString()}` : '—'}</td><td>{lead.owner}</td><td>{lead.followUp || '—'}</td><td><button className="icon-button small-icon" aria-label="Edit lead" onClick={() => setEditing(lead)}><SafeIcon icon={FiIcons.FiMoreHorizontal} /></button></td></tr>)}
          {!shown.length && <tr><td colSpan="10" className="empty-cell">No leads match these filters.</td></tr>}
        </tbody></table></div>
        <div className="table-footer"><span>Showing {filtered.length ? (page - 1) * 6 + 1 : 0}–{Math.min(page * 6, filtered.length)} of {filtered.length}</span><div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>{editing && <LeadEditor lead={editing.id ? editing : null} existingLeads={data.leads} onClose={closeEditor} onSave={saveLead} />}
    </div>
  );
}