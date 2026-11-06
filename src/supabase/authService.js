import supabase, { appBaseUrl } from './supabase';
import { validateTeamInvitation } from './teamService';

const PROFILES_TABLE = 'crm_profiles_20260602000300';
const confirmationRedirect = () => `${appBaseUrl()}/`;

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      throw new Error('Your email address is not confirmed yet. Open the confirmation link we emailed you, or resend it below.');
    }
    throw error;
  }
  return data;
}

export async function signUpWithPassword(email, password, fullName, inviteToken = '') {
  const normalizedEmail = email.trim().toLowerCase();

  if (inviteToken) {
    const isValidInvite = await validateTeamInvitation(inviteToken, normalizedEmail);
    if (!isValidInvite) {
      throw new Error('This invitation is invalid, expired, or was sent to a different email address.');
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: confirmationRedirect(),
      data: {
        full_name: fullName.trim(),
        ...(inviteToken ? { invite_token: inviteToken } : {})
      }
    }
  });

  if (error) throw error;

  // Supabase returns a user without identities when the email is already registered.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account with this email already exists. Sign in instead.');
  }

  return data;
}

export async function resendSignupConfirmation(email) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: confirmationRedirect() }
  });

  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: confirmationRedirect()
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function initializeProfileAndMembership() {
  const { error } = await supabase.rpc('crm_initialize_identity_20260602000500');
  if (error) throw error;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select('user_id, full_name, email, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
