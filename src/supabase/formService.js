import supabase, { appBaseUrl } from './supabase';
import { today } from '../common/format';
import { uid } from '../common/crm';

const FORMS = 'crm_forms_20260602000700';
const SUBMISSIONS = 'crm_form_submissions_20260602000700';
const FORM_FIELDS = 'id, name, title, description, fields, source, campaign, owner, tag, success_message, active, created_at';

export const AVAILABLE_FIELDS = [
  { key: 'name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'City / country' },
  { key: 'budget', label: 'Budget' },
  { key: 'message', label: 'Message' }
];

const friendly = error => {
  if (/does not exist|schema cache|PGRST20/i.test(error?.message || '')) {
    return new Error('Web forms need the database update. Apply src/supabase/migrations/20260602000700_add_lead_capture_forms.sql in the Supabase SQL editor.');
  }
  return error;
};

export async function listForms(ownerId) {
  const { data, error } = await supabase.from(FORMS).select(FORM_FIELDS).eq('workspace_owner_id', ownerId).order('created_at', { ascending: false });
  if (error) throw friendly(error);
  return data || [];
}

export async function saveForm(ownerId, form) {
  const row = {
    workspace_owner_id: ownerId,
    name: form.name, title: form.title, description: form.description, fields: form.fields,
    source: form.source, campaign: form.campaign, owner: form.owner, tag: form.tag,
    success_message: form.success_message, active: form.active
  };
  const query = form.id
    ? supabase.from(FORMS).update(row).eq('id', form.id)
    : supabase.from(FORMS).insert(row);
  const { data, error } = await query.select(FORM_FIELDS).single();
  if (error) throw friendly(error);
  return data;
}

export async function deleteForm(id) {
  const { error } = await supabase.from(FORMS).delete().eq('id', id);
  if (error) throw friendly(error);
}

export async function listSubmissions(ownerId, limit = 50) {
  const { data, error } = await supabase.from(SUBMISSIONS).select('id, form_id, data, status, created_at')
    .eq('workspace_owner_id', ownerId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw friendly(error);
  return data || [];
}

/** Atomically marks new submissions as imported and returns them (safe with several open browsers). */
export async function claimFormSubmissions(ownerId) {
  const { data, error } = await supabase.from(SUBMISSIONS).update({ status: 'imported' })
    .eq('workspace_owner_id', ownerId).eq('status', 'new').select('id, data, created_at');
  if (error) throw error;
  return data || [];
}

export function submissionToLead(row) {
  const d = row.data || {};
  return {
    id: uid(),
    name: d.name || d.email?.split('@')[0] || 'Web lead',
    email: (d.email || '').toLowerCase(),
    phone: d.phone || '',
    whatsapp: '',
    company: d.company || '',
    location: d.location || '',
    source: d._source || 'Web form',
    campaign: d._campaign || '',
    status: 'New',
    priority: 'Medium',
    budget: Number(String(d.budget || '').replace(/[^\d.]/g, '')) || 0,
    owner: d._owner || '',
    notes: d.message ? `Form message: ${d.message}` : '',
    followUp: '',
    tags: d._tag ? [d._tag.toLowerCase()] : [],
    createdAt: (row.created_at || today()).slice(0, 10),
    formName: d._form || ''
  };
}

export async function fetchPublicForm(id) {
  const { data, error } = await supabase.rpc('crm_get_public_form_20260602000700', { p_form_id: id });
  if (error) throw friendly(error);
  return data;
}

export async function submitPublicForm(id, values) {
  const { error } = await supabase.rpc('crm_submit_form_20260602000700', { p_form_id: id, p_data: values });
  if (error) throw friendly(error);
}

export const publicFormUrl = id => `${appBaseUrl()}/#/form/${id}`;
export const embedCode = id => `<iframe src="${publicFormUrl(id)}" title="Contact form" style="width:100%;max-width:560px;height:640px;border:0;"></iframe>`;
