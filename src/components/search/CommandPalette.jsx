import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useCRM } from '../../data/CRMContext';
import { money } from '../../common/format';
import { invoiceTotals } from '../../common/crm';
import { NAV_ITEMS } from '../layout/navigation';

const ACTIONS = [
  { label: 'Add a lead', to: '/leads?new=1', icon: FiIcons.FiUserPlus, keywords: 'new create lead' },
  { label: 'Create a deal', to: '/deals?new=1', icon: FiIcons.FiDollarSign, keywords: 'new opportunity deal' },
  { label: 'Add a company', to: '/companies?new=1', icon: FiIcons.FiBriefcase, keywords: 'new account company' },
  { label: 'New quote', to: '/invoices?new=quote', icon: FiIcons.FiFileText, keywords: 'estimate proposal quote' },
  { label: 'New invoice', to: '/invoices?new=invoice', icon: FiIcons.FiFileText, keywords: 'bill invoice' },
  { label: 'Schedule an activity', to: '/calendar', icon: FiIcons.FiCalendar, keywords: 'task meeting call calendar' }
];

const GROUP_LIMIT = 6;

/** Ranks a match: 3 = starts with query, 2 = word starts with query, 1 = contains, 0 = no match. */
function rank(text, query) {
  const value = text.toLowerCase();
  if (value.startsWith(query)) return 3;
  if (value.includes(` ${query}`) || value.includes(`@${query}`)) return 2;
  return value.includes(query) ? 1 : 0;
}

export default function CommandPalette({ open, onClose }) {
  const { data, role } = useCRM();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = NAV_ITEMS.filter(item => !item.admin || role === 'Admin').map(item => ({ group: 'Pages', label: item.label, sub: 'Go to page', to: item.to, icon: item.icon, text: `${item.label} ${item.keywords || ''}` }));
    const actions = ACTIONS.map(item => ({ group: 'Quick actions', label: item.label, to: item.to, icon: item.icon, text: `${item.label} ${item.keywords}` }));

    if (!q) return [...actions, ...pages.slice(0, 6)];

    const sources = [
      ['Leads', data.leads, lead => ({ label: lead.name, sub: [lead.company, lead.email, lead.status].filter(Boolean).join(' · '), to: `/leads?open=${lead.id}`, icon: FiIcons.FiTarget, text: `${lead.name} ${lead.email} ${lead.company} ${lead.phone} ${lead.location} ${lead.source} ${(lead.tags || []).join(' ')} ${lead.notes}` })],
      ['Companies', data.companies, company => ({ label: company.name, sub: [company.industry, company.city].filter(Boolean).join(' · '), to: `/companies?open=${company.id}`, icon: FiIcons.FiBriefcase, text: `${company.name} ${company.industry} ${company.website} ${company.city}` })],
      ['Deals', data.deals, deal => ({ label: deal.name, sub: `${deal.stage} · ${money(deal.value)}${deal.company ? ` · ${deal.company}` : ''}`, to: `/deals?open=${deal.id}`, icon: FiIcons.FiDollarSign, text: `${deal.name} ${deal.company} ${deal.contact} ${deal.owner}` })],
      ['Activities', data.activities, item => ({ label: item.title, sub: `${item.type} · due ${item.due}${item.done ? ' · done' : ''}`, to: '/activities', icon: FiIcons.FiCheckSquare, text: `${item.title} ${item.lead} ${item.owner} ${item.type}` })],
      ['Campaigns', data.campaigns, item => ({ label: item.name, sub: `${item.channel} · ${item.status}`, to: '/campaigns', icon: FiIcons.FiSend, text: `${item.name} ${item.channel}` })],
      ['Quotes & invoices', data.invoices, item => ({ label: `${item.number} — ${item.client}`, sub: `${item.type} · ${item.status} · ${money(invoiceTotals(item).total)}`, to: `/invoices?open=${item.id}`, icon: FiIcons.FiFileText, text: `${item.number} ${item.client} ${item.email}` })],
      ['Email templates', data.templates, item => ({ label: item.name, sub: item.subject, to: '/templates', icon: FiIcons.FiMail, text: `${item.name} ${item.subject} ${item.category}` })]
    ];

    const found = [];
    sources.forEach(([group, list, map]) => {
      list
        .map(record => map(record))
        .map(item => ({ ...item, group, score: Math.max(rank(item.label, q) * 2, rank(item.text, q)) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, GROUP_LIMIT)
        .forEach(item => found.push(item));
    });
    const nav = [...actions, ...pages].filter(item => rank(item.text, q) > 0);
    return [...found, ...nav];
  }, [query, data, role]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = item => {
    onClose();
    navigate(item.to);
  };

  const onKeyDown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(results.length - 1, index + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    if (event.key === 'Enter' && results[active]) { event.preventDefault(); go(results[active]); }
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };

  let lastGroup = '';
  return (
    <div className="palette-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <label className="palette-input">
          <SafeIcon icon={FiIcons.FiSearch} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, companies, deals, invoices… or type a command"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-item-${active}` : undefined}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.group}-${item.to}-${item.label}-${index}`}>
                {header && <li className="palette-group" role="presentation">{header}</li>}
                <li
                  id={`palette-item-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`palette-item${index === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={event => { event.preventDefault(); go(item); }}
                >
                  <span className="palette-icon"><SafeIcon icon={item.icon} /></span>
                  <span className="palette-text"><b>{item.label}</b>{item.sub && <small>{item.sub}</small>}</span>
                  <SafeIcon icon={FiIcons.FiCornerDownLeft} />
                </li>
              </React.Fragment>
            );
          })}
          {!results.length && <li className="palette-empty">No results for “{query}”.</li>}
        </ul>
        <footer className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> toggle</span></footer>
      </div>
    </div>
  );
}
