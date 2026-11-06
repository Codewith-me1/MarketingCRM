import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { resendSignupConfirmation, sendPasswordReset } from '../supabase/authService';
import './AccessScreen.css';

export default function AccessScreen() {
  const { signIn, signUp } = useCRM();
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';
  const [mode, setMode] = useState(() => inviteToken ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'reset') {
        await sendPasswordReset(email);
        setNotice('If an account exists for this email, a password reset link is on its way. Check your inbox and spam folder.');
      } else if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const result = await signUp(email.trim(), password, name.trim(), inviteToken);
        if (!result.session && result.user) {
          setConfirmationEmail(email.trim());
          setNotice('Account created. Check your email to confirm the address, then sign in.');
        } else {
          setNotice('Account created. Your workspace is loading.');
        }
      }
    } catch (requestError) {
      if (mode === 'signin' && /not confirmed/i.test(requestError.message || '')) setConfirmationEmail(email.trim());
      setError(requestError.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resendSignupConfirmation(confirmationEmail);
      setNotice('A new confirmation email was requested. Check your inbox and spam folder.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to resend the confirmation email.');
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';
  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setConfirmationEmail('');
  };

  return (
    <main className="access-screen">
      <section className="access-card">
        <div className="brand-lockup"><span className="brand-mark"><SafeIcon icon={FiIcons.FiAperture} /></span><b>Northstar</b></div>
        <div className="access-icon"><SafeIcon icon={FiIcons.FiUsers} /></div>
        <p className="eyebrow">MARKETING WORKSPACE</p>
        <h1>One pipeline.<br />Every opportunity.</h1>
        <p className="access-copy">Bring leads, campaigns, and team follow-ups together in one focused workspace.</p>
        <div className="demo-notice"><SafeIcon icon={FiIcons.FiInfo} /><span>{inviteToken
          ? <><b>You have been invited</b><br />Create your account with the email address the invitation was sent to. Already have an account? Sign in and the invitation is accepted automatically.</>
          : <><b>Secure workspace</b><br />Sign in to open your CRM workspace. New accounts get their own workspace as Admin.</>}</span></div>
        <form className="auth-form" onSubmit={submit}>
          {isSignup && (
            <label className="auth-field">
              <span>Full name</span>
              <input autoComplete="name" value={name} onChange={event => setName(event.target.value)} required />
            </label>
          )}
          <label className="auth-field">
            <span>Email address</span>
            <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
          </label>
          {!isReset && <label className="auth-field">
            <span>Password</span>
            <input type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength="8" value={password} onChange={event => setPassword(event.target.value)} required />
          </label>}
          {mode === 'signin' && (
            <button className="auth-link" type="button" onClick={() => switchMode('reset')}>Forgot password?</button>
          )}
          {error && (
            <div className="auth-feedback auth-error" role="alert">
              <p>{error}</p>
              {confirmationEmail && !notice && (
                <button className="confirmation-resend" type="button" onClick={resendConfirmation} disabled={busy}>Resend confirmation email</button>
              )}
            </div>
          )}
          {notice && (
            <div className="auth-feedback auth-notice" role="status">
              <p>{notice}</p>
              {confirmationEmail && (
                <button className="confirmation-resend" type="button" onClick={resendConfirmation} disabled={busy}>
                  {busy ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}
          <button className="primary-button access-button" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : isReset ? 'Send reset link' : 'Sign in'}
            <SafeIcon icon={FiIcons.FiArrowRight} />
          </button>
        </form>
        <p className="auth-switch">
          {isSignup || isReset ? 'Already have an account?' : 'New to Northstar?'}
          <button type="button" onClick={() => switchMode(isSignup || isReset ? 'signin' : 'signup')}>
            {isSignup || isReset ? 'Sign in' : 'Create account'}
          </button>
        </p>
        <p className="access-footnote">Every new account owns its workspace as Admin. Invited teammates join the inviter's workspace with the role they were given.</p>
      </section>
      <aside className="access-art">
        <div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div>
        <div className="art-copy"><span>MARKETING, IN MOTION</span><h2>Turn every<br />conversation into<br /><em>momentum.</em></h2><p>See the full customer journey, from first click to lasting partnership.</p></div>
        <div className="art-stat"><span>Pipeline value</span><b>$248,500</b><small><i></i> 18.4% this month</small></div>
      </aside>
    </main>
  );
}