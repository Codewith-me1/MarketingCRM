import supabase, { appBaseUrl } from './supabase';
import { initials } from '../common/format';

const MEMBERS_TABLE = 'crm_team_members_20260602000400';
const INVITATIONS_TABLE = 'crm_invitations_20260602000400';
const INVITE_FIELDS = 'id, email, invited_name, role, token, created_at, expires_at';

const isMissingFunction = error => error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '');
const migrationHint = 'Apply src/supabase/migrations/20260602000600_fix_team_admin_and_invites.sql in the Supabase SQL editor.';

/** The caller's membership: which workspace they belong to and their role in it. */
export async function fetchMembership(userId) {
  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .select('workspace_owner_id, role')
    .eq('member_user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return {
    workspaceOwnerId: data?.workspace_owner_id || userId,
    role: data?.role || null
  };
}

export async function fetchTeamMembers(workspaceOwnerId) {
  const { data, error } = await supabase.rpc('crm_list_team_20260602000400', {
    p_workspace_owner_id: workspaceOwnerId
  });

  if (error) throw error;
  return (data || []).map(member => {
    const name = member.full_name || member.email?.split('@')[0] || 'Team member';
    return {
      id: member.user_id,
      user_id: member.user_id,
      name,
      email: member.email,
      role: member.role,
      status: 'Active',
      isOwner: member.user_id === workspaceOwnerId,
      createdAt: member.created_at,
      initials: initials(name)
    };
  });
}

export async function fetchPendingInvitations(workspaceOwnerId) {
  const { data, error } = await supabase
    .from(INVITATIONS_TABLE)
    .select(INVITE_FIELDS)
    .eq('workspace_owner_id', workspaceOwnerId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTeamInvitation(workspaceOwnerId, email, invitedName, role = 'Employee') {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: existing, error: lookupError } = await supabase
    .from(INVITATIONS_TABLE)
    .select(INVITE_FIELDS)
    .eq('workspace_owner_id', workspaceOwnerId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    // An expired invite still blocks the unique index, so retire it and issue a new one.
    if (new Date(existing.expires_at) > new Date()) return existing;
    await cancelTeamInvitation(existing.id, workspaceOwnerId);
  }

  const { data, error } = await supabase
    .from(INVITATIONS_TABLE)
    .insert({
      workspace_owner_id: workspaceOwnerId,
      email: normalizedEmail,
      invited_name: invitedName.trim(),
      role,
      token: crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
    })
    .select(INVITE_FIELDS)
    .single();

  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      throw new Error(`Only workspace Admins can invite members. If you own this workspace, ${migrationHint}`);
    }
    throw error;
  }
  return data;
}

export async function cancelTeamInvitation(invitationId, workspaceOwnerId) {
  const { error } = await supabase
    .from(INVITATIONS_TABLE)
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('workspace_owner_id', workspaceOwnerId)
    .eq('status', 'pending');

  if (error) throw error;
}

export async function updateTeamMemberRole(userId, role) {
  const { error } = await supabase.rpc('crm_update_team_role_20260602000400', {
    p_target_user_id: userId,
    p_next_role: role
  });

  if (error) throw error;
}

export async function removeTeamMember(userId) {
  const { error } = await supabase.rpc('crm_remove_team_member_20260602000600', {
    p_target_user_id: userId
  });

  if (error) throw isMissingFunction(error) ? new Error(`Removing members needs the latest database update. ${migrationHint}`) : error;
}

export async function acceptTeamInvitation(token) {
  const { data, error } = await supabase.rpc('crm_accept_team_invite_20260602000600', {
    p_invite_token: token
  });

  if (error) throw isMissingFunction(error) ? new Error(`Accepting invitations needs the latest database update. ${migrationHint}`) : error;
  return data;
}

export async function validateTeamInvitation(token, email) {
  const { data, error } = await supabase.rpc('crm_validate_team_invite_20260602000400', {
    p_invite_token: token,
    p_invite_email: email.trim().toLowerCase()
  });

  if (error) throw error;
  return data === true;
}

export function invitationLink(token) {
  return `${appBaseUrl()}/?invite=${encodeURIComponent(token)}#/`;
}
