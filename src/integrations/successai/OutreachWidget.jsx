import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useCRM } from '../../data/CRMContext';
import { useSuccessAi } from './SuccessAiProvider';

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** Marketing dashboard card: live Success.ai outreach performance and the latest replies. */
export default function OutreachWidget() {
  const sai = useSuccessAi();
  const { data } = useCRM();
  const navigate = useNavigate();
  if (!sai) return null;

  if (!sai.connection.configured) {
    if (sai.connection.status === 'loading') return null;
    return (
      <section className="panel outreach-widget">
        <div className="panel-heading">
          <div><h2><span className="integration-logo">S</span> Outreach campaigns</h2><p>Connect Success.ai to see running cold-email campaigns, opens and replies here.</p></div>
          <Link className="text-link" to="/campaigns">Connect <SafeIcon icon={FiIcons.FiArrowUpRight} /></Link>
        </div>
      </section>
    );
  }

  const campaigns = sai.campaigns.filter(item => !item.missing);
  const active = campaigns.filter(item => item.status === 'Active');
  const totals = campaigns.reduce((sum, item) => {
    const s = item.stats || {};
    return { leads: sum.leads + (s.totalLeads || 0), contacted: sum.contacted + (s.contacted || 0), read: sum.read + (s.read || 0), replied: sum.replied + (s.replied || 0), bounced: sum.bounced + (s.bounced || 0) };
  }, { leads: 0, contacted: 0, read: 0, replied: 0, bounced: 0 });
  const replies = data.leads
    .filter(lead => lead.successai?.status === 'replied')
    .sort((a, b) => String(b.successai?.checkedAt || '').localeCompare(String(a.successai?.checkedAt || '')))
    .slice(0, 4);

  return (
    <section className="panel outreach-widget">
      <div className="panel-heading">
        <div>
          <h2><span className="integration-logo">S</span> Outreach campaigns</h2>
          <p>{active.length} running in Success.ai · last sync {sai.meta.lastSyncedAt ? new Date(sai.meta.lastSyncedAt).toLocaleString() : 'never'}</p>
        </div>
        <span className="heading-actions">
          <button className="secondary-button" type="button" onClick={() => sai.syncNow()} disabled={sai.syncing || sai.rateLimited}><SafeIcon icon={FiIcons.FiRefreshCw} className={sai.syncing ? 'spin' : ''} /> {sai.syncing ? 'Syncing…' : 'Sync'}</button>
          <Link className="text-link" to="/campaigns">Manage <SafeIcon icon={FiIcons.FiArrowUpRight} /></Link>
        </span>
      </div>
      <div className="outreach-widget-grid">
        <dl className="outreach-stats">
          <div><dt>Leads in sequences</dt><dd>{totals.leads.toLocaleString()}</dd></div>
          <div><dt>Contacted</dt><dd>{totals.contacted.toLocaleString()}<small> {pct(totals.contacted, totals.leads)}%</small></dd></div>
          <div><dt>Open rate</dt><dd>{pct(totals.read, totals.contacted)}%</dd></div>
          <div><dt>Reply rate</dt><dd>{pct(totals.replied, totals.contacted)}%<small> {totals.replied}</small></dd></div>
          <div><dt>Bounced</dt><dd>{totals.bounced}</dd></div>
          <div><dt>CRM leads linked</dt><dd>{data.leads.filter(lead => lead.successai?.campaignId).length}</dd></div>
        </dl>
        <div>
          <div className="outreach-campaign-bars">
            {active.slice(0, 4).map(item => (
              <div className="stage-row outreach-bar" key={item.id} title={`${item.stats?.contacted || 0} of ${item.stats?.totalLeads || 0} contacted`}>
                <span>{item.name}</span><div><i style={{ width: `${Math.max(4, pct(item.stats?.contacted, item.stats?.totalLeads))}%` }}></i></div><b>{pct(item.stats?.replied, item.stats?.contacted)}%</b>
              </div>
            ))}
            {!active.length && <p className="field-hint">No campaigns are running right now.</p>}
          </div>
          {replies.length > 0 && (
            <div className="mini-list">
              <h3 className="drawer-section">Latest replies</h3>
              {replies.map(lead => <button type="button" className="mini-row" key={lead.id} onClick={() => navigate(`/leads?open=${lead.id}`)}><b>{lead.name}</b><span>{lead.successai.campaignName}</span><span className={`status-chip status-${lead.status.toLowerCase()}`}>{lead.status}</span></button>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
