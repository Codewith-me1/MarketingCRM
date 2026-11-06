/*
# Repair CRM identity initialization and workspace membership

1. Changes
- Replaces the existing CRM auth-user trigger function with a serialized, invitation-aware version.
- Adds `crm_initialize_identity_20260602000500()`, a safe authenticated repair operation that ensures a signed-in user has a profile and workspace membership.
- Repairs profiles or memberships skipped by a previously swallowed trigger error without deleting or rewriting CRM workspace records.

2. Security
- Both functions run as `SECURITY DEFINER` with a fixed `search_path`.
- The repair function derives the user identity from `auth.uid()` and accepts no user ID or role from the browser.
- Only authenticated users may call the repair function.

3. Important Notes
- The migration does not add or drop tables, policies, or existing CRM data.
- The browser calls the repair function after login; invitation email delivery is not performed by this migration.
*/

CREATE OR REPLACE FUNCTION public.crm_create_profile_20260602000300()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_count bigint;
  assigned_role text;
  assigned_owner uuid;
  invite_found boolean := false;
  pending_invite public.crm_invitations_20260602000400%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(7312, 42026);

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
  ELSE
    SELECT count(*)
      INTO account_count
      FROM public.crm_profiles_20260602000300;

    assigned_role := CASE WHEN account_count = 0 THEN 'Admin' ELSE 'Employee' END;
    assigned_owner := new.id;
  END IF;

  INSERT INTO public.crm_profiles_20260602000300 (
    user_id,
    email,
    full_name,
    role
  )
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(
      NULLIF(new.raw_user_meta_data->>'full_name', ''),
      pending_invite.invited_name,
      ''
    ),
    assigned_role
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.crm_team_members_20260602000400 (
    member_user_id,
    workspace_owner_id,
    role
  )
  VALUES (new.id, assigned_owner, assigned_role)
  ON CONFLICT (member_user_id) DO NOTHING;

  IF invite_found THEN
    UPDATE public.crm_invitations_20260602000400
    SET status = 'accepted',
        accepted_user_id = new.id
    WHERE id = pending_invite.id
      AND status = 'pending';
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;

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
  account_count bigint;
  assigned_role text;
  assigned_owner uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'A signed-in account is required.';
  END IF;

  SELECT *
    INTO auth_account
    FROM auth.users
    WHERE id = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The signed-in Supabase account could not be found.';
  END IF;

  IF auth_account.email IS NOT NULL
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
  ELSE
    SELECT role
      INTO assigned_role
      FROM public.crm_profiles_20260602000300
      WHERE user_id = current_user_id;

    IF assigned_role IS NULL THEN
      PERFORM pg_advisory_xact_lock(7312, 42026);

      SELECT count(*)
        INTO account_count
        FROM public.crm_profiles_20260602000300;

      assigned_role := CASE WHEN account_count = 0 THEN 'Admin' ELSE 'Employee' END;
    END IF;

    assigned_owner := current_user_id;
  END IF;

  INSERT INTO public.crm_profiles_20260602000300 (
    user_id,
    email,
    full_name,
    role
  )
  VALUES (
    current_user_id,
    COALESCE(auth_account.email, ''),
    COALESCE(
      NULLIF(auth_account.raw_user_meta_data->>'full_name', ''),
      pending_invite.invited_name,
      ''
    ),
    assigned_role
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF invite_found THEN
    UPDATE public.crm_profiles_20260602000300
    SET role = assigned_role
    WHERE user_id = current_user_id;
  ELSE
    SELECT role
      INTO assigned_role
      FROM public.crm_profiles_20260602000300
      WHERE user_id = current_user_id;
  END IF;

  INSERT INTO public.crm_team_members_20260602000400 (
    member_user_id,
    workspace_owner_id,
    role
  )
  VALUES (current_user_id, assigned_owner, assigned_role)
  ON CONFLICT (member_user_id) DO NOTHING;

  IF invite_found THEN
    UPDATE public.crm_invitations_20260602000400
    SET status = 'accepted',
        accepted_user_id = current_user_id
    WHERE id = pending_invite.id
      AND status = 'pending';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_initialize_identity_20260602000500() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_initialize_identity_20260602000500() TO authenticated;