import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useCRM } from '../../data/CRMContext';

const saveLabels = { saved: 'All changes saved', saving: 'Saving…', error: 'Not saved' };

export default function MainLayout() {
  const { role, cloudError, profileError, saveState, inviteMessage, clearInviteMessage } = useCRM();
  const visibleError = cloudError || profileError;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-column">
        <Header />
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
    </div>
  );
}
