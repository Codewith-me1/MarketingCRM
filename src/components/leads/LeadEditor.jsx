import React, { useEffect, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { stages } from '../../data/seed';
import { today } from '../../common/format';
import { useCRM } from '../../data/CRMContext';

const SOURCES = ['Website', 'LinkedIn', 'Referral', 'Google Ads', 'Webinar', 'Conference', 'Cold outreach', 'Import', 'Other'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeadEditor({ lead, existingLeads = [], onClose, onSave }) {
  const { ownerOptions, displayName } = useCRM();
  const [draft, setDraft] = useState(() => ({
    name: '', email: '', phone: '', whatsapp: '', company: '', location: '', source: 'Website', campaign: '',
    status: 'New', priority: 'Medium', budget: '', owner: displayName, notes: '', followUp: '', createdAt: today(),
    ...lead
  }));
  const [error, setError] = useState('');
  const owners = draft.owner && !ownerOptions.includes(draft.owner) ? [draft.owner, ...ownerOptions] : ownerOptions;

  useEffect(() => {
    const onKey = event => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const field = (label, key, type = 'text', required = false) => (
    <label className="field-label">{label}{required && <em>*</em>}
      <input required={required} type={type} value={draft[key] ?? ''} onChange={event => update(key, event.target.value)} />
    </label>
  );

  const submit = event => {
    event.preventDefault();
    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();

    if (!name || !EMAIL_PATTERN.test(email)) {
      setError('Enter a full name and a valid email address.');
      return;
    }
    if (existingLeads.some(item => item.id !== lead?.id && item.email?.toLowerCase() === email)) {
      setError('A lead with this email address already exists.');
      return;
    }

    onSave({ ...draft, name, email, budget: Number(draft.budget) || 0 });
  };

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <form className="modal-card" onSubmit={submit} role="dialog" aria-modal="true" aria-label={lead ? 'Edit lead' : 'Add a lead'}>
        <header className="modal-heading">
          <div><span className="eyebrow">{lead ? 'UPDATE RECORD' : 'NEW OPPORTUNITY'}</span><h2>{lead ? 'Edit lead' : 'Add a lead'}</h2></div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}><SafeIcon icon={FiIcons.FiX} /></button>
        </header>
        <div className="editor-grid">
          {field('Full name', 'name', 'text', true)}{field('Work email', 'email', 'email', true)}{field('Phone', 'phone', 'tel')}{field('WhatsApp', 'whatsapp', 'tel')}{field('Company', 'company')}{field('Location', 'location')}
          <label className="field-label">Source<select value={draft.source} onChange={event => update('source', event.target.value)}>{SOURCES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field-label">Stage<select value={draft.status} onChange={event => update('status', event.target.value)}>{stages.map(item => <option key={item}>{item}</option>)}</select></label>
          {field('Campaign', 'campaign')}{field('Budget ($)', 'budget', 'number')}
          <label className="field-label">Priority<select value={draft.priority} onChange={event => update('priority', event.target.value)}>{['Low', 'Medium', 'High'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field-label">Assigned to<select value={draft.owner} onChange={event => update('owner', event.target.value)}>{owners.map(item => <option key={item}>{item}</option>)}</select></label>
          {field('Follow-up date', 'followUp', 'date')}
          <label className="field-label field-wide">Notes<textarea rows="3" value={draft.notes} onChange={event => update('notes', event.target.value)} placeholder="Add context for your next conversation..." /></label>
          {error && <p className="auth-feedback auth-error field-wide" role="alert">{error}</p>}
        </div>
        <footer className="modal-footer">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit"><SafeIcon icon={FiIcons.FiCheck} /> {lead ? 'Save changes' : 'Create lead'}</button>
        </footer>
      </form>
    </div>
  );
}
