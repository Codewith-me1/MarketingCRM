import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { money } from '../common/format';
import PageTitle from '../components/ui/PageTitle';

export default function Campaigns() {
  const { data, update } = useCRM();
  const [name, setName] = useState('');
  const addCampaign = () => {
    if (!name.trim()) return;
    update('campaigns', list => [{ id: crypto.randomUUID(), name: name.trim(), channel: 'Email', budget: 0, leads: 0, conversions: 0, revenue: 0, status: 'Active' }, ...list]);
    setName('');
  };
  return (
    <div className="page-content"><PageTitle eyebrow="MARKETING PERFORMANCE" title="Campaigns" description="Track spend, lead generation, and revenue across your channels." actions={<div className="inline-create"><input value={name} onChange={event => setName(event.target.value)} placeholder="New campaign name" onKeyDown={event => event.key === 'Enter' && addCampaign()} /><button className="primary-button" onClick={addCampaign}><SafeIcon icon={FiIcons.FiPlus} /> Create</button></div>} />
      <div className="stats-grid campaign-stats"><article className="stat-card"><div className="stat-icon tone-blue"><SafeIcon icon={FiIcons.FiSend} /></div><div className="stat-label">Active campaigns</div><strong>{data.campaigns.filter(item => item.status === 'Active').length}</strong><div className="stat-foot"><span className="positive">Across channels</span></div></article><article className="stat-card"><div className="stat-icon tone-violet"><SafeIcon icon={FiIcons.FiUsers} /></div><div className="stat-label">Campaign leads</div><strong>{data.campaigns.reduce((sum, item) => sum + Number(item.leads || 0), 0)}</strong><div className="stat-foot"><span>All-time attributed</span></div></article><article className="stat-card"><div className="stat-icon tone-green"><SafeIcon icon={FiIcons.FiTrendingUp} /></div><div className="stat-label">Attributed revenue</div><strong>{money(data.campaigns.reduce((sum, item) => sum + Number(item.revenue || 0), 0))}</strong><div className="stat-foot"><span className="positive">From tracked campaigns</span></div></article><article className="stat-card"><div className="stat-icon tone-amber"><SafeIcon icon={FiIcons.FiDollarSign} /></div><div className="stat-label">Total spend</div><strong>{money(data.campaigns.reduce((sum, item) => sum + Number(item.budget || 0), 0))}</strong><div className="stat-foot"><span>Campaign budgets</span></div></article></div>
      <section className="panel table-panel campaign-table"><div className="panel-heading"><div><h2>All campaigns</h2><p>Performance and return on investment</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Leads</th><th>Conversions</th><th>Cost / lead</th><th>ROI</th><th>Revenue</th><th></th></tr></thead><tbody>{data.campaigns.map(campaign => {
        const cpl = campaign.leads ? campaign.budget / campaign.leads : 0;
        const roi = campaign.budget ? ((campaign.revenue - campaign.budget) / campaign.budget) * 100 : 0;
        return <tr key={campaign.id}><td><b className="table-strong">{campaign.name}</b></td><td>{campaign.channel}</td><td><span className={`status-chip ${campaign.status === 'Active' ? 'status-qualified' : 'status-contacted'}`}>{campaign.status}</span></td><td>{campaign.leads}</td><td>{campaign.conversions}</td><td>{money(cpl)}</td><td className="roi-value">+{roi.toFixed(0)}%</td><td><b>{money(campaign.revenue)}</b></td><td><button className="icon-button small-icon" aria-label="Delete campaign" onClick={() => update('campaigns', list => list.filter(item => item.id !== campaign.id))}><SafeIcon icon={FiIcons.FiTrash2} /></button></td></tr>;
      })}</tbody></table></div></section>
    </div>
  );
}