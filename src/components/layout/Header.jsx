import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useCRM } from '../../data/CRMContext';

export default function Header() {
  const { globalSearch, setGlobalSearch, theme, setTheme, role, displayName, signOut, data } = useCRM();
  const navigate = useNavigate();
  const pendingActivities = data.activities.filter(activity => !activity.done).length;

  return (
    <header className="topbar">
      <label className="global-search"><SafeIcon icon={FiIcons.FiSearch} /><input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><SafeIcon icon={theme === 'light' ? FiIcons.FiMoon : FiIcons.FiSun} /></button>
        <button className="icon-button notification-button" aria-label={`View ${pendingActivities} open activities`} title="Open activities" onClick={() => navigate('/activities')}><SafeIcon icon={FiIcons.FiBell} />{pendingActivities > 0 && <i></i>}</button>
        <div className="topbar-divider"></div>
        <label className="role-switch"><span>{displayName}</span><b>{role}</b></label>
        <div className="avatar avatar-purple">{displayName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div>
        <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => signOut().catch(error => console.error('Unable to sign out:', error))}><SafeIcon icon={FiIcons.FiLogOut} /></button>
      </div>
    </header>
  );
}