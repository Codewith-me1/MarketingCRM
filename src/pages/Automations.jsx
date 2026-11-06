import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { ACTION_TYPES, TRIGGERS, uid } from '../common/crm';
import { leadSources, stages } from '../data/seed';
import PageTitle from '../components/ui/PageTitle';
import { Field, Modal } from '../components/ui/Modal';

const CONDITION_FIELDS = { '': 'Any lead', status: 'Stage is', source: 'Source is', priority: 'Priority is', campaign: 'Campaign is' };
const CONDITION_OPTIONS = { status: stages, source: leadSources, priority: ['Low', 'Medium', 'High'] };

const describeAction = action => {
  if (action.type === 'create_task') return `create task "${action.title}" due in ${action.dueInDays || 0} day(s)`;
  if (action.type === 'assign_owner') return `assign to ${action.owner || '—'}`;
  if (action.type === 'add_tag') return `tag #${action.tag || '—'}`;
  if (action.type === 'set_priority') return `set priority ${action.priority}`;
  return action.type;
};

function RuleEditor({ rule, onClose, onSave }) {
  const { ownerOptions } = useCRM();
  const [draft, setDraft] = useState({ name: '', active: true, trigger: 'lead_created', conditionField: '', conditionValue: '', actions: [{ type: 'create_task', title: 'Follow up with {{name}}', taskType: 'Follow-up', dueInDays: 1 }], runs: 0, ...rule });
  const setAction = (index, changes) => setDraft(current => ({ ...current, actions: current.actions.map((action, i) => (i === index ? { ...action, ...changes } : action)) }));
  const options = CONDITION_OPTIONS[draft.conditionField];

  return (
    <Modal
      eyebrow="WORKFLOW"
      title={rule?.id ? 'Edit automation' : 'New automation'}
      wide
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (draft.name.trim() && draft.actions.length) onSave(draft); }}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><SafeIcon icon={FiIcons.FiCheck} /> Save automation</button></>}
    >
      <div className="editor-grid">
        <Field label="Name" required wide><input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required /></Field>
        <Field label="When"><select value={draft.trigger} onChange={event => setDraft({ ...draft, trigger: event.target.value, ...(event.target.value === 'stage_changed' && !draft.conditionField ? { conditionField: 'status', conditionValue: 'Qualified' } : {}) })}>{Object.entries(TRIGGERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Only if">
          <span className="inline-pair">
            <select value={draft.conditionField} onChange={event => setDraft({ ...draft, conditionField: event.target.value, conditionValue: CONDITION_OPTIONS[event.target.value]?.[0] || '' })}>{Object.entries(CONDITION_FIELDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            {draft.conditionField && (options
              ? <select value={draft.conditionValue} onChange={event => setDraft({ ...draft, conditionValue: event.target.value })}>{options.map(item => <option key={item}>{item}</option>)}</select>
              : <input value={draft.conditionValue} onChange={event => setDraft({ ...draft, conditionValue: event.target.value })} />)}
          </span>
        </Field>
        <div className="field-wide">
          <h3 className="drawer-section">Then</h3>
          {draft.actions.map((action, index) => (
            <div className="action-row" key={index}>
              <select value={action.type} onChange={event => setAction(index, { type: event.target.value })} aria-label="Action">{Object.entries(ACTION_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              {action.type === 'create_task' && <>
                <input value={action.title || ''} onChange={event => setAction(index, { title: event.target.value })} placeholder="Task title, e.g. Call {{name}}" aria-label="Task title" />
                <select value={action.taskType || 'Follow-up'} onChange={event => setAction(index, { taskType: event.target.value })} aria-label="Task type">{['Follow-up', 'Call', 'Meeting', 'Email', 'Reminder'].map(item => <option key={item}>{item}</option>)}</select>
                <input type="number" min="0" value={action.dueInDays ?? 1} onChange={event => setAction(index, { dueInDays: Number(event.target.value) })} aria-label="Due in days" title="Due in days" className="narrow-input" />
              </>}
              {action.type === 'assign_owner' && <select value={action.owner || ''} onChange={event => setAction(index, { owner: event.target.value })} aria-label="Owner"><option value="">Choose…</option>{ownerOptions.map(item => <option key={item}>{item}</option>)}</select>}
              {action.type === 'add_tag' && <input value={action.tag || ''} onChange={event => setAction(index, { tag: event.target.value })} placeholder="tag" aria-label="Tag" />}
              {action.type === 'set_priority' && <select value={action.priority || 'High'} onChange={event => setAction(index, { priority: event.target.value })} aria-label="Priority">{['Low', 'Medium', 'High'].map(item => <option key={item}>{item}</option>)}</select>}
              <button className="icon-button small-icon" type="button" aria-label="Remove action" onClick={() => setDraft(current => ({ ...current, actions: current.actions.filter((_, i) => i !== index) }))}><SafeIcon icon={FiIcons.FiX} /></button>
            </div>
          ))}
          <button className="text-link" type="button" onClick={() => setDraft(current => ({ ...current, actions: [...current.actions, { type: 'add_tag', tag: '' }] }))}><SafeIcon icon={FiIcons.FiPlus} /> Add action</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Automations() {
  const { data, update } = useCRM();
  const [editing, setEditing] = useState(null);

  const save = draft => {
    update('automations', list => (draft.id ? list.map(item => (item.id === draft.id ? draft : item)) : [{ ...draft, id: uid() }, ...list]));
    setEditing(null);
  };

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="WORKFLOW AUTOMATION"
        title="Automations"
        description="Rules that run automatically when leads are created or move stage — no manual busywork."
        actions={<button className="primary-button" type="button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> New automation</button>}
      />
      <section className="card-grid">
        {data.automations.map(rule => (
          <article className={`panel rule-card${rule.active ? '' : ' is-paused'}`} key={rule.id}>
            <div className="panel-heading">
              <div><h2><SafeIcon icon={FiIcons.FiZap} /> {rule.name}</h2><p>Ran {rule.runs || 0} time{rule.runs === 1 ? '' : 's'}{rule.lastRun ? ` · last ${new Date(rule.lastRun).toLocaleDateString()}` : ''}</p></div>
              <label className="switch" title={rule.active ? 'Active' : 'Paused'}>
                <input type="checkbox" checked={rule.active} onChange={() => update('automations', list => list.map(item => (item.id === rule.id ? { ...item, active: !item.active } : item)))} aria-label={`Toggle ${rule.name}`} />
                <i></i>
              </label>
            </div>
            <ol className="rule-steps">
              <li><b>When</b> {TRIGGERS[rule.trigger].toLowerCase()}{rule.conditionField ? ` and ${CONDITION_FIELDS[rule.conditionField].toLowerCase()} "${rule.conditionValue}"` : ''}</li>
              {rule.actions.map((action, index) => <li key={index}><b>Then</b> {describeAction(action)}</li>)}
            </ol>
            <div className="card-actions">
              <button className="secondary-button" type="button" onClick={() => setEditing(rule)}><SafeIcon icon={FiIcons.FiEdit2} /> Edit</button>
              <button className="icon-button small-icon" type="button" aria-label={`Delete ${rule.name}`} onClick={() => window.confirm(`Delete automation "${rule.name}"?`) && update('automations', list => list.filter(item => item.id !== rule.id))}><SafeIcon icon={FiIcons.FiTrash2} /></button>
            </div>
          </article>
        ))}
        {!data.automations.length && <div className="panel empty-cell">No automations yet.</div>}
      </section>
      {editing && <RuleEditor rule={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
