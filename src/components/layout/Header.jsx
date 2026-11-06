import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useCRM } from '../../data/CRMContext';
import { initials } from '../../common/format';

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

export default function Header({ onOpenSearch, onToggleMenu }) {
  const { theme, setTheme, role, displayName, signOut, data } = useCRM();
  const navigate = useNavigate();
  const pendingActivities = data.activities.filter(activity => !activity.done).length;

  return (
    <header className="topbar">
      <button className="icon-button menu-button" type="button" aria-label="Open menu" onClick={onToggleMenu}><SafeIcon icon={FiIcons.FiMenu} /></button>
      <button className="global-search" type="button" onClick={onOpenSearch} aria-label="Search (Ctrl+K)">
        <SafeIcon icon={FiIcons.FiSearch} />
        <span>Search leads, deals, companies…</span>
        <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><SafeIcon icon={theme === 'light' ? FiIcons.FiMoon : FiIcons.FiSun} /></button>
        <button className="icon-button notification-button" type="button" aria-label={`View ${pendingActivities} open activities`} title="Open activities" onClick={() => navigate('/activities')}><SafeIcon icon={FiIcons.FiBell} />{pendingActivities > 0 && <i></i>}</button>
        <div className="topbar-divider"></div>
        <span className="role-switch"><span>{displayName}</span><b>{role}</b></span>
        <div className="avatar avatar-purple" aria-hidden="true">{initials(displayName)}</div>
        <button className="icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={() => signOut().catch(error => console.error('Unable to sign out:', error))}><SafeIcon icon={FiIcons.FiLogOut} /></button>
      </div>
    </header>
  );
}
