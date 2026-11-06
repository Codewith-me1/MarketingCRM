import React from 'react';
import { NavLink } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useCRM } from '../../data/CRMContext';

const links = [
  { label: 'Overview', to: '/', icon: FiIcons.FiGrid },
  { label: 'Leads', to: '/leads', icon: FiIcons.FiTarget, count: true },
  { label: 'Pipeline', to: '/pipeline', icon: FiIcons.FiGitBranch },
  { label: 'Campaigns', to: '/campaigns', icon: FiIcons.FiSend },
  { label: 'Contacts', to: '/contacts', icon: FiIcons.FiUsers },
  { label: 'Activities', to: '/activities', icon: FiIcons.FiCheckSquare },
  { label: 'Analytics', to: '/analytics', icon: FiIcons.FiBarChart2 },
  { label: 'Team', to: '/team', icon: FiIcons.FiUserCheck, admin: true }
];

export default function Sidebar() {
  const { data, role } = useCRM();
  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand-lockup"><span className="brand-mark"><SafeIcon icon={FiIcons.FiAperture} /></span><span><b>Northstar</b><small>MARKETING CRM</small></span></NavLink>
      <div className="workspace-switch"><span className="workspace-avatar">N</span><span><b>Northstar Studio</b><small>Growth workspace</small></span><SafeIcon icon={FiIcons.FiChevronDown} /></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav">
        {links.filter(link => !link.admin || role === 'Admin').map(link => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <SafeIcon icon={link.icon} /><span>{link.label}</span>{link.count && <small>{data.leads.filter(item => !['Converted', 'Lost'].includes(item.status)).length}</small>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom"><div className="plan-card"><span className="plan-icon"><SafeIcon icon={FiIcons.FiZap} /></span><b>Growth plan</b><p>You're making great progress.</p><div className="plan-progress"><i></i></div><small>72% of monthly lead limit</small></div><div className="sidebar-foot"><span className="online-dot"></span> All systems operational</div></div>
    </aside>
  );
}