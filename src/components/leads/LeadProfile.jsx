import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { Drawer } from '../ui/Modal';
import { useCRM } from '../../data/CRMContext';
import { money } from '../../common/format';
import { stages, dealStageProbability } from '../../data/seed';
import { addDays, leadScore, scoreBand, timelineEntry, uid } from '../../common/crm';
import EmailComposer from '../email/EmailComposer';
import OutreachBadge from '../../integrations/successai/OutreachBadge';
import AddToCampaignModal from '../../integrations/successai/AddToCampaignModal';
import { useSuccessAi } from '../../integrations/successai/SuccessAiProvider';

const TIMELINE_ICONS = {
  note: FiIcons.FiFileText, call: FiIcons.FiPhone, email: FiIcons.FiMail, meeting: FiIcons.FiUsers,
  stage: FiIcons.FiGitBranch, automation: FiIcons.FiZap, form: FiIcons.FiInbox, system: FiIcons.FiStar, deal: FiIcons.FiDollarSign
};

export function ScoreBadge({ score }) {
  const band = scoreBand(score);
  return <span className={`score-badge score-${band}`} title={`Lead score ${score}/100 (${band})`}>{score}</span>;
}

export default function LeadProfile({ leadId, onClose, onEdit }) {
  const { data, update, displayName } = useCRM();
  const navigate = useNavigate();
  const lead = data.leads.find(item => item.id === leadId);
  const [entryType, setEntryType] = useState('note');
  const [entryText, setEntryText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [composing, setComposing] = useState(false);
  const [addingToCampaign, setAddingToCampaign] = useState(false);
  const [checking, setChecking] = useState('');
  const sai = useSuccessAi();

  if (!lead) return null;

  const score = leadScore(lead, data.activities);
  const tasks = data.activities.filter(item => item.lead === lead.name);
  const deals = data.deals.filter(deal => deal.contact === lead.name || (lead.company && deal.company === lead.company));
  const phoneDigits = (lead.whatsapp || lead.phone || '').replace(/[^\d]/g, '');

  const patch = changes => update('leads', list => list.map(item => (item.id === lead.id ? { ...item, ...changes } : item)));

  const addEntry = event => {
    event.preventDefault();
    if (!entryText.trim()) return;
    patch({ timeline: [timelineEntry(entryType, entryText.trim(), displayName), ...(lead.timeline || [])] });
    setEntryText('');
  };

  const addTag = event => {
    event.preventDefault();
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    patch({ tags: [...new Set([...(lead.tags || []), tag])] });
    setTagInput('');
  };

  const convertToDeal = () => {
    const deal = {
      id: uid(), name: `${lead.company || lead.name} opportunity`, company: lead.company, contact: lead.name,
      value: Number(lead.budget) || 0, stage: 'Qualification', probability: dealStageProbability.Qualification,
      closeDate: addDays(30), owner: lead.owner || displayName, notes: lead.notes || ''
    };
    update('deals', list => [deal, ...list]);
    if (lead.company && !data.companies.some(company => company.name.toLowerCase() === lead.company.toLowerCase())) {
      update('companies', list => [{ id: uid(), name: lead.company, industry: '', website: '', phone: '', size: '', city: lead.location || '', owner: lead.owner || displayName, notes: '' }, ...list]);
    }
    patch({
      status: ['Converted', 'Lost'].includes(lead.status) ? lead.status : 'Qualified',
      timeline: [timelineEntry('deal', `Deal created: ${deal.name}`, displayName), ...(lead.timeline || [])]
    });
    navigate(`/deals?open=${deal.id}`);
  };

  return (
    <>
      <Drawer
        title={lead.name}
        subtitle={[lead.company, lead.location].filter(Boolean).join(' · ')}
        onClose={onClose}
        actions={(
          <>
            <button className="secondary-button" type="button" onClick={() => setComposing(true)} disabled={!lead.email}><SafeIcon icon={FiIcons.FiMail} /> Email</button>
            {lead.phone && <a className="secondary-button" href={`tel:${lead.phone}`} onClick={() => patch({ timeline: [timelineEntry('call', `Called ${lead.phone}`, displayName), ...(lead.timeline || [])] })}><SafeIcon icon={FiIcons.FiPhone} /> Call</a>}
            {phoneDigits && <a className="secondary-button" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer"><SafeIcon icon={FiIcons.FiMessageCircle} /> WhatsApp</a>}
            <button className="secondary-button" type="button" onClick={convertToDeal}><SafeIcon icon={FiIcons.FiDollarSign} /> Convert to deal</button>
            <button className="primary-button" type="button" onClick={() => onEdit(lead)}><SafeIcon icon={FiIcons.FiEdit2} /> Edit</button>
          </>
        )}
      >
        <section className="profile-summary">
          <div className="profile-score"><ScoreBadge score={score} /><span><b>Lead score</b><small>{scoreBand(score)} lead</small></span></div>
          <label className="field-label">Stage
            <select value={lead.status} onChange={event => patch({ status: event.target.value })}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select>
          </label>
        </section>

        <dl className="profile-facts">
          <div><dt>Email</dt><dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</dd></div>
          <div><dt>Phone</dt><dd>{lead.phone || '—'}</dd></div>
          <div><dt>Owner</dt><dd>{lead.owner || 'Unassigned'}</dd></div>
          <div><dt>Source</dt><dd>{lead.source}{lead.formName ? ` (${lead.formName})` : ''}</dd></div>
          <div><dt>Budget</dt><dd>{lead.budget ? money(lead.budget) : '—'}</dd></div>
          <div><dt>Follow-up</dt><dd>{lead.followUp || '—'}</dd></div>
          <div><dt>Campaign</dt><dd>{lead.campaign || '—'}</dd></div>
          <div><dt>Created</dt><dd>{lead.createdAt || '—'}</dd></div>
        </dl>
        {lead.notes && <p className="profile-notes">{lead.notes}</p>}

        {sai?.connection.configured && (
          <>
            <h3 className="drawer-section">Success.ai outreach</h3>
            <div className="outreach-panel">
              {lead.successai?.campaignId
                ? <div><OutreachBadge lead={lead} showCampaign /><small>Checked {lead.successai.checkedAt ? new Date(lead.successai.checkedAt).toLocaleString() : 'never'}{lead.successai.campaigns > 1 ? ` · in ${lead.successai.campaigns} campaigns` : ''}{lead.successai.pendingStatus ? ` · will set "${lead.successai.pendingStatus}" on next sync` : ''}</small></div>
                : <small>{lead.successai?.notFound ? `Not found in any Success.ai campaign (checked ${new Date(lead.successai.checkedAt).toLocaleDateString()}).` : 'Not linked to a Success.ai campaign yet.'}</small>}
              <span className="outreach-actions">
                <button className="secondary-button" type="button" disabled={!lead.email || Boolean(checking)} onClick={async () => {
                  setChecking('…');
                  try { const [result] = await sai.checkLeads([lead]); setChecking(result?.found ? '' : 'Not in any campaign'); } catch (error) { setChecking(error.message); }
                }}><SafeIcon icon={FiIcons.FiRefreshCw} /> Check now</button>
                {sai.canManage && <button className="secondary-button" type="button" disabled={!lead.email} onClick={() => setAddingToCampaign(true)}><SafeIcon icon={FiIcons.FiSend} /> Add to campaign</button>}
              </span>
              {checking && checking !== '…' && <small className="field-hint">{checking}</small>}
            </div>
          </>
        )}

        <h3 className="drawer-section">Tags</h3>
        <div className="tag-list">
          {(lead.tags || []).map(tag => (
            <span className="tag" key={tag}>{tag}<button type="button" aria-label={`Remove tag ${tag}`} onClick={() => patch({ tags: lead.tags.filter(item => item !== tag) })}><SafeIcon icon={FiIcons.FiX} /></button></span>
          ))}
          <form onSubmit={addTag} className="tag-form"><input value={tagInput} onChange={event => setTagInput(event.target.value)} placeholder="Add tag…" aria-label="Add tag" /></form>
        </div>

        {deals.length > 0 && (
          <>
            <h3 className="drawer-section">Deals</h3>
            <div className="mini-list">
              {deals.map(deal => (
                <button type="button" key={deal.id} className="mini-row" onClick={() => navigate(`/deals?open=${deal.id}`)}>
                  <b>{deal.name}</b><span>{deal.stage}</span><strong>{money(deal.value)}</strong>
                </button>
              ))}
            </div>
          </>
        )}

        <h3 className="drawer-section">Tasks</h3>
        <div className="mini-list">
          {tasks.map(task => (
            <label className={`mini-row${task.done ? ' is-done' : ''}`} key={task.id}>
              <input type="checkbox" checked={task.done} onChange={() => update('activities', list => list.map(item => (item.id === task.id ? { ...item, done: !item.done } : item)))} />
              <b>{task.title}</b><span>{task.type}</span><span>{task.due}</span>
            </label>
          ))}
          {!tasks.length && <p className="field-hint">No tasks linked to this lead.</p>}
          <button className="text-link" type="button" onClick={() => update('activities', list => [{ id: uid(), title: `Follow up with ${lead.name}`, type: 'Follow-up', due: addDays(2), owner: lead.owner || displayName, lead: lead.name, done: false }, ...list])}>
            <SafeIcon icon={FiIcons.FiPlus} /> Add follow-up task
          </button>
        </div>

        <h3 className="drawer-section">Timeline</h3>
        <form className="timeline-form" onSubmit={addEntry}>
          <select value={entryType} onChange={event => setEntryType(event.target.value)} aria-label="Entry type">
            <option value="note">Note</option><option value="call">Call log</option><option value="meeting">Meeting</option><option value="email">Email log</option>
          </select>
          <input value={entryText} onChange={event => setEntryText(event.target.value)} placeholder="What happened?" aria-label="Timeline entry" />
          <button className="primary-button" type="submit">Log</button>
        </form>
        <ol className="timeline">
          {(lead.timeline || []).map(entry => (
            <li key={entry.id}>
              <span className={`timeline-icon timeline-${entry.type}`}><SafeIcon icon={TIMELINE_ICONS[entry.type] || FiIcons.FiCircle} /></span>
              <div><p>{entry.text}</p><small>{entry.by ? `${entry.by} · ` : ''}{new Date(entry.at).toLocaleString()}</small></div>
            </li>
          ))}
          {!(lead.timeline || []).length && <li className="field-hint">No history yet. Log a note, call or meeting above.</li>}
        </ol>
      </Drawer>
      {addingToCampaign && <AddToCampaignModal leads={[lead]} onClose={() => setAddingToCampaign(false)} />}
      {composing && <EmailComposer recipients={[lead]} onClose={() => setComposing(false)} />}
    </>
  );
}
