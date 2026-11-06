import React, { useEffect, useState } from 'react';
import { fetchPublicForm, submitPublicForm } from '../supabase/formService';
import '../components/AccessScreen.css';

/** Public, unauthenticated lead capture form served at /#/form/<id>. */
export default function PublicForm({ formId }) {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing | sent
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPublicForm(formId)
      .then(result => { setForm(result); setStatus(result ? 'ready' : 'missing'); })
      .catch(() => setStatus('missing'));
  }, [formId]);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submitPublicForm(formId, values);
      setStatus('sent');
    } catch (requestError) {
      setError(requestError.message || 'Your response could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-loading public-form-page">
      <div className="auth-loading-card auth-form public-form-card">
        {status === 'loading' && <span className="auth-spinner" aria-label="Loading form"></span>}
        {status === 'missing' && <><b>Form unavailable</b><p>This form does not exist or is no longer accepting responses.</p></>}
        {status === 'sent' && <><b>Thank you!</b><p>{form?.success_message}</p></>}
        {status === 'ready' && (
          <form onSubmit={submit} className="auth-form">
            <b>{form.title}</b>
            {form.description && <p>{form.description}</p>}
            {form.fields.map(field => (
              <label className="auth-field" key={field.key}>
                <span>{field.label}{field.required ? ' *' : ''}</span>
                {field.key === 'message'
                  ? <textarea rows="4" required={field.required} value={values[field.key] || ''} onChange={event => setValues({ ...values, [field.key]: event.target.value })} />
                  : <input
                      type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'}
                      autoComplete={{ name: 'name', email: 'email', phone: 'tel', company: 'organization' }[field.key] || 'off'}
                      required={field.required}
                      maxLength="300"
                      value={values[field.key] || ''}
                      onChange={event => setValues({ ...values, [field.key]: event.target.value })}
                    />}
              </label>
            ))}
            {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
            <button className="primary-button access-button" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit'}</button>
          </form>
        )}
      </div>
    </main>
  );
}
