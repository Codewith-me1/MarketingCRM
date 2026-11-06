import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { today } from '../common/format';
import PageTitle from '../components/ui/PageTitle';

export default function Activities() {
  const { data, update, displayName } = useCRM();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Follow-up');
  const [due, setDue] = useState(today());
  const [filter, setFilter] = useState('All');
  const add = () => {
    if (!title.trim()) return;
    update('activities', list => [{ id: crypto.randomUUID(), title: title.trim(), type, due, owner: displayName, lead: 'Unassigned', done: false }, ...list]);
    setTitle('');
  };
  const visible = data.activities.filter(item => filter === 'All' || (filter === 'Completed' ? item.done : !item.done));
  return (
    <div className="page-content"><PageTitle eyebrow="TASKS & FOLLOW-UPS" title="Activities" description="Keep calls, meetings, and follow-ups moving forward." />
      <section className="panel activity-create"><div className="panel-heading"><div><h2>Schedule an activity</h2><p>Create a reminder for your next customer touchpoint.</p></div><span className="activity-add-icon"><SafeIcon icon={FiIcons.FiCalendar} /></span></div><div className="activity-form"><input value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => event.key === 'Enter' && add()} placeholder="What needs to get done?" /><select value={type} onChange={event => setType(event.target.value)}>{['Follow-up', 'Call', 'Meeting', 'Email', 'Reminder'].map(item => <option key={item}>{item}</option>)}</select><input type="date" value={due} onChange={event => setDue(event.target.value)} /><button className="primary-button" onClick={add}><SafeIcon icon={FiIcons.FiPlus} /> Add task</button></div></section>
      <div className="activity-filter"><div><h2>Team activity</h2><p>{visible.filter(item => !item.done).length} tasks need attention</p></div><select className="soft-select" value={filter} onChange={event => setFilter(event.target.value)}><option>All</option><option>Upcoming</option><option>Completed</option></select></div>
      <section className="panel task-list">{visible.map(item => <article className={`task-row${item.done ? ' is-done' : ''}`} key={item.id}><button className="task-check" aria-label="Toggle complete" onClick={() => update('activities', list => list.map(task => task.id === item.id ? { ...task, done: !task.done } : task))}><SafeIcon icon={item.done ? FiIcons.FiCheckCircle : FiIcons.FiCircle} /></button><div className="task-type-icon"><SafeIcon icon={item.type === 'Call' ? FiIcons.FiPhone : item.type === 'Meeting' ? FiIcons.FiUsers : FiIcons.FiClock} /></div><div className="task-copy"><b>{item.title}</b><p>{item.type} · {item.lead} · Assigned to {item.owner}</p></div><span className={`task-date${!item.done && item.due < today() ? ' overdue' : ''}`}>{!item.done && item.due < today() ? 'Overdue · ' : ''}{item.due}</span><button className="icon-button small-icon" onClick={() => update('activities', list => list.filter(task => task.id !== item.id))}><SafeIcon icon={FiIcons.FiTrash2} /></button></article>)}{!visible.length && <div className="empty-cell">No activities in this view.</div>}</section>
    </div>
  );
}