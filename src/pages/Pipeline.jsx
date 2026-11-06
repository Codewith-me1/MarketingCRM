import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials, money } from '../common/format';
import { stages } from '../data/seed';
import PageTitle from '../components/ui/PageTitle';

export default function Pipeline() {
  const { data, update } = useCRM();
  const moveLead = (event, stage) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('lead-id');
    update('leads', list => list.map(lead => lead.id === id ? { ...lead, status: stage } : lead));
  };
  return (
    <div className="page-content"><PageTitle eyebrow="SALES WORKFLOW" title="Lead pipeline" description="Drag opportunities between stages as conversations progress." actions={<span className="pipeline-total-pill"><SafeIcon icon={FiIcons.FiDollarSign} />{money(data.leads.filter(lead => !['Lost', 'Converted'].includes(lead.status)).reduce((sum, lead) => sum + Number(lead.budget || 0), 0))} open value</span>} />
      <div className="kanban-board">{stages.map(stage => {
        const leads = data.leads.filter(lead => lead.status === stage);
        return <section className="kanban-column" key={stage} onDragOver={event => event.preventDefault()} onDrop={event => moveLead(event, stage)}><header><div><span className={`stage-indicator stage-${stage.toLowerCase()}`}></span><b>{stage}</b><small>{leads.length}</small></div></header><div className="kanban-cards">{leads.map(lead => <article className="kanban-card" key={lead.id} draggable onDragStart={event => event.dataTransfer.setData('lead-id', lead.id)}><div className="kanban-card-top"><span className={`priority-label priority-${lead.priority.toLowerCase()}`}>{lead.priority} priority</span></div><h3>{lead.name}</h3><p>{lead.company}</p><div className="kanban-card-meta"><span><SafeIcon icon={FiIcons.FiDollarSign} />{money(lead.budget)}</span><span className="avatar avatar-mini">{initials(lead.owner)}</span></div><footer><span>{lead.source}</span><span>{lead.followUp || 'No follow-up'}</span></footer></article>)}{!leads.length && <div className="drop-hint">Drop lead here</div>}</div></section>;
      })}</div>
    </div>
  );
}