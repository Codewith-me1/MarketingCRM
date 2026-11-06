/*
# Add authenticated CRM profiles and secure role bootstrap

1. New Tables
- `crm_profiles_20260602000300`
- `user_id` (uuid): profile owner, linked to Supabase Auth.
- `email` (text): email address from the Auth account.
- `full_name` (text): display name from signup metadata.
- `role` (text): Admin, Manager, or Employee.
- `created_at` (timestamptz): profile creation time.

2. Security
- Enable row-level security and allow authenticated users to read only their own profile.
- Create the profile from an Auth signup trigger using a SECURITY DEFINER function.
- Assign Admin to the first profile created after this migration; later profiles default to Employee.
- Grant authenticated users the minimum SQL privileges needed to access their own existing CRM workspace rows.

3. Changes
- No existing tables are dropped or altered.
- Existing CRM workspace records remain unchanged.
- Signups use Supabase Auth; no application-managed password table is created.

4. Important Notes
- The browser uses only the existing Supabase anon key.
- Role assignment is performed by the database and cannot be changed by a normal client request.
*/

CREATE TABLE IF NOT EXISTS public.crm_profiles_20260602000300 (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Employee'
    CHECK (role IN ('Admin', 'Manager', 'Employee')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_profiles_20260602000300 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_profiles_20260602000300'
      AND policyname = 'crm_profiles_owner_select'
  ) THEN
    CREATE POLICY crm_profiles_owner_select
      ON public.crm_profiles_20260602000300
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;

GRANT SELECT ON public.crm_profiles_20260602000300 TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.crm_workspace_20260602000000 TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_create_profile_20260602000300()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_count bigint;
  assigned_role text;
BEGIN
  PERFORM pg_advisory_xact_lock(7312, 42026);

  SELECT count(*)
    INTO account_count
    FROM public.crm_profiles_20260602000300;

  assigned_role := CASE WHEN account_count = 0 THEN 'Admin' ELSE 'Employee' END;

  INSERT INTO public.crm_profiles_20260602000300 (user_id, email, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    assigned_role
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'crm_profile_created_20260602000300'
      AND tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER crm_profile_created_20260602000300
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.crm_create_profile_20260602000300();
  END IF;
END
$$;