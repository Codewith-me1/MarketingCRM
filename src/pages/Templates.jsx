import React, { useRef, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { MERGE_FIELDS, mergeTemplate, uid } from '../common/crm';
import PageTitle from '../components/ui/PageTitle';
import { Field, Modal } from '../components/ui/Modal';
import EmailComposer from '../components/email/EmailComposer';

const CATEGORIES = ['Prospecting', 'Follow-up', 'Nurture', 'Sales', 'Onboarding', 'Other'];

function TemplateEditor({ template, onClose, onSave }) {
  const { data, displayName } = useCRM();
  const [draft, setDraft] = useState({ name: '', category: 'Prospecting', subject: '', body: '', ...template });
  const bodyRef = useRef(null);
  const sample = data.leads[0] || { name: 'Alex Morgan', company: 'Acme Inc', email: 'alex@example.com' };

  const insertField = key => {
    const token = `{{${key}}}`;
    const element = bodyRef.current;
    if (!element) return;
    const start = element.selectionStart ?? draft.body.length;
    const end = element.selectionEnd ?? draft.body.length;
    const body = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft(current => ({ ...current, body }));
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + token.length, start + token.length); });
  };

  return (
    <Modal
      eyebrow={template?.id ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}
      title={draft.name || 'Email template'}
      wide
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (draft.name.trim() && draft.subject.trim()) onSave(draft); }}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><SafeIcon icon={FiIcons.FiCheck} /> Save template</button></>}
    >
      <div className="editor-grid">
        <Field label="Template name" required><input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required /></Field>
        <Field label="Category"><select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Subject" required wide><input value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} required /></Field>
        <div className="field-wide merge-chips">
          <span>Insert merge field:</span>
          {MERGE_FIELDS.map(key => <button type="button" key={key} className="tag" onClick={() => insertField(key)}>{`{{${key}}}`}</button>)}
        </div>
        <Field label="Body" wide><textarea ref={bodyRef} rows="10" value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} /></Field>
        <div className="email-preview field-wide">
          <small>Preview for {sample.name}</small>
          <b>{mergeTemplate(draft.subject, sample, displayName)}</b>
          <pre>{mergeTemplate(draft.body, sample, displayName)}</pre>
        </div>
      </div>
    </Modal>
  );
}

export default function Templates() {
  const { data, update } = useCRM();
  const [editing, setEditing] = useState(null);
  const [category, setCategory] = useState('');
  const [sending, setSending] = useState(null);
  const [recipientTag, setRecipientTag] = useState('');
  const tags = [...new Set(data.leads.flatMap(lead => lead.tags || []))].sort();

  const save = draft => {
    update('templates', list => (draft.id ? list.map(item => (item.id === draft.id ? draft : item)) : [{ ...draft, id: uid() }, ...list]));
    setEditing(null);
  };

  const visible = data.templates.filter(template => !category || template.category === category);
  const audience = recipientTag ? data.leads.filter(lead => (lead.tags || []).includes(recipientTag)) : data.leads.filter(lead => !['Lost', 'Converted'].includes(lead.status));

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="EMAIL MARKETING"
        title="Email templates"
        description="Reusable, personalised emails for prospecting, follow-ups and nurture campaigns."
        actions={<button className="primary-button" type="button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> New template</button>}
      />
      <div className="table-toolbar plain-toolbar">
        <select className="soft-select" value={category} onChange={event => setCategory(event.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select>
        <span className="field-hint">Send to</span>
        <select className="soft-select" value={recipientTag} onChange={event => setRecipientTag(event.target.value)} aria-label="Audience">
          <option value="">All active leads</option>
          {tags.map(tag => <option key={tag} value={tag}>Leads tagged #{tag}</option>)}
        </select>
        <span className="field-hint">{audience.length} recipients</span>
      </div>
      <section className="card-grid">
        {visible.map(template => (
          <article className="panel template-card" key={template.id}>
            <div className="panel-heading">
              <div><span className="status-chip">{template.category}</span><h2>{template.name}</h2><p>{template.subject}</p></div>
            </div>
            <pre className="template-snippet">{template.body}</pre>
            <div className="card-actions">
              <button className="primary-button" type="button" onClick={() => setSending(template)} disabled={!audience.length}><SafeIcon icon={FiIcons.FiSend} /> Send to {audience.length}</button>
              <button className="secondary-button" type="button" onClick={() => setEditing(template)}><SafeIcon icon={FiIcons.FiEdit2} /> Edit</button>
              <button className="secondary-button" type="button" onClick={() => update('templates', list => [{ ...template, id: uid(), name: `${template.name} (copy)` }, ...list])}><SafeIcon icon={FiIcons.FiCopy} /></button>
              <button className="icon-button small-icon" type="button" aria-label={`Delete ${template.name}`} onClick={() => window.confirm(`Delete template "${template.name}"?`) && update('templates', list => list.filter(item => item.id !== template.id))}><SafeIcon icon={FiIcons.FiTrash2} /></button>
            </div>
          </article>
        ))}
        {!visible.length && <div className="panel empty-cell">No templates in this category.</div>}
      </section>
      {editing && <TemplateEditor template={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} />}
      {sending && <EmailComposer recipients={audience} initialTemplateId={sending.id} onClose={() => setSending(null)} />}
    </div>
  );
}

