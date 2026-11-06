import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials } from '../common/format';
import { leadScore } from '../common/crm';
import { stages } from '../data/seed';
import { downloadCsv, parseCsv } from '../utils/csv';
import PageTitle from '../components/ui/PageTitle';
import LeadEditor from '../components/leads/LeadEditor';
import LeadProfile, { ScoreBadge } from '../components/leads/LeadProfile';
import EmailComposer from '../components/email/EmailComposer';

const PAGE_SIZE = 10;
const SORTS = {
  newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
  score: (a, b) => b.score - a.score,
  budget: (a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0),
  name: (a, b) => a.name.localeCompare(b.name),
  followUp: (a, b) => String(a.followUp || '9999').localeCompare(String(b.followUp || '9999'))
};

export default function Leads() {
  const { data, update, globalSearch, displayName, ownerOptions } = useCRM();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All stages');
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [emailing, setEmailing] = useState(null);
  const inputRef = useRef(null);
  const closeEditor = useCallback(() => setEditing(null), []);

  // Deep links: ?new=1 opens the "Add a lead" form, ?open=<id> opens a lead profile.
  useEffect(() => {
    const isNew = searchParams.get('new') === '1';
    const openId = searchParams.get('open');
    if (!isNew && !openId) return;
    if (isNew) setEditing({});
    if (openId) setProfileId(openId);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('open');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const allTags = useMemo(() => [...new Set(data.leads.flatMap(lead => lead.tags || []))].sort(), [data.leads]);

  const filtered = useMemo(() => {
    const query = `${search} ${globalSearch}`.trim().toLowerCase();
    return data.leads
      .filter(lead => {
        const haystack = `${lead.name} ${lead.email} ${lead.company} ${lead.source} ${lead.phone} ${(lead.tags || []).join(' ')}`.toLowerCase();
        return (!query || haystack.includes(query))
          && (status === 'All stages' || lead.status === status)
          && (!tag || (lead.tags || []).includes(tag))
          && (!owner || (owner === '__none' ? !lead.owner : lead.owner === owner));
      })
      .map(lead => ({ ...lead, score: leadScore(lead, data.activities) }))
      .sort(SORTS[sort]);
  }, [data.leads, data.activities, search, globalSearch, status, tag, owner, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedLeads = data.leads.filter(lead => selected.includes(lead.id));

  const saveLead = draft => {
    const isExisting = Boolean(editing?.id);
    update('leads', list => (isExisting
      ? list.map(item => (item.id === editing.id ? { ...item, ...draft, id: item.id } : item))
      : [{ ...draft, id: crypto.randomUUID(), createdAt: draft.createdAt || new Date().toISOString().slice(0, 10) }, ...list]));
    setEditing(null);
    if (!isExisting) {
      setSearch(''); setStatus('All stages'); setTag(''); setOwner(''); setSort('newest'); setPage(1);
    }
  };

  const importFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text());
    const seen = new Set(data.leads.map(item => item.email.toLowerCase()));
    const added = parsed
      .filter(row => row.name && row.email && !seen.has(row.email.toLowerCase()) && seen.add(row.email.toLowerCase()))
      .map(row => ({
        id: crypto.randomUUID(), name: row.name, email: row.email, phone: row.phone || '', company: row.company || '',
        source: row.source || 'Import', status: stages.includes(row.status) ? row.status : 'New', priority: row.priority || 'Medium',
        owner: row.owner || displayName, budget: Number(row.budget) || 0, campaign: row.campaign || '', location: row.location || '',
        whatsapp: row.whatsapp || '', notes: row.notes || '', followUp: row.followup || '',
        tags: row.tags ? row.tags.split(/[;|]/).map(item => item.trim().toLowerCase()).filter(Boolean) : [],
        createdAt: new Date().toISOString().slice(0, 10)
      }));
    update('leads', list => [...added, ...list]);
    event.target.value = '';
    window.alert(`Imported ${added.length} new leads. Duplicate emails and rows without name/email were skipped.`);
  };

  const exportRows = rows => downloadCsv(rows.map(({ timeline, score, ...lead }) => ({ ...lead, tags: (lead.tags || []).join(';'), score: score ?? leadScore(lead, data.activities) })));

  const removeSelected = () => {
    if (!window.confirm(`Delete ${selected.length} selected lead${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    update('leads', list => list.filter(lead => !selected.includes(lead.id)));
    setSelected([]);
  };

  const bulkTag = () => {
    const value = window.prompt('Tag to add to the selected leads:')?.trim().toLowerCase();
    if (!value) return;
    update('leads', list => list.map(lead => (selected.includes(lead.id) ? { ...lead, tags: [...new Set([...(lead.tags || []), value])] } : lead)));
  };

  const bulkStage = value => {
    if (!value) return;
    update('leads', list => list.map(lead => (selected.includes(lead.id) ? { ...lead, status: value } : lead)));
  };

  const openEditorFromProfile = useCallback(lead => { setProfileId(null); setEditing(lead); }, []);
  const closeProfile = useCallback(() => setProfileId(null), []);
  const allShownSelected = shown.length > 0 && shown.every(item => selected.includes(item.id));

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="RELATIONSHIP MANAGEMENT"
        title="Leads"
        description="Capture, score, qualify, and follow up with every opportunity."
        actions={(
          <>
            <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}><SafeIcon icon={FiIcons.FiUpload} /> Import</button>
            <button className="secondary-button" type="button" onClick={() => exportRows(filtered)}><SafeIcon icon={FiIcons.FiDownload} /> Export</button>
            <button className="primary-button" type="button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> Add lead</button>
          </>
        )}
      />
      <div className="lead-summary">
        <b>{data.leads.length} leads</b>
        <span><i></i> {data.leads.filter(item => !['Converted', 'Lost'].includes(item.status)).length} active in pipeline</span>
        <span>{filtered.filter(item => item.score >= 70).length} hot</span>
        <span className="summary-right">CSV columns: name, email, phone, company, source, status, budget, owner, tags (separated by ;)</span>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="table-search"><SafeIcon icon={FiIcons.FiSearch} /><input placeholder="Search name, company, tag, phone…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
          <select className="soft-select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} aria-label="Stage"><option>All stages</option>{stages.map(item => <option key={item}>{item}</option>)}</select>
          <select className="soft-select" value={tag} onChange={event => { setTag(event.target.value); setPage(1); }} aria-label="Tag"><option value="">All tags</option>{allTags.map(item => <option key={item} value={item}>#{item}</option>)}</select>
          <select className="soft-select" value={owner} onChange={event => { setOwner(event.target.value); setPage(1); }} aria-label="Owner"><option value="">All owners</option><option value="__none">Unassigned</option>{ownerOptions.map(item => <option key={item}>{item}</option>)}</select>
          <select className="soft-select" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort"><option value="newest">Newest first</option><option value="score">Highest score</option><option value="budget">Largest budget</option><option value="followUp">Next follow-up</option><option value="name">Name A–Z</option></select>
          <input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={importFile} />
        </div>
        {selected.length > 0 && (
          <div className="bulk-bar">
            <b>{selected.length} selected</b>
            <button className="secondary-button" type="button" onClick={() => setEmailing(selectedLeads)}><SafeIcon icon={FiIcons.FiMail} /> Email</button>
            <button className="secondary-button" type="button" onClick={bulkTag}><SafeIcon icon={FiIcons.FiTag} /> Add tag</button>
            <select className="soft-select" value="" onChange={event => bulkStage(event.target.value)} aria-label="Move to stage"><option value="">Move to stage…</option>{stages.map(item => <option key={item}>{item}</option>)}</select>
            <button className="secondary-button" type="button" onClick={() => exportRows(selectedLeads)}><SafeIcon icon={FiIcons.FiDownload} /> Export</button>
            <button className="danger-button" type="button" onClick={removeSelected}><SafeIcon icon={FiIcons.FiTrash2} /> Delete</button>
            <button className="text-link" type="button" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select page" checked={allShownSelected} onChange={event => setSelected(event.target.checked ? [...new Set([...selected, ...shown.map(item => item.id)])] : selected.filter(id => !shown.some(item => item.id === id)))} /></th>
                <th>Lead</th><th>Score</th><th>Company</th><th>Source</th><th>Stage</th><th>Tags</th><th>Budget</th><th>Owner</th><th>Follow-up</th><th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(lead => (
                <tr key={lead.id}>
                  <td><input type="checkbox" aria-label={`Select ${lead.name}`} checked={selected.includes(lead.id)} onChange={event => setSelected(event.target.checked ? [...selected, lead.id] : selected.filter(id => id !== lead.id))} /></td>
                  <td><button type="button" className="lead-person" onClick={() => setProfileId(lead.id)}><span className="avatar avatar-blue">{initials(lead.name)}</span><span><b>{lead.name}</b><small>{lead.email}</small></span></button></td>
                  <td><ScoreBadge score={lead.score} /></td>
                  <td><b className="table-strong">{lead.company || '—'}</b><small className="table-sub">{lead.location}</small></td>
                  <td>{lead.source}</td>
                  <td><span className={`status-chip status-${lead.status.toLowerCase()}`}>{lead.status}</span></td>
                  <td><span className="tag-list compact">{(lead.tags || []).slice(0, 3).map(item => <span className="tag" key={item}>{item}</span>)}</span></td>
                  <td>{lead.budget ? `$${Number(lead.budget).toLocaleString()}` : '—'}</td>
                  <td>{lead.owner || 'Unassigned'}</td>
                  <td>{lead.followUp || '—'}</td>
                  <td><button className="icon-button small-icon" type="button" aria-label={`Edit ${lead.name}`} onClick={() => setEditing(lead)}><SafeIcon icon={FiIcons.FiEdit2} /></button></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="11" className="empty-cell">No leads match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
        </div>
      </section>
      {editing && <LeadEditor lead={editing.id ? editing : null} existingLeads={data.leads} onClose={closeEditor} onSave={saveLead} />}
      {profileId && <LeadProfile leadId={profileId} onClose={closeProfile} onEdit={openEditorFromProfile} />}
      {emailing && <EmailComposer recipients={emailing} onClose={() => setEmailing(null)} />}
    </div>
  );
}
