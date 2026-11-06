/*
# Create the private CRM workspace store

1. New Tables
- `crm_workspace_20260602000000`
- `id` (uuid): unique workspace row identifier.
- `user_id` (uuid): Supabase Auth user who owns the workspace.
- `payload` (jsonb): CRM leads, campaigns, activities, and team data.
- `updated_at` (timestamptz): last saved time.

2. Security
- Enable row level security.
- Authenticated users can access only the workspace row matching their own user ID.

3. Notes
- The client migrates existing browser-local CRM data when an authenticated user has no saved workspace.
- The table uses a timestamp suffix to avoid collisions with existing tables.
*/

CREATE TABLE IF NOT EXISTS public.crm_workspace_20260602000000 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_workspace_20260602000000 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_workspace_20260602000000'
      AND policyname = 'crm_workspace_owner_access'
  ) THEN
    CREATE POLICY crm_workspace_owner_access
      ON public.crm_workspace_20260602000000
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;