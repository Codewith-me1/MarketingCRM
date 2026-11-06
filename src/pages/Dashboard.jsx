import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { Link } from 'react-router-dom';
import { useCRM } from '../data/CRMContext';
import { money } from '../common/format';
import PageTitle from '../components/ui/PageTitle';
import StatCard from '../components/ui/StatCard';

export default function Dashboard() {
  const { data, displayName } = useCRM();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName.split(/\s+/)[0];
  const leads = data.leads;
  const converted = leads.filter(lead => lead.status === 'Converted');
  const open = leads.filter(lead => !['Converted', 'Lost'].includes(lead.status));
  const revenue = data.campaigns.reduce((sum, campaign) => sum + Number(campaign.revenue || 0), 0);
  const sources = [...new Set(leads.map(lead => lead.source))].slice(0, 5);
  const activities = data.activities.slice(0, 4);

  return (
    <div className="page-content">
      <PageTitle eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} title={`${greeting}, ${firstName}`} description="Here's what's happening across your marketing pipeline." actions={<Link className="primary-button" to="/leads?new=1"><SafeIcon icon={FiIcons.FiPlus} /> Add a lead</Link>} />
      <section className="stats-grid">
        <StatCard label="Total leads" value={leads.length.toLocaleString()} change="+12.8%" icon={FiIcons.FiUsers} tone="blue" />
        <StatCard label="New this month" value={leads.filter(lead => lead.status === 'New').length + 38} change="+8.2%" icon={FiIcons.FiUserPlus} tone="violet" />
        <StatCard label="Conversions" value={converted.length + 24} change="+4.6%" icon={FiIcons.FiTrendingUp} tone="green" />
        <StatCard label="Campaign revenue" value={money(revenue)} change="+18.4%" icon={FiIcons.FiDollarSign} tone="amber" />
      </section>
      <section className="dashboard-grid">
        <article className="panel performance-panel"><div className="panel-heading"><div><h2>Lead performance</h2><p>Lead generation across the last 8 weeks</p></div><select className="soft-select" defaultValue="8 weeks"><option>8 weeks</option><option>30 days</option><option>90 days</option></select></div>
          <div className="chart-area"><div className="chart-y-labels"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div><div className="bar-chart">{[42, 56, 49, 74, 63, 82, 68, 94].map((height, index) => <div className="bar-group" key={index}><div className="bar bar-muted" style={{ height: `${height * .7}%` }}></div><div className="bar bar-primary" style={{ height: `${height}%` }}></div><small>{['Apr 21', 'Apr 28', 'May 5', 'May 12', 'May 19', 'May 26', 'Jun 2', 'Jun 9'][index]}</small></div>)}</div></div>
          <div className="chart-legend"><span><i className="legend-blue"></i>Leads generated</span><span><i className="legend-light"></i>Conversions</span><b>Conversion rate <em>{((converted.length / Math.max(leads.length, 1)) * 100).toFixed(1)}%</em></b></div>
        </article>
        <article className="panel source-panel"><div className="panel-heading"><div><h2>Top lead sources</h2><p>Where your audience finds you</p></div><Link className="text-link" to="/analytics">View report <SafeIcon icon={FiIcons.FiArrowUpRight} /></Link></div>
          <div className="source-list">{sources.map((source, index) => {
            const count = leads.filter(lead => lead.source === source).length;
            return <div className="source-row" key={source}><span className={`source-mark source-${index}`}>{source.slice(0, 1)}</span><span>{source}</span><b>{count * 14 + 12}</b><div className="source-track"><i style={{ width: `${Math.max(22, 100 - index * 16)}%` }}></i></div></div>;
          })}</div>
        </article>
      </section>
      <section className="dashboard-grid lower-grid">
        <article className="panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your team</p></div><Link className="text-link" to="/activities">View all <SafeIcon icon={FiIcons.FiArrowUpRight} /></Link></div>
          <div className="activity-list">{activities.map((item, index) => <div className="activity-item" key={item.id}><div className={`activity-dot dot-${index}`}><SafeIcon icon={item.type === 'Call' ? FiIcons.FiPhone : item.type === 'Meeting' ? FiIcons.FiCalendar : FiIcons.FiMail} /></div><div><b>{item.title}</b><p>{item.owner} · {item.type} · Due {item.due}</p></div><span className={item.done ? 'task-done' : 'task-open'}>{item.done ? 'Done' : 'Upcoming'}</span></div>)}</div>
        </article>
        <article className="panel pipeline-summary"><div className="panel-heading"><div><h2>Pipeline snapshot</h2><p>Lead distribution by stage</p></div><Link className="text-link" to="/pipeline">Open pipeline <SafeIcon icon={FiIcons.FiArrowUpRight} /></Link></div><div className="pipeline-total"><b>{open.length}</b><span>active opportunities</span></div><div className="stage-bars">{['New', 'Contacted', 'Interested', 'Qualified', 'Proposal'].map((stage, index) => <div className="stage-row" key={stage}><span>{stage}</span><div><i style={{ width: `${Math.max(15, leads.filter(lead => lead.status === stage).length * 20)}%` }}></i></div><b>{leads.filter(lead => lead.status === stage).length}</b><small>{['blue', 'purple', 'amber', 'green', 'pink'][index]}</small></div>)}</div></article>
      </section>
    </div>
  );
}