import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { today } from '../common/format';
import { uid } from '../common/crm';
import PageTitle from '../components/ui/PageTitle';
import { Field, Modal } from '../components/ui/Modal';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function Calendar() {
  const { data, update, displayName } = useCRM();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [filters, setFilters] = useState({ task: true, followUp: true, deal: true, invoice: true });
  const [adding, setAdding] = useState(null);

  const events = useMemo(() => {
    const list = [];
    if (filters.task) data.activities.forEach(item => item.due && list.push({ id: `a-${item.id}`, date: item.due, kind: 'task', label: item.title, done: item.done, to: '/activities' }));
    if (filters.followUp) data.leads.forEach(lead => lead.followUp && list.push({ id: `l-${lead.id}`, date: lead.followUp, kind: 'followUp', label: `Follow up: ${lead.name}`, to: `/leads?open=${lead.id}` }));
    if (filters.deal) data.deals.forEach(deal => deal.closeDate && !['Won', 'Lost'].includes(deal.stage) && list.push({ id: `d-${deal.id}`, date: deal.closeDate, kind: 'deal', label: `Close: ${deal.name}`, to: `/deals?open=${deal.id}` }));
    if (filters.invoice) data.invoices.forEach(invoice => invoice.dueDate && invoice.type === 'Invoice' && invoice.status !== 'Paid' && list.push({ id: `i-${invoice.id}`, date: invoice.dueDate, kind: 'invoice', label: `Due: ${invoice.number}`, to: `/invoices?open=${invoice.id}` }));
    return list.reduce((map, event) => ({ ...map, [event.date]: [...(map[event.date] || []), event] }), {});
  }, [data.activities, data.leads, data.deals, data.invoices, filters]);

  const days = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [cursor]);

  const shift = months => setCursor(current => new Date(current.getFullYear(), current.getMonth() + months, 1));
  const todayIso = today();

  const saveTask = event => {
    event.preventDefault();
    if (!adding.title.trim()) return;
    update('activities', list => [{ id: uid(), title: adding.title.trim(), type: adding.type, due: adding.date, owner: displayName, lead: adding.lead || 'Unassigned', done: false }, ...list]);
    setAdding(null);
  };

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="SCHEDULE"
        title="Calendar"
        description="Tasks, follow-ups, expected closes and invoice due dates in one view."
        actions={(
          <>
            <button className="secondary-button" type="button" onClick={() => shift(-1)} aria-label="Previous month"><SafeIcon icon={FiIcons.FiChevronLeft} /></button>
            <button className="secondary-button" type="button" onClick={() => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); }}>Today</button>
            <button className="secondary-button" type="button" onClick={() => shift(1)} aria-label="Next month"><SafeIcon icon={FiIcons.FiChevronRight} /></button>
            <button className="primary-button" type="button" onClick={() => setAdding({ date: todayIso, title: '', type: 'Meeting', lead: '' })}><SafeIcon icon={FiIcons.FiPlus} /> Schedule</button>
          </>
        )}
      />
      <div className="calendar-toolbar">
        <h2>{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <div className="calendar-legend">
          {[['task', 'Tasks'], ['followUp', 'Follow-ups'], ['deal', 'Deal closes'], ['invoice', 'Invoices due']].map(([key, label]) => (
            <label key={key} className={`legend-toggle event-${key}`}><input type="checkbox" checked={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.checked }))} /><i></i>{label}</label>
          ))}
        </div>
      </div>
      <section className="panel calendar-grid" aria-label="Month calendar">
        {WEEKDAYS.map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
        {days.map(day => {
          const key = iso(day);
          const items = events[key] || [];
          return (
            <div key={key} className={`calendar-day${day.getMonth() !== cursor.getMonth() ? ' is-outside' : ''}${key === todayIso ? ' is-today' : ''}`} onDoubleClick={() => setAdding({ date: key, title: '', type: 'Meeting', lead: '' })}>
              <button type="button" className="calendar-date" onClick={() => setAdding({ date: key, title: '', type: 'Meeting', lead: '' })} aria-label={`Schedule on ${key}`}>{day.getDate()}</button>
              {items.slice(0, 3).map(item => (
                <button type="button" key={item.id} className={`calendar-event event-${item.kind}${item.done ? ' is-done' : ''}`} onClick={() => navigate(item.to)} title={item.label}>{item.label}</button>
              ))}
              {items.length > 3 && <small className="calendar-more">+{items.length - 3} more</small>}
            </div>
          );
        })}
      </section>
      {adding && (
        <Modal
          eyebrow="NEW ACTIVITY"
          title={`Schedule on ${adding.date}`}
          onClose={() => setAdding(null)}
          onSubmit={saveTask}
          footer={<><button className="secondary-button" type="button" onClick={() => setAdding(null)}>Cancel</button><button className="primary-button" type="submit">Save</button></>}
        >
          <div className="editor-grid">
            <Field label="Title" required wide><input value={adding.title} onChange={event => setAdding({ ...adding, title: event.target.value })} required autoFocus /></Field>
            <Field label="Type"><select value={adding.type} onChange={event => setAdding({ ...adding, type: event.target.value })}>{['Meeting', 'Call', 'Follow-up', 'Email', 'Reminder'].map(item => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Date"><input type="date" value={adding.date} onChange={event => setAdding({ ...adding, date: event.target.value })} /></Field>
            <Field label="Related lead" wide><input list="calendar-leads" value={adding.lead} onChange={event => setAdding({ ...adding, lead: event.target.value })} placeholder="Optional" /><datalist id="calendar-leads">{data.leads.map(lead => <option key={lead.id} value={lead.name} />)}</datalist></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
