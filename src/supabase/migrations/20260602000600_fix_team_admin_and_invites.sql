/*
# Fix team administration, invitation acceptance, and live sync

Run this whole file once in the Supabase dashboard -> SQL Editor (it is idempotent).

1. Changes
- Every user who owns a workspace is the Admin of that workspace. Previously only the very
  first account in the project became Admin, so every later owner was an Employee and RLS
  blocked them from inviting members ("Add member" failed).
- Existing owner memberships and profiles are repaired to Admin.
- The signup trigger and the identity repair function now assign Admin to non-invited signups.
- `crm_accept_team_invite_20260602000600(token)` lets an already registered user accept an invite.
- `crm_remove_team_member_20260602000600(user_id)` lets an Admin remove a member (the member
  gets their own empty workspace back).
- `crm_update_team_role_20260602000400` now refuses to change the workspace owner's role.
- Adds the workspace table to the realtime publication so team members see each other's edits.

2. Security
- All functions are SECURITY DEFINER with a fixed search_path and derive the caller from auth.uid().
- Execution is granted to authenticated users only.
*/

-- 1. Repair: owners are Admin of their own workspace -------------------------------------
UPDATE public.crm_team_members_20260602000400
SET role = 'Admin'
WHERE member_user_id = workspace_owner_id
  AND role <> 'Admin';

UPDATE public.crm_profiles_20260602000300 AS profile
SET role = member.role
FROM public.crm_team_members_20260602000400 AS member
WHERE member.member_user_id = profile.user_id
  AND profile.role IS DISTINCT FROM member.role;

-- 2. Signup trigger: non-invited signups own (and administer) their workspace -----------
CREATE OR REPLACE FUNCTION public.crm_create_profile_20260602000300()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text := 'Admin';
  assigned_owner uuid := new.id;
  invite_found boolean := false;
  pending_invite public.crm_invitations_20260602000400%ROWTYPE;
BEGIN
  IF new.email IS NOT NULL AND new.raw_user_meta_data->>'invite_token' IS NOT NULL THEN
    SELECT *
      INTO pending_invite
      FROM public.crm_invitations_20260602000400
      WHERE token = new.raw_user_meta_data->>'invite_token'
        AND lower(email) = lower(new.email)
        AND status = 'pending'
        AND expires_at > now()
      FOR UPDATE;

    invite_found := FOUND;
  END IF;

  IF invite_found THEN
    assigned_role := pending_invite.role;
    assigned_owner := pending_invite.workspace_owner_id;
  END IF;

  INSERT INTO public.crm_profiles_20260602000300 (user_id, email, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), pending_invite.invited_name, ''),
    assigned_role
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.crm_team_members_20260602000400 (member_user_id, workspace_owner_id, role)
  VALUES (new.id, assigned_owner, assigned_role)
  ON CONFLICT (member_user_id) DO NOTHING;

  IF invite_found THEN
    UPDATE public.crm_invitations_20260602000400
    SET status = 'accepted', accepted_user_id = new.id
    WHERE id = pending_invite.id AND status = 'pending';
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Never block Supabase Auth signups; the client calls the repair function after login.
  RETURN new;
END;
$$;

-- 3. Identity repair (called by the app after every login) ------------------------------
CREATE OR REPLACE FUNCTION public.crm_initialize_identity_20260602000500()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  auth_account auth.users%ROWTYPE;
  pending_invite public.crm_invitations_20260602000400%ROWTYPE;
  invite_found boolean := false;
  has_membership boolean;
  assigned_role text := 'Admin';
  assigned_owner uuid := current_user_id;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'A signed-in account is required.';
  END IF;

  SELECT * INTO auth_account FROM auth.users WHERE id = current_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The signed-in Supabase account could not be found.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.crm_team_members_20260602000400 WHERE member_user_id = current_user_id
  ) INTO has_membership;

  -- Only a brand-new identity (no membership yet) can be placed via its signup invite token.
  IF NOT has_membership
     AND auth_account.email IS NOT NULL
     AND auth_account.raw_user_meta_data->>'invite_token' IS NOT NULL THEN
    SELECT *
      INTO pending_invite
      FROM public.crm_invitations_20260602000400
      WHERE token = auth_account.raw_user_meta_data->>'invite_token'
        AND lower(email) = lower(auth_account.email)
        AND status = 'pending'
        AND expires_at > now()
      FOR UPDATE;

    invite_found := FOUND;
  END IF;

  IF invite_found THEN
    assigned_role := pending_invite.role;
    assigned_owner := pending_invite.workspace_owner_id;
  END IF;

  INSERT INTO public.crm_team_members_20260602000400 (member_user_id, workspace_owner_id, role)
  VALUES (current_user_id, assigned_owner, assigned_role)
  ON CONFLICT (member_user_id) DO NOTHING;

  -- Owners always administer their own workspace.
  UPDATE public.crm_team_members_20260602000400
  SET role = 'Admin'
  WHERE member_user_id = current_user_id
    AND workspace_owner_id = current_user_id
    AND role <> 'Admin';

  SELECT role INTO assigned_role
  FROM public.crm_team_members_20260602000400
  WHERE member_user_id = current_user_id;

  INSERT INTO public.crm_profiles_20260602000300 (user_id, email, full_name, role)
  VALUES (
    current_user_id,
    COALESCE(auth_account.email, ''),
    COALESCE(NULLIF(auth_account.raw_user_meta_data->>'full_name', ''), pending_invite.invited_name, ''),
    assigned_role
  )
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  IF invite_found THEN
    UPDATE public.crm_invitations_20260602000400
    SET status = 'accepted', accepted_user_id = current_user_id
    WHERE id = pending_invite.id AND status = 'pending';
  END IF;
END;
$$;

-- 4. Accept an invitation as an already registered user --------------------------------
CREATE OR REPLACE FUNCTION public.crm_accept_team_invite_20260602000600(p_invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  caller_email text;
  invite public.crm_invitations_20260602000400%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept this invitation.';
  END IF;

  SELECT email INTO caller_email FROM auth.users WHERE id = current_user_id;

  SELECT * INTO invite
  FROM public.crm_invitations_20260602000400
  WHERE token = p_invite_token
  FOR UPDATE;

  -- Already accepted by this same user (e.g. during signup): nothing left to do.
  IF FOUND AND invite.status = 'accepted' AND invite.accepted_user_id = current_user_id THEN
    RETURN invite.workspace_owner_id;
  END IF;

  IF NOT FOUND OR invite.status <> 'pending' OR invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation is invalid, expired, or was already used.';
  END IF;

  IF lower(invite.email) <> lower(COALESCE(caller_email, '')) THEN
    RAISE EXCEPTION 'This invitation was sent to %, but you are signed in as %.', invite.email, caller_email;
  END IF;

  IF invite.workspace_owner_id <> current_user_id AND EXISTS (
    SELECT 1 FROM public.crm_team_members_20260602000400
    WHERE workspace_owner_id = current_user_id AND member_user_id <> current_user_id
  ) THEN
    RAISE EXCEPTION 'You own a workspace that has other members, so you cannot join another workspace.';
  END IF;

  INSERT INTO public.crm_team_members_20260602000400 (member_user_id, workspace_owner_id, role)
  VALUES (current_user_id, invite.workspace_owner_id, invite.role)
  ON CONFLICT (member_user_id) DO UPDATE
    SET workspace_owner_id = EXCLUDED.workspace_owner_id,
        role = EXCLUDED.role;

  UPDATE public.crm_profiles_20260602000300
  SET role = invite.role,
      full_name = COALESCE(NULLIF(full_name, ''), invite.invited_name, '')
  WHERE user_id = current_user_id;

  UPDATE public.crm_invitations_20260602000400
  SET status = 'accepted', accepted_user_id = current_user_id
  WHERE id = invite.id;

  RETURN invite.workspace_owner_id;
END;
$$;

-- 5. Remove a member from the caller's workspace ----------------------------------------
CREATE OR REPLACE FUNCTION public.crm_remove_team_member_20260602000600(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_workspace uuid;
BEGIN
  SELECT workspace_owner_id INTO caller_workspace
  FROM public.crm_team_members_20260602000400
  WHERE member_user_id = auth.uid() AND role = 'Admin';

  IF caller_workspace IS NULL THEN
    RAISE EXCEPTION 'Only a workspace admin can remove team members.';
  END IF;

  IF p_target_user_id = auth.uid() OR p_target_user_id = caller_workspace THEN
    RAISE EXCEPTION 'The workspace owner and your own account cannot be removed.';
  END IF;

  UPDATE public.crm_team_members_20260602000400
  SET workspace_owner_id = p_target_user_id,
      role = 'Admin'
  WHERE member_user_id = p_target_user_id
    AND workspace_owner_id = caller_workspace;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not a member of your workspace.';
  END IF;

  UPDATE public.crm_profiles_20260602000300 SET role = 'Admin' WHERE user_id = p_target_user_id;
END;
$$;

-- 6. Role changes: never demote the workspace owner -------------------------------------
CREATE OR REPLACE FUNCTION public.crm_update_team_role_20260602000400(
  p_target_user_id uuid,
  p_next_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_workspace uuid;
BEGIN
  IF p_next_role NOT IN ('Admin', 'Manager', 'Employee') THEN
    RAISE EXCEPTION 'Unsupported team role.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role.';
  END IF;

  SELECT workspace_owner_id INTO caller_workspace
  FROM public.crm_team_members_20260602000400
  WHERE member_user_id = auth.uid() AND role = 'Admin';

  IF caller_workspace IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.crm_team_members_20260602000400
    WHERE member_user_id = p_target_user_id AND workspace_owner_id = caller_workspace
  ) THEN
    RAISE EXCEPTION 'Only a workspace admin can change a team member role.';
  END IF;

  IF p_target_user_id = caller_workspace THEN
    RAISE EXCEPTION 'The workspace owner always keeps the Admin role.';
  END IF;

  UPDATE public.crm_team_members_20260602000400
  SET role = p_next_role
  WHERE member_user_id = p_target_user_id AND workspace_owner_id = caller_workspace;

  UPDATE public.crm_profiles_20260602000300 SET role = p_next_role WHERE user_id = p_target_user_id;
END;
$$;

-- 7. Grants --------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.crm_initialize_identity_20260602000500() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_accept_team_invite_20260602000600(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_remove_team_member_20260602000600(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_update_team_role_20260602000400(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.crm_initialize_identity_20260602000500() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_accept_team_invite_20260602000600(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_remove_team_member_20260602000600(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_update_team_role_20260602000400(uuid, text) TO authenticated;

-- 8. Live sync between team members (Supabase Realtime) ---------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'crm_workspace_20260602000000'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_workspace_20260602000000;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
