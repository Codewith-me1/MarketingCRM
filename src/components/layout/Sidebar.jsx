import React from 'react';
import { NavLink } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useCRM } from '../../data/CRMContext';
import { appConfig } from '../../supabase/supabase';
import { NAV_SECTIONS } from './navigation';

export default function Sidebar({ open, onNavigate }) {
  const { data, role, team } = useCRM();
  const counts = {
    leads: data.leads.filter(item => !['Converted', 'Lost'].includes(item.status)).length,
    tasks: data.activities.filter(item => !item.done).length
  };

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onNavigate} aria-hidden="true"></div>}
      <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="Main navigation">
        <NavLink to="/" className="brand-lockup" onClick={onNavigate}><span className="brand-mark"><SafeIcon icon={FiIcons.FiAperture} /></span><span><b>{appConfig.name.split(' ')[0]}</b><small>MARKETING CRM</small></span></NavLink>
        <div className="workspace-switch"><span className="workspace-avatar">{appConfig.name[0]}</span><span><b>{appConfig.name}</b><small>{team.length} member{team.length === 1 ? '' : 's'} · {role}</small></span></div>
        <nav className="side-nav">
          {NAV_SECTIONS.map(section => {
            const items = section.items.filter(link => !link.admin || role === 'Admin');
            if (!items.length) return null;
            return (
              <div className="nav-section" key={section.caption}>
                <div className="nav-caption">{section.caption}</div>
                {items.map(link => (
                  <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                    <SafeIcon icon={link.icon} /><span>{link.label}</span>{link.count && counts[link.count] > 0 && <small>{counts[link.count]}</small>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot"><span className="online-dot"></span> Synced with Supabase</div>
      </aside>
    </>
  );
}
