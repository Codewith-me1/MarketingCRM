/*
# Lead capture (web-to-lead) forms

Run this whole file once in the Supabase dashboard -> SQL Editor (it is idempotent).

1. New tables
- `crm_forms_20260602000700`: form definitions owned by a workspace.
- `crm_form_submissions_20260602000700`: public submissions waiting to be imported as leads.

2. Security
- Workspace members manage their own forms and read/claim their own submissions (RLS).
- Visitors never touch the tables directly. They use two SECURITY DEFINER functions:
  `crm_get_public_form_20260602000700` (read an active form) and
  `crm_submit_form_20260602000700` (validated, size-limited insert, capped pending queue).
*/

CREATE TABLE IF NOT EXISTS public.crm_forms_20260602000700 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Contact form',
  title text NOT NULL DEFAULT 'Get in touch',
  description text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[{"key":"name","label":"Full name","required":true},{"key":"email","label":"Email","required":true},{"key":"company","label":"Company","required":false},{"key":"message","label":"How can we help?","required":false}]'::jsonb,
  source text NOT NULL DEFAULT 'Web form',
  campaign text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT '',
  success_message text NOT NULL DEFAULT 'Thanks! We will be in touch shortly.',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_form_submissions_20260602000700 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.crm_forms_20260602000700(id) ON DELETE CASCADE,
  workspace_owner_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'imported')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_form_submissions_owner_status_20260602000700
  ON public.crm_form_submissions_20260602000700 (workspace_owner_id, status, created_at DESC);

ALTER TABLE public.crm_forms_20260602000700 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_form_submissions_20260602000700 ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_forms_20260602000700 TO authenticated;
GRANT SELECT, UPDATE ON public.crm_form_submissions_20260602000700 TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'crm_forms_20260602000700' AND policyname = 'crm_forms_member_access') THEN
    CREATE POLICY crm_forms_member_access ON public.crm_forms_20260602000700
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.crm_team_members_20260602000400 m
                     WHERE m.workspace_owner_id = crm_forms_20260602000700.workspace_owner_id
                       AND m.member_user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.crm_team_members_20260602000400 m
                          WHERE m.workspace_owner_id = crm_forms_20260602000700.workspace_owner_id
                            AND m.member_user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'crm_form_submissions_20260602000700' AND policyname = 'crm_form_submissions_member_read') THEN
    CREATE POLICY crm_form_submissions_member_read ON public.crm_form_submissions_20260602000700
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.crm_team_members_20260602000400 m
                     WHERE m.workspace_owner_id = crm_form_submissions_20260602000700.workspace_owner_id
                       AND m.member_user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'crm_form_submissions_20260602000700' AND policyname = 'crm_form_submissions_member_claim') THEN
    CREATE POLICY crm_form_submissions_member_claim ON public.crm_form_submissions_20260602000700
      FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.crm_team_members_20260602000400 m
                     WHERE m.workspace_owner_id = crm_form_submissions_20260602000700.workspace_owner_id
                       AND m.member_user_id = auth.uid()))
      WITH CHECK (status = 'imported');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.crm_get_public_form_20260602000700(p_form_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id, 'title', title, 'description', description,
    'fields', fields, 'success_message', success_message
  )
  FROM public.crm_forms_20260602000700
  WHERE id = p_form_id AND active;
$$;

CREATE OR REPLACE FUNCTION public.crm_submit_form_20260602000700(p_form_id uuid, p_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  form public.crm_forms_20260602000700%ROWTYPE;
  clean jsonb := '{}'::jsonb;
  field jsonb;
  field_key text;
  field_value text;
  pending bigint;
BEGIN
  SELECT * INTO form FROM public.crm_forms_20260602000700 WHERE id = p_form_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This form is no longer accepting responses.';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR length(p_data::text) > 10000 THEN
    RAISE EXCEPTION 'Invalid submission.';
  END IF;

  -- Keep only the fields defined on the form, trimmed and length-limited.
  FOR field IN SELECT * FROM jsonb_array_elements(form.fields) LOOP
    field_key := field->>'key';
    field_value := left(btrim(COALESCE(p_data->>field_key, '')), 2000);
    IF COALESCE((field->>'required')::boolean, false) AND field_value = '' THEN
      RAISE EXCEPTION '% is required.', COALESCE(field->>'label', field_key);
    END IF;
    IF field_value <> '' THEN
      clean := clean || jsonb_build_object(field_key, field_value);
    END IF;
  END LOOP;

  IF COALESCE(clean->>'email', '') !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address.';
  END IF;

  SELECT count(*) INTO pending
  FROM public.crm_form_submissions_20260602000700
  WHERE form_id = p_form_id AND status = 'new';
  IF pending >= 500 THEN
    RAISE EXCEPTION 'This form is temporarily unavailable. Please try again later.';
  END IF;

  INSERT INTO public.crm_form_submissions_20260602000700 (form_id, workspace_owner_id, data)
  VALUES (
    p_form_id,
    form.workspace_owner_id,
    clean || jsonb_build_object(
      '_form', form.name, '_source', form.source, '_campaign', form.campaign,
      '_owner', form.owner, '_tag', form.tag
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_get_public_form_20260602000700(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_submit_form_20260602000700(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_get_public_form_20260602000700(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_submit_form_20260602000700(uuid, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
