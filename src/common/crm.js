import { today } from './format.js';

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export const addDays = (days, from = new Date()) => {
  const date = new Date(from);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

// ---- Lead scoring ------------------------------------------------------------------------
const STAGE_POINTS = { New: 5, Contacted: 10, Interested: 20, Qualified: 30, Proposal: 38, Negotiation: 45, Converted: 50, Lost: 0 };
const SOURCE_POINTS = { Referral: 12, Webinar: 8, Conference: 8, 'Web form': 8, LinkedIn: 6, Website: 6, 'Google Ads': 5 };

/** 0-100 score from fit (budget, data quality) and engagement (stage, recent activity). */
export function leadScore(lead, activities = []) {
  if (!lead || lead.status === 'Lost') return 0;
  let score = STAGE_POINTS[lead.status] ?? 5;
  score += lead.priority === 'High' ? 12 : lead.priority === 'Medium' ? 6 : 0;
  const budget = Number(lead.budget) || 0;
  score += budget >= 30000 ? 15 : budget >= 15000 ? 10 : budget > 0 ? 5 : 0;
  score += SOURCE_POINTS[lead.source] || 2;
  if (lead.phone) score += 3;
  if (lead.company) score += 3;
  const touches = (lead.timeline || []).length + activities.filter(item => item.lead === lead.name).length;
  score += Math.min(10, touches * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export const scoreBand = score => (score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold');

// ---- Templates ---------------------------------------------------------------------------
export const MERGE_FIELDS = ['name', 'first_name', 'email', 'company', 'owner', 'phone', 'location', 'campaign'];

export function mergeTemplate(text, record = {}, sender = '') {
  const values = {
    name: record.name || '',
    first_name: (record.name || '').split(/\s+/)[0] || 'there',
    email: record.email || '',
    company: record.company || 'your team',
    owner: record.owner || sender,
    phone: record.phone || '',
    location: record.location || '',
    campaign: record.campaign || ''
  };
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in values ? values[key] : match));
}

export function mailtoUrl({ to = [], bcc = [], subject = '', body = '' }) {
  const params = new URLSearchParams();
  if (bcc.length) params.set('bcc', bcc.join(','));
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  return `mailto:${to.map(encodeURIComponent).join(',')}?${params.toString().replace(/\+/g, '%20')}`;
}

// ---- Timeline ----------------------------------------------------------------------------
export const timelineEntry = (type, text, by = '') => ({ id: uid(), type, text, by, at: nowIso() });

// ---- Workflow automations ------------------------------------------------------------------
export const TRIGGERS = {
  lead_created: 'A lead is created',
  stage_changed: 'A lead moves to a stage'
};

export const ACTION_TYPES = {
  create_task: 'Create a task',
  assign_owner: 'Assign owner',
  add_tag: 'Add a tag',
  set_priority: 'Set priority'
};

const matches = (rule, lead) => {
  if (!rule.conditionField || !rule.conditionValue) return true;
  return String(lead[rule.conditionField] ?? '').toLowerCase() === String(rule.conditionValue).toLowerCase();
};

/**
 * Applies built-in timeline logging and user-defined automations to a lead list change.
 * Pure: returns the next { leads, activities, automations } slices.
 */
export function processLeadChange(state, nextLeads, actor = '') {
  const previous = new Map((state.leads || []).map(lead => [lead.id, lead]));
  const rules = (state.automations || []).filter(rule => rule.active);
  let activities = state.activities || [];
  const runCounts = {};

  const leads = nextLeads.map(lead => {
    const before = previous.get(lead.id);
    const created = !before;
    const stageChanged = before && before.status !== lead.status;
    if (!created && !stageChanged) return lead;

    let next = { ...lead, timeline: [...(lead.timeline || [])] };
    next.timeline.unshift(created
      ? timelineEntry('system', `Lead created${lead.source ? ` from ${lead.source}` : ''}`, actor)
      : timelineEntry('stage', `Stage changed from ${before.status} to ${lead.status}`, actor));

    const trigger = created ? 'lead_created' : 'stage_changed';
    rules
      .filter(rule => rule.trigger === trigger && matches(rule, next))
      .forEach(rule => {
        runCounts[rule.id] = (runCounts[rule.id] || 0) + 1;
        (rule.actions || []).forEach(action => {
          if (action.type === 'assign_owner' && action.owner) next.owner = action.owner;
          if (action.type === 'set_priority' && action.priority) next.priority = action.priority;
          if (action.type === 'add_tag' && action.tag) {
            next.tags = [...new Set([...(next.tags || []), action.tag.trim().toLowerCase()])];
          }
          if (action.type === 'create_task') {
            activities = [{
              id: uid(),
              title: mergeTemplate(action.title || 'Follow up with {{name}}', next, actor),
              type: action.taskType || 'Follow-up',
              due: addDays(action.dueInDays || 0),
              owner: next.owner || actor,
              lead: next.name,
              done: false,
              automated: true
            }, ...activities];
          }
        });
        next.timeline.unshift(timelineEntry('automation', `Automation "${rule.name}" ran`, 'Automation'));
      });
    return next;
  });

  const automations = Object.keys(runCounts).length
    ? state.automations.map(rule => (runCounts[rule.id] ? { ...rule, runs: (rule.runs || 0) + runCounts[rule.id], lastRun: nowIso() } : rule))
    : state.automations;

  return { leads, activities, automations };
}

// ---- Quotes & invoices ---------------------------------------------------------------------
export function invoiceTotals(invoice) {
  const subtotal = (invoice.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
  const discount = Math.min(subtotal, Number(invoice.discount) || 0);
  const tax = ((subtotal - discount) * (Number(invoice.taxRate) || 0)) / 100;
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

export const isOverdue = invoice => invoice.type === 'Invoice' && !['Paid', 'Void'].includes(invoice.status) && invoice.dueDate && invoice.dueDate < today();

export const nextNumber = (invoices, type) => {
  const prefix = type === 'Quote' ? 'Q-' : 'INV-';
  const highest = invoices
    .filter(item => item.number?.startsWith(prefix))
    .reduce((max, item) => Math.max(max, Number(item.number.slice(prefix.length)) || 0), 1000);
  return `${prefix}${highest + 1}`;
};
