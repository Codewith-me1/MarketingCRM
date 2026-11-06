import React, { useMemo, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { Field, Modal } from '../ui/Modal';
import { useCRM } from '../../data/CRMContext';
import { mailtoUrl, mergeTemplate, timelineEntry } from '../../common/crm';

const MAILTO_LIMIT = 1900; // most mail clients truncate longer mailto: links

/**
 * Compose an email from a template to one or many leads. Opens the user's mail app
 * (no email server needed) and logs the email on each lead's timeline.
 */
export default function EmailComposer({ recipients, onClose, initialTemplateId = '' }) {
  const { data, update, displayName } = useCRM();
  const initial = data.templates.find(item => item.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(initial ? initial.id : '');
  const [subject, setSubject] = useState(initial?.subject || '');
  const [body, setBody] = useState(initial?.body || '');
  const [notice, setNotice] = useState('');
  const withEmail = recipients.filter(lead => lead.email);
  const single = withEmail.length === 1 ? withEmail[0] : null;

  const applyTemplate = id => {
    setTemplateId(id);
    const template = data.templates.find(item => item.id === id);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  // With one recipient, merge fields are filled in; with many, they are filled per lead when copying.
  const preview = useMemo(() => ({
    subject: mergeTemplate(subject, single || {}, displayName),
    body: mergeTemplate(body, single || {}, displayName)
  }), [subject, body, single, displayName]);

  const logSent = () => {
    const ids = new Set(withEmail.map(lead => lead.id));
    update('leads', list => list.map(lead => (ids.has(lead.id)
      ? { ...lead, timeline: [timelineEntry('email', `Email: ${mergeTemplate(subject, lead, displayName)}`, displayName), ...(lead.timeline || [])] }
      : lead)));
  };

  const url = mailtoUrl(single
    ? { to: [single.email], subject: preview.subject, body: preview.body }
    : { bcc: withEmail.map(lead => lead.email), subject: preview.subject, body: preview.body });
  const tooLong = url.length > MAILTO_LIMIT;

  const copyAll = async () => {
    const text = withEmail.map(lead => `To: ${lead.email}\nSubject: ${mergeTemplate(subject, lead, displayName)}\n\n${mergeTemplate(body, lead, displayName)}`).join('\n\n-----\n\n');
    try {
      await navigator.clipboard.writeText(text);
      logSent();
      setNotice(`Copied ${withEmail.length} personalised email${withEmail.length === 1 ? '' : 's'} to the clipboard and logged them on the timeline.`);
    } catch {
      setNotice('Copy was blocked by the browser.');
    }
  };

  return (
    <Modal
      eyebrow="EMAIL"
      title={single ? `Email ${single.name}` : `Email ${withEmail.length} leads`}
      onClose={onClose}
      wide
      footer={(
        <>
          <button className="secondary-button" type="button" onClick={copyAll} disabled={!withEmail.length}><SafeIcon icon={FiIcons.FiCopy} /> Copy personalised</button>
          <a
            className={`primary-button${!withEmail.length || !subject ? ' is-disabled' : ''}`}
            href={tooLong || !withEmail.length ? undefined : url}
            onClick={event => {
              if (tooLong || !withEmail.length || !subject) { event.preventDefault(); return; }
              logSent();
              onClose();
            }}
            title={tooLong ? 'Too long for a mail link; use "Copy personalised" instead' : 'Opens your email app'}
          >
            <SafeIcon icon={FiIcons.FiSend} /> Open in email app
          </a>
        </>
      )}
    >
      <div className="editor-grid">
        <Field label="Template" wide>
          <select value={templateId} onChange={event => applyTemplate(event.target.value)}>
            <option value="">Blank email</option>
            {data.templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </Field>
        <Field label="Subject" required wide><input value={subject} onChange={event => setSubject(event.target.value)} required /></Field>
        <Field label="Message" wide><textarea rows="9" value={body} onChange={event => setBody(event.target.value)} /></Field>
        <p className="field-hint field-wide">
          {withEmail.length} recipient{withEmail.length === 1 ? '' : 's'}{recipients.length !== withEmail.length ? ` (${recipients.length - withEmail.length} without email skipped)` : ''}.
          {' '}Merge fields like {'{{first_name}}'} and {'{{company}}'} are filled in {single ? 'below' : 'per lead with "Copy personalised"; bulk mail links send one shared message by BCC'}.
          {tooLong && ' This message is too long for a mail link — use "Copy personalised".'}
        </p>
        {single && (
          <div className="email-preview field-wide">
            <b>{preview.subject || 'No subject'}</b>
            <pre>{preview.body}</pre>
          </div>
        )}
        {notice && <p className="auth-feedback auth-notice field-wide" role="status">{notice}</p>}
      </div>
    </Modal>
  );
}
