import React, { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CRMProvider, useCRM } from './data/CRMContext';
import MainLayout from './components/layout/MainLayout';
import AccessScreen from './components/AccessScreen';
import { updatePassword } from './supabase/authService';
import './App.css';
import './features.css';

// Route-level code splitting keeps the first load small.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Activities = lazy(() => import('./pages/Activities'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Team = lazy(() => import('./pages/Team'));
const Companies = lazy(() => import('./pages/Companies'));
const Deals = lazy(() => import('./pages/Deals'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Templates = lazy(() => import('./pages/Templates'));
const Forms = lazy(() => import('./pages/Forms'));
const Automations = lazy(() => import('./pages/Automations'));
const Products = lazy(() => import('./pages/Products'));
const Invoices = lazy(() => import('./pages/Invoices'));
const PublicForm = lazy(() => import('./pages/PublicForm'));

const publicFormId = () => window.location.hash.match(/^#\/form\/([0-9a-f-]{36})/i)?.[1] || '';

function AdminOnly({ children }) {
  const { role } = useCRM();
  return role === 'Admin' ? children : <Navigate to="/" replace />;
}

function StatusScreen({ title, message, action, spinner = !action }) {
  return (
    <main className="auth-loading" role="status">
      <div className="auth-loading-card">
        {spinner && <span className="auth-spinner" aria-hidden="true"></span>}
        <b>{title}</b>
        {message && <p>{message}</p>}
        {action}
      </div>
    </main>
  );
}

function PasswordRecovery() {
  const { setRecoveryMode } = useCRM();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updatePassword(password);
      setRecoveryMode(false);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-loading">
      <form className="auth-loading-card auth-form" onSubmit={submit}>
        <b>Choose a new password</b>
        <label className="auth-field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" minLength="8" value={password} onChange={event => setPassword(event.target.value)} required />
        </label>
        {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
        <button className="primary-button access-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </main>
  );
}

function Workspace() {
  const { user, authReady, workspaceStatus, loadError, slowLoad, retryLoad, configError, recoveryMode, signOut } = useCRM();

  const [formId, setFormId] = useState(publicFormId);
  useEffect(() => {
    const onHash = () => setFormId(publicFormId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (formId) {
    return <Suspense fallback={<StatusScreen title="Loading form…" />}><PublicForm formId={formId} /></Suspense>;
  }

  if (configError) return <StatusScreen title="Supabase is not configured" message={configError} spinner={false} />;
  if (!authReady) return <StatusScreen title="Restoring your secure session…" />;
  if (!user) return <AccessScreen />;
  if (recoveryMode) return <PasswordRecovery />;

  if (workspaceStatus === 'error') {
    return (
      <StatusScreen
        title="Your workspace could not be loaded"
        message={loadError}
        action={(
          <div className="auth-loading-actions">
            <button className="primary-button" type="button" onClick={retryLoad}>Try again</button>
            <button className="secondary-button" type="button" onClick={() => signOut().catch(() => undefined)}>Sign out</button>
          </div>
        )}
      />
    );
  }

  if (workspaceStatus !== 'ready') {
    return (
      <StatusScreen
        title="Loading your workspace…"
        message={slowLoad ? 'Supabase is taking longer than usual. If your project was paused, it can take up to a minute to wake up.' : ''}
        action={slowLoad ? <button className="secondary-button" type="button" onClick={retryLoad}>Retry</button> : null}
      />
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="activities" element={<Activities />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="companies" element={<Companies />} />
          <Route path="deals" element={<Deals />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="templates" element={<Templates />} />
          <Route path="forms" element={<Forms />} />
          <Route path="automations" element={<Automations />} />
          <Route path="products" element={<Products />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="team" element={<AdminOnly><Team /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  return (
    <CRMProvider>
      <Workspace />
    </CRMProvider>
  );
}
