import React from 'react';
import SafeIcon from '../../common/SafeIcon';

export default function StatCard({ label, value, change, icon, tone = 'blue', note }) {
  return (
    <article className="stat-card"><div className={`stat-icon tone-${tone}`}><SafeIcon icon={icon} /></div><div className="stat-label">{label}</div><strong>{value}</strong><div className="stat-foot"><span className={change?.startsWith('-') ? 'negative' : 'positive'}>{change}</span><span>{note || 'vs. last month'}</span></div></article>
  );
}