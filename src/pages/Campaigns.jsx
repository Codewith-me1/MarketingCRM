import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { money } from '../common/format';
import { uid } from '../common/crm';
import { stages } from '../data/seed';
import PageTitle from '../components/ui/PageTitle';
import { Field, Modal } from '../components/ui/Modal';
import { useSuccessAi } from '../integrations/successai/SuccessAiProvider';
import AddToCampaignModal from '../integrations/successai/AddToCampaignModal';
import { CONTACT_STATUS_LABELS, estimateCalls } from '../integrations/successai/sync';

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const ago = iso => {
  if (!iso) return 'never';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
};
const STATUS_CLASS = { Active: 'qualified', Paused: 'contacted', Draft: 'new', Completed: 'converted' };

function ConnectionCard() {
  const sai = useSuccessAi();
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { connection, meta, settings } = sai;

  const save = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await sai.saveKey(apiKey.trim());
      setApiKey('');
      sai.syncNow();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (connection.status === 'loading') return <section className="panel integration-card"><span className="auth-spinner" aria-label="Checking connection"></span></section>;

  return (
    <section className="panel integration-card">
      <div className="panel-heading">
        <div>
          <h2><span className="integration-logo">S</span> Success.ai outreach</h2>
          <p>
            {connection.configured
              ? <>Connected{connection.accountName ? ` to ${connection.accountName}` : ''} · key {connection.keyHint} · last sync {ago(meta.lastSyncedAt)}</>
              : 'Sync cold-email campaigns, push CRM leads into sequences and update lead stages from replies.'}
          </p>
        </div>
        {connection.configured && (
          <div className="heading-actions">
            <button className="primary-button" type="button" onClick={() => sai.syncNow()} disabled={sai.syncing || sai.rateLimited}>
              <SafeIcon icon={FiIcons.FiRefreshCw} className={sai.syncing ? 'spin' : ''} /> {sai.syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        )}
      </div>

      {connection.status === 'error' && <p className="auth-feedback auth-error" role="alert">{connection.error}</p>}
      {sai.rateLimited && <p className="auth-feedback auth-error" role="alert">Success.ai rate limit reached — syncing resumes after {new Date(meta.rateLimitedUntil).toLocaleString()}.</p>}
      {meta.lastError && !sai.rateLimited && <p className="field-hint">Last sync note: {meta.lastError}</p>}

      {!connection.configured && connection.status !== 'error' && (sai.isAdmin ? (
        <form className="integration-connect" onSubmit={save}>
          <input type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Paste your Success.ai V2 API key" aria-label="Success.ai API key" required />
          <button className="primary-button" type="submit" disabled={busy}><SafeIcon icon={FiIcons.FiLink} /> {busy ? 'Verifying…' : 'Connect'}</button>
          <p className="field-hint">Find it in Success.ai → Settings → Integrations → API (Growth plan or above). The key is verified, stored server-side for this workspace only and never sent to browsers.</p>
          {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
        </form>
      ) : <p className="field-hint">Ask a workspace Admin to connect Success.ai.</p>)}

      {connection.configured && sai.isAdmin && (
        <details className="integration-settings">
          <summary>Sync settings & API budget</summary>
          <div className="editor-grid">
            <Field label="Automatic sync">
              <select value={settings.autoSyncHours} onChange={event => sai.updateSettings({ autoSyncHours: Number(event.target.value) })}>
                <option value={0}>Off (manual only)</option><option value={1}>Every hour</option><option value={4}>Every 4 hours</option><option value={12}>Every 12 hours</option><option value={24}>Daily</option>
              </select>
            </Field>
            <Field label="Campaigns refreshed per sync">
              <input type="number" min="0" max="15" value={settings.campaignDetails} onChange={event => sai.updateSettings({ campaignDetails: Math.max(0, Math.min(15, Number(event.target.value) || 0)) })} />
            </Field>
            <Field label="Leads checked per sync">
              <input type="number" min="0" max="10" value={settings.leadChecks} onChange={event => sai.updateSettings({ leadChecks: Math.max(0, Math.min(10, Number(event.target.value) || 0)) })} />
            </Field>
            <div className="field-wide integration-toggles">
              <label className="check-label"><input type="checkbox" checked={settings.advanceStages} onChange={event => sai.updateSettings({ advanceStages: event.target.checked })} /> Move lead stages from outreach (contacted → Contacted, replied → Interested)</label>
              <label className="check-label"><input type="checkbox" checked={settings.pushClosedStatus} onChange={event => sai.updateSettings({ pushClosedStatus: event.target.checked })} /> When a lead is Converted/Lost in the CRM, set it to Closed/Not Interested in Success.ai</label>
            </div>
            <p className="field-hint field-wide">
              Each sync uses up to ≈{estimateCalls(settings)} API calls. Success.ai's default quota is 20/min, 50/hour and 100/day per workspace;
              raise these numbers if your plan allows more. Results are shared with your whole team, so teammates don't use extra quota.
            </p>
            <div className="field-wide"><button className="danger-button" type="button" onClick={() => window.confirm('Disconnect Success.ai? Synced data stays in the CRM.') && sai.removeKey()}><SafeIcon icon={FiIcons.FiSlash} /> Disconnect</button></div>
          </div>
        </details>
      )}
    </section>
  );
}

function OutreachCampaigns({ onAddLeads }) {
  const sai = useSuccessAi();
  const { data } = useCRM();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(null);

  if (!sai.connection.configured) return null;

  const toggle = async campaign => {
    setBusyId(campaign.externalId);
    setError('');
    try { await sai.setCampaignRunning(campaign, campaign.status !== 'Active'); } catch (requestError) { setError(requestError.message); } finally { setBusyId(''); }
  };

  const create = async event => {
    event.preventDefault();
    setBusyId('new');
    setError('');
    try {
      await sai.createCampaign(creating.name.trim(), creating.timezone);
      setCreating(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const linkedLeads = id => data.leads.filter(lead => lead.successai?.campaignId === id);

  return (
    <section className="page-content">
      <div className="activity-filter">
        <div><h2>Outreach campaigns</h2><p>{sai.campaigns.filter(item => item.status === 'Active').length} running in Success.ai · stats refresh on each sync</p></div>
        {sai.canManage && <button className="secondary-button" type="button" onClick={() => setCreating({ name: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })}><SafeIcon icon={FiIcons.FiPlus} /> New Success.ai campaign</button>}
      </div>
      {error && <p className="role-note role-error" role="alert">{error}</p>}
      <div className="card-grid">
        {sai.campaigns.map(campaign => {
          const s = campaign.stats || {};
          const linked = linkedLeads(campaign.externalId);
          const replies = linked.filter(lead => lead.successai.status === 'replied');
          return (
            <article className={`panel outreach-card${campaign.missing ? ' is-paused' : ''}`} key={campaign.id}>
              <div className="panel-heading">
                <div>
                  <span className={`status-chip status-${campaign.missing ? 'lost' : STATUS_CLASS[campaign.status] || 'new'}`}>{campaign.missing ? 'Removed in Success.ai' : campaign.status}</span>
                  <h2>{campaign.name}</h2>
                  <p>{campaign.syncedAt ? `Stats from ${ago(campaign.syncedAt)}` : 'Stats not loaded yet — included in a coming sync'}</p>
                </div>
              </div>
              <div className="outreach-progress" title={`${s.contacted || 0} of ${s.totalLeads || 0} contacted`}>
                <i style={{ width: `${pct(s.contacted, s.totalLeads)}%` }}></i>
              </div>
              <dl className="outreach-stats">
                <div><dt>Leads</dt><dd>{s.totalLeads ?? '—'}</dd></div>
                <div><dt>Contacted</dt><dd>{s.contacted ?? '—'}</dd></div>
                <div><dt>Opened</dt><dd>{s.read ?? '—'}<small>{s.contacted ? ` ${pct(s.read, s.contacted)}%` : ''}</small></dd></div>
                <div><dt>Replied</dt><dd>{s.replied ?? '—'}<small>{s.contacted ? ` ${pct(s.replied, s.contacted)}%` : ''}</small></dd></div>
                <div><dt>Bounced</dt><dd>{s.bounced ?? '—'}</dd></div>
                <div><dt>In CRM</dt><dd>{linked.length}</dd></div>
              </dl>
              {replies.length > 0 && (
                <div className="mini-list">
                  {replies.slice(0, 3).map(lead => <button type="button" className="mini-row" key={lead.id} onClick={() => navigate(`/leads?open=${lead.id}`)}><b>{lead.name}</b><span>{CONTACT_STATUS_LABELS.replied}</span><span className={`status-chip status-${lead.status.toLowerCase()}`}>{lead.status}</span></button>)}
                </div>
              )}
              <div className="card-actions">
                {sai.canManage && !campaign.missing && (
                  <>
                    <button className={campaign.status === 'Active' ? 'secondary-button' : 'primary-button'} type="button" disabled={busyId === campaign.externalId} onClick={() => toggle(campaign)}>
                      <SafeIcon icon={campaign.status === 'Active' ? FiIcons.FiPause : FiIcons.FiPlay} /> {campaign.status === 'Active' ? 'Pause' : 'Launch'}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => onAddLeads(campaign)}><SafeIcon icon={FiIcons.FiUserPlus} /> Add leads</button>
                  </>
                )}
                <a className="secondary-button" href="https://app.success.ai/" target="_blank" rel="noreferrer"><SafeIcon icon={FiIcons.FiExternalLink} /> Open</a>
              </div>
            </article>
          );
        })}
        {!sai.campaigns.length && <div className="panel empty-cell">No Success.ai campaigns synced yet. Click "Sync now".</div>}
      </div>
      {creating && (
        <Modal
          eyebrow="SUCCESS.AI"
          title="New outreach campaign"
          onClose={() => setCreating(null)}
          onSubmit={create}
          footer={<><button className="secondary-button" type="button" onClick={() => setCreating(null)}>Cancel</button><button className="primary-button" type="submit" disabled={busyId === 'new'}>{busyId === 'new' ? 'Creating…' : 'Create in Success.ai'}</button></>}
        >
          <div className="editor-grid">
            <Field label="Campaign name" required wide><input value={creating.name} onChange={event => setCreating({ ...creating, name: event.target.value })} required autoFocus /></Field>
            <Field label="Timezone" wide><input value={creating.timezone} onChange={event => setCreating({ ...creating, timezone: event.target.value })} /></Field>
            <p className="field-hint field-wide">The campaign is created as a draft. Add email steps and sending accounts in Success.ai, add leads from here, then Launch.</p>
          </div>
        </Modal>
      )}
    </section>
  );
}

function PickLeadsModal({ campaign, onClose }) {
  const { data } = useCRM();
  const [stage, setStage] = useState('New');
  const [tag, setTag] = useState('');
  const [onlyUnlinked, setOnlyUnlinked] = useState(true);
  const [confirmed, setConfirmed] = useState(null);
  const tags = useMemo(() => [...new Set(data.leads.flatMap(lead => lead.tags || []))].sort(), [data.leads]);
  const matches = data.leads.filter(lead => lead.email
    && (!stage || lead.status === stage)
    && (!tag || (lead.tags || []).includes(tag))
    && (!onlyUnlinked || !lead.successai?.campaignId));

  if (confirmed) return <AddToCampaignModal leads={confirmed} initialCampaignId={campaign.externalId} onClose={onClose} />;
  return (
    <Modal
      eyebrow={campaign.name.toUpperCase()}
      title="Choose leads to add"
      onClose={onClose}
      onSubmit={event => { event.preventDefault(); setConfirmed(matches); }}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={!matches.length}>Continue with {matches.length}</button></>}
    >
      <div className="editor-grid">
        <Field label="Stage"><select value={stage} onChange={event => setStage(event.target.value)}><option value="">Any stage</option>{stages.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Tag"><select value={tag} onChange={event => setTag(event.target.value)}><option value="">Any tag</option>{tags.map(item => <option key={item} value={item}>#{item}</option>)}</select></Field>
        <label className="check-label field-wide"><input type="checkbox" checked={onlyUnlinked} onChange={event => setOnlyUnlinked(event.target.checked)} /> Only leads not already in a Success.ai campaign</label>
        <p className="field-hint field-wide">{matches.length} lead{matches.length === 1 ? '' : 's'} match. You can also select leads on the Leads page and use "Success.ai".</p>
      </div>
    </Modal>
  );
}

export default function Campaigns() {
  const { data, update } = useCRM();
  const sai = useSuccessAi();
  const [name, setName] = useState('');
  const [picking, setPicking] = useState(null);

  const addCampaign = () => {
    if (!name.trim()) return;
    update('campaigns', list => [{ id: uid(), name: name.trim(), channel: 'Email', budget: 0, leads: 0, conversions: 0, revenue: 0, status: 'Active' }, ...list]);
    setName('');
  };
  const editNumber = (campaign, key) => {
    const value = window.prompt(`${key === 'budget' ? 'Budget' : 'Revenue'} for "${campaign.name}" ($)`, campaign[key] || 0);
    if (value === null) return;
    update('campaigns', list => list.map(item => (item.id === campaign.id ? { ...item, [key]: Number(value) || 0 } : item)));
  };

  const outreach = sai.campaigns.filter(item => !item.missing);
  const totals = outreach.reduce((sum, item) => ({ contacted: sum.contacted + (item.stats?.contacted || 0), replied: sum.replied + (item.stats?.replied || 0), read: sum.read + (item.stats?.read || 0) }), { contacted: 0, replied: 0, read: 0 });

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="MARKETING PERFORMANCE"
        title="Campaigns"
        description="Track spend, outreach, replies and revenue across your channels."
        actions={<div className="inline-create"><input value={name} onChange={event => setName(event.target.value)} placeholder="New local campaign name" onKeyDown={event => event.key === 'Enter' && addCampaign()} /><button className="primary-button" type="button" onClick={addCampaign}><SafeIcon icon={FiIcons.FiPlus} /> Create</button></div>}
      />
      {sai.notice && <div className={`preview-banner${sai.notice.type === 'error' ? ' banner-error' : ''}`} role="status"><span>{sai.notice.text}</span><button className="text-link" type="button" onClick={sai.clearNotice}>Dismiss</button></div>}
      <div className="stats-grid campaign-stats">
        <article className="stat-card"><div className="stat-icon tone-blue"><SafeIcon icon={FiIcons.FiSend} /></div><div className="stat-label">Active campaigns</div><strong>{data.campaigns.filter(item => item.status === 'Active' && !item.missing).length}</strong><div className="stat-foot"><span className="positive">{outreach.filter(item => item.status === 'Active').length} in Success.ai</span></div></article>
        <article className="stat-card"><div className="stat-icon tone-violet"><SafeIcon icon={FiIcons.FiMail} /></div><div className="stat-label">Leads contacted</div><strong>{totals.contacted.toLocaleString()}</strong><div className="stat-foot"><span>{pct(totals.read, totals.contacted)}% opened</span></div></article>
        <article className="stat-card"><div className="stat-icon tone-green"><SafeIcon icon={FiIcons.FiMessageSquare} /></div><div className="stat-label">Replies</div><strong>{totals.replied.toLocaleString()}</strong><div className="stat-foot"><span className="positive">{pct(totals.replied, totals.contacted)}% reply rate</span></div></article>
        <article className="stat-card"><div className="stat-icon tone-amber"><SafeIcon icon={FiIcons.FiDollarSign} /></div><div className="stat-label">Attributed revenue</div><strong>{money(data.campaigns.reduce((sum, item) => sum + Number(item.revenue || 0), 0))}</strong><div className="stat-foot"><span>Spend {money(data.campaigns.reduce((sum, item) => sum + Number(item.budget || 0), 0))}</span></div></article>
      </div>
      <ConnectionCard />
      <OutreachCampaigns onAddLeads={setPicking} />
      <section className="panel table-panel campaign-table">
        <div className="panel-heading"><div><h2>All campaigns</h2><p>Performance and return on investment · click budget or revenue to edit</p></div></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Leads</th><th>Conversions</th><th>Cost / lead</th><th>ROI</th><th>Budget</th><th>Revenue</th><th></th></tr></thead>
            <tbody>{data.campaigns.map(campaign => {
              const cpl = campaign.leads ? campaign.budget / campaign.leads : 0;
              const roi = campaign.budget ? ((campaign.revenue - campaign.budget) / campaign.budget) * 100 : 0;
              return (
                <tr key={campaign.id}>
                  <td><b className="table-strong">{campaign.name}</b>{campaign.provider === 'successai' && <small className="table-sub">Synced from Success.ai</small>}</td>
                  <td>{campaign.channel}</td>
                  <td><span className={`status-chip status-${campaign.missing ? 'lost' : STATUS_CLASS[campaign.status] || 'contacted'}`}>{campaign.missing ? 'Removed' : campaign.status}</span></td>
                  <td>{campaign.leads}</td>
                  <td>{campaign.conversions}</td>
                  <td>{money(cpl)}</td>
                  <td className="roi-value">{roi >= 0 ? '+' : ''}{roi.toFixed(0)}%</td>
                  <td><button className="text-link" type="button" onClick={() => editNumber(campaign, 'budget')}>{money(campaign.budget)}</button></td>
                  <td><button className="text-link" type="button" onClick={() => editNumber(campaign, 'revenue')}><b>{money(campaign.revenue)}</b></button></td>
                  <td><button className="icon-button small-icon" type="button" aria-label={`Delete ${campaign.name}`} onClick={() => window.confirm(`Remove "${campaign.name}" from the CRM?${campaign.provider === 'successai' ? ' It stays in Success.ai and returns on the next sync.' : ''}`) && update('campaigns', list => list.filter(item => item.id !== campaign.id))}><SafeIcon icon={FiIcons.FiTrash2} /></button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>
      {picking && <PickLeadsModal campaign={picking} onClose={() => setPicking(null)} />}
    </div>
  );
}
