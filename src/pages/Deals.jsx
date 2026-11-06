import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials, money, today } from '../common/format';
import { addDays, uid } from '../common/crm';
import { dealStageProbability, dealStages } from '../data/seed';
import PageTitle from '../components/ui/PageTitle';
import StatCard from '../components/ui/StatCard';
import { Field, Modal } from '../components/ui/Modal';

const STAGE_CLASS = { Qualification: 'new', 'Needs analysis': 'contacted', Proposal: 'proposal', Negotiation: 'negotiation', Won: 'converted', Lost: 'lost' };

function DealEditor({ deal, onClose, onSave, onDelete }) {
  const { data, ownerOptions, displayName } = useCRM();
  const [draft, setDraft] = useState({
    name: '', company: '', contact: '', value: '', stage: 'Qualification', probability: 10, closeDate: addDays(30), owner: displayName, notes: '', ...deal
  });
  const set = key => event => setDraft(current => ({ ...current, [key]: event.target.value }));
  const setStage = event => {
    const stage = event.target.value;
    setDraft(current => ({ ...current, stage, probability: dealStageProbability[stage] ?? current.probability }));
  };
  const companyNames = [...new Set([...data.companies.map(item => item.name), ...data.leads.map(item => item.company).filter(Boolean)])];

  return (
    <Modal
      eyebrow={deal?.id ? 'UPDATE DEAL' : 'NEW DEAL'}
      title={deal?.id ? draft.name || 'Edit deal' : 'Create a deal'}
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim(), value: Number(draft.value) || 0, probability: Number(draft.probability) || 0 }); }}
      footer={(
        <>
          {deal?.id && <button className="danger-button" type="button" onClick={() => onDelete(deal)}><SafeIcon icon={FiIcons.FiTrash2} /> Delete</button>}
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit"><SafeIcon icon={FiIcons.FiCheck} /> Save deal</button>
        </>
      )}
    >
      <div className="editor-grid">
        <Field label="Deal name" required wide><input value={draft.name} onChange={set('name')} required /></Field>
        <Field label="Company"><input list="deal-companies" value={draft.company} onChange={set('company')} /><datalist id="deal-companies">{companyNames.map(name => <option key={name} value={name} />)}</datalist></Field>
        <Field label="Primary contact"><input list="deal-contacts" value={draft.contact} onChange={set('contact')} /><datalist id="deal-contacts">{data.leads.map(lead => <option key={lead.id} value={lead.name} />)}</datalist></Field>
        <Field label="Value ($)"><input type="number" min="0" value={draft.value} onChange={set('value')} /></Field>
        <Field label="Stage"><select value={draft.stage} onChange={setStage}>{dealStages.map(stage => <option key={stage}>{stage}</option>)}</select></Field>
        <Field label="Win probability (%)"><input type="number" min="0" max="100" value={draft.probability} onChange={set('probability')} /></Field>
        <Field label="Expected close date"><input type="date" value={draft.closeDate} onChange={set('closeDate')} /></Field>
        <Field label="Owner"><select value={draft.owner} onChange={set('owner')}><option value="">Unassigned</option>{[...new Set([draft.owner, ...ownerOptions].filter(Boolean))].map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Notes" wide><textarea rows="3" value={draft.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

export default function Deals() {
  const { data, update } = useCRM();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const id = searchParams.get('open');
    if (searchParams.get('new') === '1') setEditing({});
    if (id) {
      const deal = data.deals.find(item => item.id === id);
      if (deal) setEditing(deal);
    }
    if (id || searchParams.get('new')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, data.deals]);

  const deals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.deals.filter(deal => !query || `${deal.name} ${deal.company} ${deal.contact} ${deal.owner}`.toLowerCase().includes(query));
  }, [data.deals, search]);

  const stats = useMemo(() => {
    const open = data.deals.filter(deal => !['Won', 'Lost'].includes(deal.stage));
    const won = data.deals.filter(deal => deal.stage === 'Won');
    const closed = data.deals.filter(deal => ['Won', 'Lost'].includes(deal.stage));
    const month = today().slice(0, 7);
    return {
      pipeline: open.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
      weighted: open.reduce((sum, deal) => sum + (Number(deal.value || 0) * Number(deal.probability || 0)) / 100, 0),
      wonMonth: won.filter(deal => (deal.closeDate || '').startsWith(month)).reduce((sum, deal) => sum + Number(deal.value || 0), 0),
      winRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
      openCount: open.length
    };
  }, [data.deals]);

  const save = draft => {
    update('deals', list => (draft.id ? list.map(item => (item.id === draft.id ? draft : item)) : [{ ...draft, id: uid() }, ...list]));
    setEditing(null);
  };
  const remove = deal => {
    if (!window.confirm(`Delete deal "${deal.name}"?`)) return;
    update('deals', list => list.filter(item => item.id !== deal.id));
    setEditing(null);
  };
  const moveDeal = (id, stage) => update('deals', list => list.map(deal => (deal.id === id ? { ...deal, stage, probability: dealStageProbability[stage] ?? deal.probability, ...(stage === 'Won' && !deal.closeDate ? { closeDate: today() } : {}) } : deal)));

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="SALES PIPELINE"
        title="Deals"
        description="Track opportunities from qualification to close and forecast revenue."
        actions={(
          <>
            <div className="segmented" role="tablist" aria-label="View">
              <button type="button" className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><SafeIcon icon={FiIcons.FiColumns} /> Board</button>
              <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><SafeIcon icon={FiIcons.FiList} /> List</button>
            </div>
            <button className="primary-button" type="button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> New deal</button>
          </>
        )}
      />
      <section className="stats-grid">
        <StatCard label="Open pipeline" value={money(stats.pipeline)} change={`${stats.openCount}`} note="open deals" icon={FiIcons.FiLayers} tone="blue" />
        <StatCard label="Weighted forecast" value={money(stats.weighted)} change="Σ" note="value × probability" icon={FiIcons.FiTrendingUp} tone="violet" />
        <StatCard label="Won this month" value={money(stats.wonMonth)} change="●" note="by close date" icon={FiIcons.FiAward} tone="green" />
        <StatCard label="Win rate" value={`${stats.winRate}%`} change="●" note="of closed deals" icon={FiIcons.FiTarget} tone="amber" />
      </section>
      <div className="table-toolbar plain-toolbar">
        <label className="table-search"><SafeIcon icon={FiIcons.FiSearch} /><input placeholder="Search deals, companies, contacts…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>

      {view === 'board' ? (
        <div className="kanban-board">
          {dealStages.map(stage => {
            const items = deals.filter(deal => deal.stage === stage);
            const total = items.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
            return (
              <section className="kanban-column" key={stage} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); moveDeal(event.dataTransfer.getData('deal-id'), stage); }}>
                <header><div><span className={`stage-indicator stage-${STAGE_CLASS[stage]}`}></span><b>{stage}</b><small>{items.length}</small></div><span className="kanban-total">{money(total)}</span></header>
                <div className="kanban-cards">
                  {items.map(deal => (
                    <article className="kanban-card" key={deal.id} draggable onDragStart={event => event.dataTransfer.setData('deal-id', deal.id)} onClick={() => setEditing(deal)} onKeyDown={event => event.key === 'Enter' && setEditing(deal)} tabIndex={0} role="button">
                      <div className="kanban-card-top"><span className="priority-label">{deal.probability}% likely</span></div>
                      <h3>{deal.name}</h3>
                      <p>{deal.company || deal.contact}</p>
                      <div className="kanban-card-meta"><span><SafeIcon icon={FiIcons.FiDollarSign} />{money(deal.value)}</span><span className="avatar avatar-mini" title={deal.owner}>{initials(deal.owner)}</span></div>
                      <footer><span>{deal.contact}</span><span className={deal.closeDate && deal.closeDate < today() && !['Won', 'Lost'].includes(deal.stage) ? 'overdue-text' : ''}>{deal.closeDate || 'No close date'}</span></footer>
                    </article>
                  ))}
                  {!items.length && <div className="drop-hint">Drop deal here</div>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Deal</th><th>Company</th><th>Stage</th><th>Value</th><th>Probability</th><th>Weighted</th><th>Close date</th><th>Owner</th></tr></thead>
              <tbody>
                {deals.map(deal => (
                  <tr key={deal.id}>
                    <td><button type="button" className="lead-person" onClick={() => setEditing(deal)}><span><b>{deal.name}</b><small>{deal.contact}</small></span></button></td>
                    <td>{deal.company || '—'}</td>
                    <td><span className={`status-chip status-${STAGE_CLASS[deal.stage]}`}>{deal.stage}</span></td>
                    <td><b className="table-strong">{money(deal.value)}</b></td>
                    <td>{deal.probability}%</td>
                    <td>{money((Number(deal.value || 0) * Number(deal.probability || 0)) / 100)}</td>
                    <td>{deal.closeDate || '—'}</td>
                    <td>{deal.owner || 'Unassigned'}</td>
                  </tr>
                ))}
                {!deals.length && <tr><td className="empty-cell" colSpan="8">No deals yet. Create one or convert a lead from its profile.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {editing && <DealEditor deal={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />}
    </div>
  );
}
