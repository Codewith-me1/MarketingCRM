import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { money } from '../common/format';
import PageTitle from '../components/ui/PageTitle';
import StatCard from '../components/ui/StatCard';

export default function Analytics() {
  const { data } = useCRM();
  const total = data.leads.length || 1;
  const converted = data.leads.filter(item => item.status === 'Converted').length;
  const sources = [...new Set(data.leads.map(item => item.source))].map(source => ({ name: source, count: data.leads.filter(item => item.source === source).length })).sort((a, b) => b.count - a.count);
  const team = data.team.map(person => ({ ...person, assigned: data.leads.filter(lead => lead.owner === person.name).length }));
  return (
    <div className="page-content"><PageTitle eyebrow="INSIGHTS & ATTRIBUTION" title="Analytics" description="Understand what's converting and where to invest next." actions={<button className="secondary-button" onClick={() => window.print()}><SafeIcon icon={FiIcons.FiDownload} /> Export report</button>} />
      <section className="stats-grid"><StatCard label="Lead conversion" value={`${((converted / total) * 100).toFixed(1)}%`} change="+2.4%" icon={FiIcons.FiTrendingUp} tone="green" /><StatCard label="Campaign ROI" value={`${Math.round((data.campaigns.reduce((sum, item) => sum + item.revenue - item.budget, 0) / Math.max(1, data.campaigns.reduce((sum, item) => sum + item.budget, 0))) * 100)}%`} change="+11.2%" icon={FiIcons.FiBarChart2} tone="violet" /><StatCard label="Avg. lead budget" value={money(data.leads.reduce((sum, item) => sum + Number(item.budget || 0), 0) / total)} change="+6.1%" icon={FiIcons.FiDollarSign} tone="blue" /><StatCard label="Open opportunities" value={data.leads.filter(item => !['Converted', 'Lost'].includes(item.status)).length} change="+8.3%" icon={FiIcons.FiTarget} tone="amber" /></section>
      <section className="dashboard-grid analytics-grid"><article className="panel"><div className="panel-heading"><div><h2>Source performance</h2><p>Lead volume by acquisition channel</p></div></div><div className="analytics-bars">{sources.map((source, index) => <div className="analytics-bar-row" key={source.name}><span>{source.name}</span><div className="analytics-track"><i style={{ width: `${Math.max(8, source.count / total * 100)}%` }}></i></div><b>{source.count}</b><small>{((source.count / total) * 100).toFixed(0)}%</small><i className={`source-key source-${index % 5}`}></i></div>)}</div></article>
        <article className="panel"><div className="panel-heading"><div><h2>Team performance</h2><p>Active lead assignments</p></div></div><div className="team-performance">{team.map(member => <div className="team-performance-row" key={member.id}><span className="avatar avatar-blue">{member.initials}</span><span><b>{member.name}</b><small>{member.role}</small></span><div className="team-meter"><i style={{ width: `${Math.min(100, member.assigned * 8)}%` }}></i></div><strong>{member.assigned}</strong></div>)}</div></article></section>
    </div>
  );
}