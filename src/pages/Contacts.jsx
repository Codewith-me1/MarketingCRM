import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials } from '../common/format';
import PageTitle from '../components/ui/PageTitle';

export default function Contacts() {
  const { data, globalSearch } = useCRM();
  const contacts = data.leads.filter(lead => lead.status === 'Converted' || lead.status === 'Negotiation');
  const filtered = contacts.filter(item => `${item.name} ${item.company} ${item.email}`.toLowerCase().includes(globalSearch.toLowerCase()));
  return (
    <div className="page-content"><PageTitle eyebrow="CUSTOMER DIRECTORY" title="Contacts" description="A people-first view of your converted and late-stage relationships." actions={<span className="pipeline-total-pill"><SafeIcon icon={FiIcons.FiUsers} />{filtered.length} contacts</span>} />
      <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><h2>Customers & prospects</h2><p>Contacts are organized from your lead records.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Contact</th><th>Company</th><th>Email</th><th>Phone</th><th>Location</th><th>Relationship</th><th>Owner</th></tr></thead><tbody>{filtered.map(contact => <tr key={contact.id}><td><span className="lead-person"><span className="avatar avatar-green">{initials(contact.name)}</span><span><b>{contact.name}</b><small>Added {contact.createdAt}</small></span></span></td><td><b className="table-strong">{contact.company}</b></td><td>{contact.email}</td><td>{contact.phone || '—'}</td><td>{contact.location || '—'}</td><td><span className={`status-chip status-${contact.status.toLowerCase()}`}>{contact.status}</span></td><td>{contact.owner}</td></tr>)}</tbody></table>{!filtered.length && <div className="empty-cell"><SafeIcon icon={FiIcons.FiUsers} /> No converted or late-stage contacts yet.</div>}</div></section>
    </div>
  );
}