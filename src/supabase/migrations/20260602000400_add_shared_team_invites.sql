/*
# Add secure CRM team memberships and shareable invitations

1. New Tables
- `crm_team_members_20260602000400`
  - `member_user_id` (uuid, primary key): authenticated team member.
  - `workspace_owner_id` (uuid): owner of the shared CRM workspace.
  - `role` (text): Admin, Manager, or Employee.
  - `created_at` (timestamptz): when membership was established.
- `crm_invitations_20260602000400`
  - `id` (uuid, primary key): invitation record.
  - `workspace_owner_id` (uuid): CRM workspace receiving the invite.
  - `email` (text): invited email address.
  - `invited_name` (text): optional name entered by the workspace admin.
  - `role` (text): role assigned after signup.
  - `token` (text): unguessable invitation token included in the shareable link.
  - `status` (text): pending, accepted, or cancelled.
  - `created_at`, `expires_at`, and `accepted_user_id`: invitation lifecycle details.

2. Security
- Enable RLS on both new tables. Authenticated users can read their own membership; only workspace admins can create, view, or cancel invites.
- Add a workspace-membership policy to the existing CRM workspace store, so invited members share their owner’s CRM records.
- Add safe database functions to validate invitation links, list members, and update member roles. Role changes verify the caller is an admin.
- Update the existing auth profile trigger function to accept valid invitations and assign membership and role on signup. Signup remains safe if profile creation fails.

3. Changes
- Backfill one personal workspace membership per existing profile without changing existing CRM records.
- Existing workspace owners keep their current workspace and records.
- Existing CRM payloads are not deleted or rewritten by this migration.

4. Important Notes
- The app creates shareable invitation links; it does not send email. Share the link with the invited person, who must sign up using the invited email address.
- Invitation links expire after seven days.
- Members collaborate on the workspace owner's existing CRM data. Per-record lead assignment restrictions are not introduced by this change.
*/

CREATE TABLE IF NOT EXISTS public.crm_team_members_20260602000400 (
  member_user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  workspace_owner_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'Employee'
    CHECK (role IN ('Admin', 'Manager', 'Employee')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_invitations_20260602000400 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL DEFAULT '',
  invited_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Employee'
    CHECK (role IN ('Manager', 'Employee')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_user_id uuid REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_team_invites_pending_email_20260602000400
  ON public.crm_invitations_20260602000400 (workspace_owner_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE public.crm_team_members_20260602000400 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_invitations_20260602000400 ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.crm_team_members_20260602000400 TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.crm_invitations_20260602000400 TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_team_members_20260602000400'
      AND policyname = 'crm_team_members_read_self_or_owner'
  ) THEN
    CREATE POLICY crm_team_members_read_self_or_owner
      ON public.crm_team_members_20260602000400
      FOR SELECT TO authenticated
      USING (member_user_id = auth.uid() OR workspace_owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_invitations_20260602000400'
      AND policyname = 'crm_invitations_admin_read'
  ) THEN
    CREATE POLICY crm_invitations_admin_read
      ON public.crm_invitations_20260602000400
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.crm_team_members_20260602000400 AS member
          WHERE member.workspace_owner_id = crm_invitations_20260602000400.workspace_owner_id
            AND member.member_user_id = auth.uid()
            AND member.role = 'Admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_invitations_20260602000400'
      AND policyname = 'crm_invitations_admin_create'
  ) THEN
    CREATE POLICY crm_invitations_admin_create
      ON public.crm_invitations_20260602000400
      FOR INSERT TO authenticated
      WITH CHECK (
        status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.crm_team_members_20260602000400 AS member
          WHERE member.workspace_owner_id = crm_invitations_20260602000400.workspace_owner_id
            AND member.member_user_id = auth.uid()
            AND member.role = 'Admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_invitations_20260602000400'
      AND policyname = 'crm_invitations_admin_cancel'
  ) THEN
    CREATE POLICY crm_invitations_admin_cancel
      ON public.crm_invitations_20260602000400
      FOR UPDATE TO authenticated
      USING (
        status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.crm_team_members_20260602000400 AS member
          WHERE member.workspace_owner_id = crm_invitations_20260602000400.workspace_owner_id
            AND member.member_user_id = auth.uid()
            AND member.role = 'Admin'
        )
      )
      WITH CHECK (
        status = 'cancelled'
        AND EXISTS (
          SELECT 1
          FROM public.crm_team_members_20260602000400 AS member
          WHERE member.workspace_owner_id = crm_invitations_20260602000400.workspace_owner_id
            AND member.member_user_id = auth.uid()
            AND member.role = 'Admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_workspace_20260602000000'
      AND policyname = 'crm_workspace_team_member_access'
  ) THEN
    CREATE POLICY crm_workspace_team_member_access
      ON public.crm_workspace_20260602000000
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.crm_team_members_20260602000400 AS member
          WHERE member.workspace_owner_id = crm_workspace_20260602000000.user_id
            AND member.member_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.crm_team_members_20260602000400 AS member
          WHERE member.workspace_owner_id = crm_workspace_20260602000000.user_id
            AND member.member_user_id = auth.uid()
        )
      );
  END IF;
END
$$;

INSERT INTO public.crm_team_members_20260602000400 (
  member_user_id,
  workspace_owner_id,
  role
)
SELECT user_id, user_id, role
FROM public.crm_profiles_20260602000300
ON CONFLICT (member_user_id) DO NOTHING;

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
  END IF;

  IF FOUND THEN
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

  IF pending_invite.id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.crm_validate_team_invite_20260602000400(
  p_invite_token text,
  p_invite_email text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_invitations_20260602000400
    WHERE token = p_invite_token
      AND lower(email) = lower(p_invite_email)
      AND status = 'pending'
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_list_team_20260602000400(
  p_workspace_owner_id uuid
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_team_members_20260602000400 AS member
    WHERE member.workspace_owner_id = p_workspace_owner_id
      AND member.member_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Workspace membership is required to view team members.';
  END IF;

  RETURN QUERY
    SELECT member.member_user_id,
           COALESCE(profile.full_name, ''),
           COALESCE(profile.email, ''),
           member.role,
           member.created_at
    FROM public.crm_team_members_20260602000400 AS member
    LEFT JOIN public.crm_profiles_20260602000300 AS profile
      ON profile.user_id = member.member_user_id
    WHERE member.workspace_owner_id = p_workspace_owner_id
    ORDER BY member.created_at;
END;
$$;

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

  SELECT member.workspace_owner_id
    INTO caller_workspace
    FROM public.crm_team_members_20260602000400 AS member
    WHERE member.member_user_id = auth.uid()
      AND member.role = 'Admin'
    LIMIT 1;

  IF caller_workspace IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.crm_team_members_20260602000400 AS target
    WHERE target.member_user_id = p_target_user_id
      AND target.workspace_owner_id = caller_workspace
  ) THEN
    RAISE EXCEPTION 'Only a workspace admin can change a team member role.';
  END IF;

  UPDATE public.crm_profiles_20260602000300
  SET role = p_next_role
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected team member profile was not found.';
  END IF;

  UPDATE public.crm_team_members_20260602000400
  SET role = p_next_role
  WHERE member_user_id = p_target_user_id
    AND workspace_owner_id = caller_workspace;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_validate_team_invite_20260602000400(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_list_team_20260602000400(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_update_team_role_20260602000400(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.crm_validate_team_invite_20260602000400(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_list_team_20260602000400(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_update_team_role_20260602000400(uuid, text) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.crm_workspace_20260602000000 TO authenticated;