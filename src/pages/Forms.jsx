import React, { useCallback, useEffect, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { leadSources } from '../data/seed';
import PageTitle from '../components/ui/PageTitle';
import { Field, Modal } from '../components/ui/Modal';
import { AVAILABLE_FIELDS, deleteForm, embedCode, listForms, listSubmissions, publicFormUrl, saveForm } from '../supabase/formService';

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'company', label: 'Company', required: false },
  { key: 'message', label: 'How can we help?', required: false }
];

function FormEditor({ form, onClose, onSaved }) {
  const { workspaceOwnerId, ownerOptions, data } = useCRM();
  const [draft, setDraft] = useState({
    name: 'Contact form', title: 'Get in touch', description: '', fields: DEFAULT_FIELDS, source: 'Web form', campaign: '',
    owner: '', tag: '', success_message: 'Thanks! We will be in touch shortly.', active: true, ...form
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setDraft(current => ({ ...current, [key]: event.target.value }));

  const toggleField = key => {
    if (key === 'email') return; // required to create a lead
    setDraft(current => {
      const exists = current.fields.some(field => field.key === key);
      const meta = AVAILABLE_FIELDS.find(field => field.key === key);
      const fields = exists
        ? current.fields.filter(field => field.key !== key)
        : AVAILABLE_FIELDS.filter(field => field.key === key || current.fields.some(item => item.key === field.key))
          .map(field => current.fields.find(item => item.key === field.key) || { key: field.key, label: meta.label, required: false });
      return { ...current, fields };
    });
  };
  const setFieldProp = (key, changes) => setDraft(current => ({ ...current, fields: current.fields.map(field => (field.key === key ? { ...field, ...changes } : field)) }));

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(await saveForm(workspaceOwnerId, draft));
    } catch (requestError) {
      setError(requestError.message || 'The form could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="LEAD CAPTURE"
      title={form?.id ? 'Edit form' : 'New web form'}
      wide
      onClose={onClose}
      onSubmit={submit}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy}><SafeIcon icon={FiIcons.FiCheck} /> {busy ? 'Saving…' : 'Save form'}</button></>}
    >
      <div className="editor-grid">
        <Field label="Internal name" required><input value={draft.name} onChange={set('name')} required /></Field>
        <Field label="Status"><select value={draft.active ? 'on' : 'off'} onChange={event => setDraft({ ...draft, active: event.target.value === 'on' })}><option value="on">Accepting responses</option><option value="off">Paused</option></select></Field>
        <Field label="Heading shown to visitors" required wide><input value={draft.title} onChange={set('title')} required /></Field>
        <Field label="Intro text" wide><textarea rows="2" value={draft.description} onChange={set('description')} /></Field>
        <div className="field-wide">
          <h3 className="drawer-section">Fields</h3>
          {AVAILABLE_FIELDS.map(meta => {
            const field = draft.fields.find(item => item.key === meta.key);
            return (
              <div className="action-row" key={meta.key}>
                <label className="check-label"><input type="checkbox" checked={Boolean(field)} disabled={meta.key === 'email'} onChange={() => toggleField(meta.key)} /> {meta.label}</label>
                {field && <input value={field.label} onChange={event => setFieldProp(meta.key, { label: event.target.value })} aria-label={`${meta.label} label`} />}
                {field && <label className="check-label"><input type="checkbox" checked={field.required} disabled={meta.key === 'email'} onChange={event => setFieldProp(meta.key, { required: event.target.checked })} /> Required</label>}
              </div>
            );
          })}
        </div>
        <Field label="Lead source"><select value={draft.source} onChange={set('source')}>{leadSources.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Campaign"><input list="form-campaigns" value={draft.campaign} onChange={set('campaign')} /><datalist id="form-campaigns">{data.campaigns.map(item => <option key={item.id} value={item.name} />)}</datalist></Field>
        <Field label="Assign new leads to"><select value={draft.owner} onChange={set('owner')}><option value="">Unassigned (or automation)</option>{ownerOptions.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Tag new leads"><input value={draft.tag} onChange={set('tag')} placeholder="e.g. website" /></Field>
        <Field label="Thank-you message" wide><input value={draft.success_message} onChange={set('success_message')} /></Field>
        {error && <p className="auth-feedback auth-error field-wide" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export default function Forms() {
  const { workspaceOwnerId, importSubmissions } = useCRM();
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceOwnerId) return;
    try {
      const [nextForms, nextSubmissions] = await Promise.all([listForms(workspaceOwnerId), listSubmissions(workspaceOwnerId)]);
      setForms(nextForms);
      setSubmissions(nextSubmissions);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceOwnerId]);

  useEffect(() => { load(); }, [load]);

  const copy = async (text, message) => {
    try { await navigator.clipboard.writeText(text); setNotice(message); } catch { setNotice('Copy was blocked by the browser.'); }
  };

  const importNow = async () => {
    const count = await importSubmissions();
    setNotice(count ? `Imported ${count} submission${count === 1 ? '' : 's'} into Leads.` : 'No new submissions to import.');
    load();
  };

  const formName = id => forms.find(form => form.id === id)?.name || 'Deleted form';

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="LEAD CAPTURE"
        title="Web forms"
        description="Publish forms on your website or share a link. Every submission becomes a lead automatically."
        actions={(
          <>
            <button className="secondary-button" type="button" onClick={importNow}><SafeIcon icon={FiIcons.FiRefreshCw} /> Import now</button>
            <button className="primary-button" type="button" onClick={() => setEditing({})}><SafeIcon icon={FiIcons.FiPlus} /> New form</button>
          </>
        )}
      />
      {error && <p className="role-note role-error" role="alert">{error}</p>}
      {notice && <p className="role-note role-success" role="status">{notice}</p>}
      <section className="card-grid">
        {forms.map(form => (
          <article className={`panel rule-card${form.active ? '' : ' is-paused'}`} key={form.id}>
            <div className="panel-heading">
              <div><h2><SafeIcon icon={FiIcons.FiInbox} /> {form.name}</h2><p>{form.active ? 'Accepting responses' : 'Paused'} · {submissions.filter(item => item.form_id === form.id).length} recent submissions</p></div>
            </div>
            <p className="field-hint">{form.title} — {form.fields.map(field => field.label).join(', ')}</p>
            <div className="card-actions">
              <button className="secondary-button" type="button" onClick={() => copy(publicFormUrl(form.id), 'Form link copied.')}><SafeIcon icon={FiIcons.FiLink} /> Copy link</button>
              <button className="secondary-button" type="button" onClick={() => copy(embedCode(form.id), 'Embed code copied. Paste it into your website HTML.')}><SafeIcon icon={FiIcons.FiCode} /> Embed</button>
              <a className="secondary-button" href={publicFormUrl(form.id)} target="_blank" rel="noreferrer"><SafeIcon icon={FiIcons.FiExternalLink} /> Open</a>
              <button className="secondary-button" type="button" onClick={() => setEditing(form)}><SafeIcon icon={FiIcons.FiEdit2} /></button>
              <button className="icon-button small-icon" type="button" aria-label={`Delete ${form.name}`} onClick={async () => {
                if (!window.confirm(`Delete form "${form.name}"? Its link will stop working.`)) return;
                try { await deleteForm(form.id); load(); } catch (requestError) { setError(requestError.message); }
              }}><SafeIcon icon={FiIcons.FiTrash2} /></button>
            </div>
          </article>
        ))}
        {!forms.length && !loading && !error && <div className="panel empty-cell">No forms yet. Create one and share the link or embed it on your site.</div>}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading table-heading-pad"><div><h2>Recent submissions</h2><p>New submissions are imported into Leads automatically every minute while the CRM is open.</p></div></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Received</th><th>Form</th><th>Name</th><th>Email</th><th>Company</th><th>Status</th></tr></thead>
            <tbody>
              {submissions.map(row => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{formName(row.form_id)}</td>
                  <td><b className="table-strong">{row.data.name || '—'}</b></td>
                  <td>{row.data.email}</td>
                  <td>{row.data.company || '—'}</td>
                  <td><span className={`status-chip ${row.status === 'imported' ? 'status-qualified' : 'status-new'}`}>{row.status === 'imported' ? 'Imported' : 'New'}</span></td>
                </tr>
              ))}
              {!submissions.length && <tr><td className="empty-cell" colSpan="6">No submissions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editing && <FormEditor form={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Form saved.'); load(); }} />}
    </div>
  );
}
