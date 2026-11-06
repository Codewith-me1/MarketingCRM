import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { Field, Modal } from '../../components/ui/Modal';
import { useSuccessAi } from './SuccessAiProvider';

/** Uploads the given CRM leads into a Success.ai campaign. */
export default function AddToCampaignModal({ leads, onClose, initialCampaignId = '' }) {
  const { campaigns, addLeadsToCampaign, connection, canManage } = useSuccessAi();
  const available = campaigns.filter(item => !item.missing);
  const [campaignId, setCampaignId] = useState(initialCampaignId || available[0]?.externalId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const withEmail = leads.filter(lead => lead.email);
  const alreadyIn = withEmail.filter(lead => lead.successai?.campaignId === campaignId).length;

  const submit = async event => {
    event.preventDefault();
    const campaign = available.find(item => item.externalId === campaignId);
    if (!campaign) return;
    setBusy(true);
    setError('');
    try {
      setResult(await addLeadsToCampaign(campaign, withEmail));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const blocked = !connection.configured ? 'Connect Success.ai on the Campaigns page first.'
    : !canManage ? 'Only Admins and Managers can add leads to outreach campaigns.'
      : !available.length ? 'No Success.ai campaigns yet. Sync or create one on the Campaigns page.' : '';

  return (
    <Modal
      eyebrow="SUCCESS.AI OUTREACH"
      title={`Add ${withEmail.length} lead${withEmail.length === 1 ? '' : 's'} to a campaign`}
      onClose={onClose}
      onSubmit={submit}
      footer={result
        ? <button className="primary-button" type="button" onClick={onClose}>Done</button>
        : <><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy || Boolean(blocked) || !withEmail.length}><SafeIcon icon={FiIcons.FiSend} /> {busy ? 'Uploading…' : 'Add to campaign'}</button></>}
    >
      <div className="editor-grid">
        {blocked ? <p className="auth-feedback auth-error field-wide">{blocked}</p> : (
          <>
            <Field label="Success.ai campaign" wide>
              <select value={campaignId} onChange={event => setCampaignId(event.target.value)} disabled={Boolean(result)}>
                {available.map(item => <option key={item.externalId} value={item.externalId}>{item.name} ({item.status})</option>)}
              </select>
            </Field>
            <p className="field-hint field-wide">
              Leads are uploaded with name, company and location (max 500 per upload, 1 API call).
              {leads.length !== withEmail.length && ` ${leads.length - withEmail.length} without an email will be skipped.`}
              {alreadyIn > 0 && ` ${alreadyIn} already linked to this campaign — Success.ai skips duplicates.`}
              {' '}They are tagged <b>in-sequence</b> and marked Queued; each sync then updates them to Contacted, Replied and so on.
            </p>
          </>
        )}
        {error && <p className="auth-feedback auth-error field-wide" role="alert">{error}</p>}
        {result && (
          <p className="auth-feedback auth-notice field-wide" role="status">
            Uploaded {result.contactsUploaded ?? 0} of {result.totalSent ?? withEmail.length}
            {result.alreadyInCampaign ? ` · ${result.alreadyInCampaign} already in campaign` : ''}
            {result.invalidEmailCount ? ` · ${result.invalidEmailCount} invalid emails` : ''}
            {result.duplicateEmailCount ? ` · ${result.duplicateEmailCount} duplicates` : ''}
            {result.remainingInPlan !== undefined ? ` · ${result.remainingInPlan} contacts left in plan` : ''}.
          </p>
        )}
      </div>
    </Modal>
  );
}
