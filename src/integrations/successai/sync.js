// Pure helpers that merge Success.ai data into the CRM workspace. No React, no network.
import { addDays, nowIso, timelineEntry, uid } from '../../common/crm.js';
import { stages } from '../../data/seed.js';

export const PROVIDER = 'successai';

/** Default budget: fits Success.ai's default quota (20/min, 50/hour, 100/day). */
export const DEFAULT_SETTINGS = {
  autoSyncHours: 4,      // 0 = off
  campaignDetails: 3,    // campaigns refreshed per sync (2 API calls each)
  leadChecks: 6,         // leads looked up per sync (1 API call each)
  advanceStages: true,   // move CRM lead stages from outreach activity
  pushClosedStatus: true // tell Success.ai when a lead is Converted/Lost in the CRM
};

export const estimateCalls = settings => 1 + settings.campaignDetails * 2 + settings.leadChecks + 2;

export const CONTACT_STATUS_LABELS = {
  queued: 'Queued',
  'not contacted': 'Not contacted yet',
  contacted: 'Contacted',
  replied: 'Replied',
  bounced: 'Bounced',
  unsubscribed: 'Unsubscribed',
  completed: 'Sequence completed'
};

// Higher = further along; used when a lead is in several campaigns.
const STATUS_RANK = { replied: 6, contacted: 4, completed: 3, bounced: 2, unsubscribed: 2, 'not contacted': 1, queued: 0 };
const TERMINAL = new Set(['replied', 'bounced', 'unsubscribed', 'completed']);

export const CAMPAIGN_STATUS = { active: 'Active', paused: 'Paused', draft: 'Draft', completed: 'Completed' };

const stageIndex = stage => stages.indexOf(stage);
const advanceTo = (current, target) => {
  if (['Converted', 'Lost'].includes(current)) return current;
  return stageIndex(target) > stageIndex(current) ? target : current;
};

// ---- Campaigns ---------------------------------------------------------------------------------

/** Campaign ids to refresh in detail: active ones first, then the least recently synced. */
export function pickDetailIds(campaigns, limit) {
  return campaigns
    .filter(item => item.provider === PROVIDER && !item.missing)
    .sort((a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1) || String(a.syncedAt || '').localeCompare(String(b.syncedAt || '')))
    .slice(0, limit)
    .map(item => item.externalId);
}

/** Upserts Success.ai campaigns into the CRM campaign list, keeping local budget/revenue edits. */
export function mergeCampaigns(local, result, leads = []) {
  // Defensive: never keep a Success.ai campaign without an id (an undefined id would match every lead).
  local = local.filter(item => item.provider !== PROVIDER || item.externalId);
  result = { ...result, campaigns: (result.campaigns || []).filter(item => item && item.id) };
  const byExternal = new Map(local.filter(item => item.provider === PROVIDER).map(item => [item.externalId, item]));
  const remoteIds = new Set(result.campaigns.map(item => item.id));
  const merged = result.campaigns.map(remote => {
    const existing = byExternal.get(remote.id);
    const detail = result.details?.[remote.id];
    const s = detail?.summary || {};
    const linked = leads.filter(lead => lead.successai?.campaignId && lead.successai.campaignId === remote.id);
    const base = existing || { id: uid(), provider: PROVIDER, externalId: remote.id, channel: 'Success.ai email', budget: 0, revenue: 0, status: 'Draft', leads: 0, conversions: 0, stats: null };
    return {
      ...base,
      name: remote.name || base.name,
      missing: false,
      ...(detail ? {
        status: CAMPAIGN_STATUS[detail.status] || 'Draft',
        leads: Number(s.totalLeads) || 0,
        stats: {
          totalLeads: Number(s.totalLeads) || 0,
          contacted: Number(s.contacted) || 0,
          notYetContacted: Number(s.notYetContacted) || 0,
          read: Number(s.leadsWhoRead) || 0,
          replied: Number(s.leadsWhoReplied) || 0,
          bounced: Number(s.bounced) || 0,
          unsubscribed: Number(s.unsubscribed) || 0,
          completed: Number(s.completed) || 0
        },
        syncedAt: result.syncedAt
      } : {}),
      conversions: linked.filter(lead => lead.status === 'Converted').length
    };
  });
  const untouchedLocal = local.filter(item => item.provider !== PROVIDER);
  const removed = local.filter(item => item.provider === PROVIDER && !remoteIds.has(item.externalId)).map(item => ({ ...item, missing: true }));
  return [...merged, ...removed, ...untouchedLocal];
}

/** Applies a launch/pause response immediately, without waiting for the next sync. */
export const setCampaignStatus = (campaigns, externalId, status) => campaigns.map(item => (item.externalId === externalId ? { ...item, status: CAMPAIGN_STATUS[status] || item.status } : item));

// ---- Leads ---------------------------------------------------------------------------------------

/**
 * Leads to look up this sync, within budget:
 *  1. linked leads still in progress (oldest check first),
 *  2. unlinked leads never checked, or not checked for 7 days (to discover campaign membership).
 */
export function pickLeadsToCheck(leads, limit, now = Date.now()) {
  if (limit <= 0) return [];
  const withEmail = leads.filter(lead => lead.email && !['Converted', 'Lost'].includes(lead.status));
  const age = lead => Date.parse(lead.successai?.checkedAt || 0) || 0;
  const inProgress = withEmail
    .filter(lead => lead.successai?.campaignId && !TERMINAL.has(lead.successai.status))
    .sort((a, b) => age(a) - age(b));
  const discover = withEmail
    .filter(lead => !lead.successai?.campaignId && (!lead.successai?.checkedAt || now - age(lead) > 7 * 86400000))
    .sort((a, b) => age(a) - age(b));
  return [...inProgress, ...discover].slice(0, limit);
}

/**
 * Merges contact lookups into leads: links leads to campaigns, records status, moves stages,
 * tags bounces/unsubscribes and returns follow-up tasks for replies.
 */
export function applyContactResults(leads, results, campaigns, settings = DEFAULT_SETTINGS, actor = 'Success.ai') {
  const byEmail = new Map(results.map(item => [item.email.toLowerCase(), item]));
  const nameOf = id => campaigns.find(item => item.externalId === id)?.name || 'Success.ai campaign';
  const tasks = [];
  const changes = { linked: 0, contacted: 0, replied: 0, bounced: 0 };

  const next = leads.map(lead => {
    const result = lead.email && byEmail.get(lead.email.toLowerCase());
    if (!result) return lead;
    const checkedAt = nowIso();
    if (!result.found) {
      return lead.successai?.campaignId
        ? { ...lead, successai: { ...lead.successai, checkedAt } }
        : { ...lead, successai: { checkedAt, notFound: true } };
    }
    const contacts = (result.contacts || []).filter(contact => contact.campaignId);
    if (!contacts.length) return lead.successai?.campaignId ? { ...lead, successai: { ...lead.successai, checkedAt } } : { ...lead, successai: { checkedAt, notFound: true } };
    const best = [...contacts].sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0))[0];
    const previous = lead.successai || {};
    const updated = { ...lead, timeline: [...(lead.timeline || [])], tags: [...(lead.tags || [])] };
    const campaignName = nameOf(best.campaignId);
    updated.successai = {
      ...previous, notFound: false, campaignId: best.campaignId, campaignName,
      status: best.status, isRead: best.isRead, interested: best.interested, checkedAt,
      campaigns: contacts.length
    };
    if (!updated.campaign) updated.campaign = campaignName;

    const statusChanged = previous.status !== best.status || previous.campaignId !== best.campaignId;
    if (!previous.campaignId) {
      changes.linked += 1;
      updated.timeline.unshift(timelineEntry('email', `Found in Success.ai campaign "${campaignName}" (${CONTACT_STATUS_LABELS[best.status] || best.status})`, actor));
    } else if (statusChanged) {
      updated.timeline.unshift(timelineEntry('email', `Success.ai: ${CONTACT_STATUS_LABELS[best.status] || best.status} in "${campaignName}"`, actor));
    }
    if (best.isRead && !previous.isRead) updated.timeline.unshift(timelineEntry('email', `Opened an email from "${campaignName}"`, actor));

    if (best.status === 'contacted' || best.status === 'completed') {
      if (settings.advanceStages) updated.status = advanceTo(updated.status, 'Contacted');
      if (statusChanged) changes.contacted += 1;
    }
    if (best.status === 'replied') {
      if (settings.advanceStages) updated.status = advanceTo(updated.status, 'Interested');
      if (statusChanged) {
        changes.replied += 1;
        updated.priority = 'High';
        tasks.push({ id: uid(), title: `Reply from ${lead.name} (${campaignName}) — respond`, type: 'Email', due: addDays(0), owner: lead.owner || actor, lead: lead.name, done: false, automated: true });
      }
    }
    if (best.status === 'bounced' || best.status === 'unsubscribed') {
      if (!updated.tags.includes(best.status)) updated.tags.push(best.status);
      if (statusChanged) changes.bounced += 1;
    }
    if (best.interested && !updated.tags.includes('interested')) updated.tags.push('interested');
    return updated;
  });

  return { leads: next, tasks, changes };
}

/** Marks leads as queued in a campaign right after a successful upload. */
export function markLeadsAdded(leads, emails, campaign, actor) {
  const set = new Set(emails.map(email => email.toLowerCase()));
  return leads.map(lead => (lead.email && set.has(lead.email.toLowerCase())
    ? {
        ...lead,
        campaign: lead.campaign || campaign.name,
        successai: { ...(lead.successai || {}), notFound: false, campaignId: campaign.externalId, campaignName: campaign.name, status: 'queued', addedAt: nowIso(), checkedAt: nowIso() },
        tags: [...new Set([...(lead.tags || []), 'in-sequence'])],
        timeline: [timelineEntry('email', `Added to Success.ai campaign "${campaign.name}"`, actor), ...(lead.timeline || [])]
      }
    : lead));
}

/** Leads whose CRM outcome should be pushed back to Success.ai (stops the sequence). */
export const pendingPushes = leads => leads.filter(lead => lead.successai?.pendingStatus && lead.successai.campaignId && lead.email);

export const clearPending = (leads, emails, actor) => {
  const set = new Set(emails);
  return leads.map(lead => (set.has(lead.email)
    ? { ...lead, successai: { ...lead.successai, pushedStatus: lead.successai.pendingStatus, pendingStatus: undefined }, timeline: [timelineEntry('email', `Success.ai status set to "${lead.successai.pendingStatus}"`, actor), ...(lead.timeline || [])] }
    : lead));
};

/** Parses a 429 message into the time the next call is allowed. */
export function backoffUntil(message, now = Date.now()) {
  if (/daily|tomorrow/i.test(message)) { const d = new Date(now); d.setHours(24, 5, 0, 0); return d.toISOString(); }
  if (/hour/i.test(message)) return new Date(now + 60 * 60000).toISOString();
  return new Date(now + 70000).toISOString();
}

export function contactsFromLeads(leads) {
  return leads.filter(lead => lead.email).map(lead => {
    const [firstName, ...rest] = (lead.name || '').trim().split(/\s+/);
    return { email: lead.email, firstName: firstName || '', lastName: rest.join(' '), companyName: lead.company || '', location: lead.location || '' };
  });
}
