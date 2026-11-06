import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CommandPalette from '../search/CommandPalette';
import { SuccessAiProvider } from '../../integrations/successai/SuccessAiProvider';
import Sidebar from './Sidebar';
import Header from './Header';
import { useCRM } from '../../data/CRMContext';

const saveLabels = { saved: 'All changes saved', saving: 'Saving…', error: 'Not saved' };

export default function MainLayout() {
  const { role, cloudError, profileError, saveState, inviteMessage, clearInviteMessage } = useCRM();
  const visibleError = cloudError || profileError;
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Ctrl/⌘+K toggles search anywhere; "/" opens it when not typing in a field.
  useEffect(() => {
    const onKey = event => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(open => !open);
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SuccessAiProvider>
    <div className="app-shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="main-column">
        <Header onOpenSearch={() => setSearchOpen(true)} onToggleMenu={() => setMenuOpen(open => !open)} />
        <main className="page-scroll">
          <div className={`preview-banner${visibleError ? ' banner-error' : ''}`}>
            {visibleError
              ? <span><b>Supabase sync issue</b> — {visibleError}</span>
              : <span><b>Supabase connected</b> — {saveLabels[saveState] || saveLabels.saved}</span>}
            <span>Role: {role}</span>
          </div>
          {inviteMessage && (
            <div className={`preview-banner${inviteMessage.type === 'error' ? ' banner-error' : ''}`} role="status">
              <span>{inviteMessage.text}</span>
              <button className="text-link" type="button" onClick={clearInviteMessage}>Dismiss</button>
            </div>
          )}
          <div className="page-container">
            <Suspense fallback={<div className="page-loading" role="status"><span className="auth-spinner" aria-hidden="true"></span></div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
    </SuccessAiProvider>
  );
}
