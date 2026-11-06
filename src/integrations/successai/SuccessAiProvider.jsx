import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useCRM } from '../../data/CRMContext';
import { callSuccessAi } from './client';
import {
  applyContactResults, backoffUntil, clearPending, contactsFromLeads, DEFAULT_SETTINGS, markLeadsAdded,
  mergeCampaigns, pendingPushes, pickDetailIds, pickLeadsToCheck, setCampaignStatus
} from './sync';

const SuccessAiContext = createContext(null);
const AUTO_CHECK_MS = 5 * 60000;

export function SuccessAiProvider({ children }) {
  const { data, update, role, displayName, workspaceOwnerId } = useCRM();
  const [connection, setConnection] = useState({ status: 'loading', configured: false });
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);
  const dataRef = useRef(data);
  const syncingRef = useRef(false);
  dataRef.current = data;

  const meta = data.integrations?.successai || {};
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(meta.settings || {}) }), [meta.settings]);
  const canManage = role === 'Admin' || role === 'Manager';
  const isAdmin = role === 'Admin';

  const setMeta = useCallback(patch => update('integrations', current => ({
    ...current,
    successai: { ...(current?.successai || {}), ...(typeof patch === 'function' ? patch(current?.successai || {}) : patch) }
  })), [update]);

  const loadConnection = useCallback(async () => {
    try {
      const info = await callSuccessAi('connection');
      setConnection({ status: 'ready', ...info });
    } catch (error) {
      setConnection({ status: 'error', configured: false, error: error.message, code: error.code });
    }
  }, []);

  useEffect(() => { if (workspaceOwnerId) loadConnection(); }, [workspaceOwnerId, loadConnection]);

  const rateLimited = meta.rateLimitedUntil && Date.parse(meta.rateLimitedUntil) > Date.now();

  /** Wraps a proxy call: records rate-limit backoff and surfaces errors. */
  const guarded = useCallback(async (action, params) => {
    try {
      return await callSuccessAi(action, params);
    } catch (error) {
      if (error.status === 429) setMeta({ rateLimitedUntil: backoffUntil(error.message), lastError: error.message });
      throw error;
    }
  }, [setMeta]);

  // ---- Sync ---------------------------------------------------------------------------------
  const syncNow = useCallback(async ({ auto = false } = {}) => {
    if (syncingRef.current || !connection.configured) return null;
    const current = dataRef.current;
    const currentMeta = current.integrations?.successai || {};
    if (currentMeta.rateLimitedUntil && Date.parse(currentMeta.rateLimitedUntil) > Date.now()) {
      if (!auto) setNotice({ type: 'error', text: `Success.ai rate limit reached. Try again after ${new Date(currentMeta.rateLimitedUntil).toLocaleTimeString()}.` });
      return null;
    }
    syncingRef.current = true;
    setSyncing(true);
    // Claim the sync so teammates' browsers skip their automatic run.
    setMeta({ lastSyncStartedAt: new Date().toISOString() });
    const summary = { campaigns: 0, linked: 0, contacted: 0, replied: 0, bounced: 0, pushed: 0 };
    let stopReason = '';
    try {
      // 1. Campaigns: list + status/summary for a few, prioritising active ones.
      const result = await guarded('syncCampaigns', {
        detailIds: pickDetailIds(current.campaigns, settings.campaignDetails),
        maxDetails: settings.campaignDetails
      });
      summary.campaigns = result.campaigns.length;
      const mergedCampaigns = mergeCampaigns(current.campaigns, result, current.leads);
      update('campaigns', list => mergeCampaigns(list, result, dataRef.current.leads));
      if (result.rateLimited) stopReason = result.rateLimited;

      // 2. Push CRM outcomes (Converted/Lost) to Success.ai so sequences stop.
      if (!stopReason && canManage && settings.pushClosedStatus) {
        const pushes = pendingPushes(dataRef.current.leads).slice(0, 2);
        const done = [];
        for (const lead of pushes) {
          try {
            await guarded('updateContactStatus', { campaignId: lead.successai.campaignId, email: lead.email, newStatus: lead.successai.pendingStatus });
            done.push(lead.email);
          } catch (error) {
            if (error.status === 429) { stopReason = error.message; break; }
          }
        }
        if (done.length) update('leads', list => clearPending(list, done, 'Success.ai'));
        summary.pushed = done.length;
      }

      // 3. Lead status lookups (budgeted) — links CRM leads found in any Success.ai campaign.
      if (!stopReason && settings.leadChecks > 0) {
        const toCheck = pickLeadsToCheck(dataRef.current.leads, settings.leadChecks);
        if (toCheck.length) {
          const lookup = await guarded('lookupContacts', { emails: toCheck.map(lead => lead.email) });
          const campaigns = mergedCampaigns;
          const preview = applyContactResults(dataRef.current.leads, lookup.results, campaigns, settings, 'Success.ai');
          Object.assign(summary, preview.changes);
          update('leads', list => applyContactResults(list, lookup.results, campaigns, settings, 'Success.ai').leads);
          if (preview.tasks.length) update('activities', list => [...preview.tasks, ...list]);
          if (lookup.rateLimited) stopReason = lookup.rateLimited;
        }
      }

      setMeta(prev => ({
        lastSyncedAt: new Date().toISOString(),
        lastError: stopReason || '',
        lastSummary: summary,
        rateLimitedUntil: stopReason ? backoffUntil(stopReason) : prev.rateLimitedUntil
      }));
      if (!auto || summary.replied) {
        const parts = [`${summary.campaigns} campaign${summary.campaigns === 1 ? '' : 's'}`];
        if (summary.linked) parts.push(`${summary.linked} lead${summary.linked === 1 ? '' : 's'} matched`);
        if (summary.contacted) parts.push(`${summary.contacted} contacted`);
        if (summary.replied) parts.push(`${summary.replied} replied`);
        if (summary.bounced) parts.push(`${summary.bounced} bounced/unsubscribed`);
        if (summary.pushed) parts.push(`${summary.pushed} status update${summary.pushed === 1 ? '' : 's'} sent`);
        setNotice({ type: stopReason ? 'error' : 'success', text: `Synced ${parts.join(', ')}.${stopReason ? ` Stopped early: ${stopReason}` : ''}` });
      }
      return summary;
    } catch (error) {
      setMeta({ lastError: error.message, lastSyncedAt: new Date().toISOString() });
      if (!auto) setNotice({ type: 'error', text: error.message });
      return null;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [connection.configured, settings, canManage, guarded, setMeta, update]);

  // Automatic sync: at most every `autoSyncHours`, shared across the team via the workspace.
  useEffect(() => {
    if (!connection.configured || !settings.autoSyncHours) return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const m = dataRef.current.integrations?.successai || {};
      const last = Date.parse(m.lastSyncStartedAt || m.lastSyncedAt || 0) || 0;
      if (Date.now() - last >= settings.autoSyncHours * 3600000) syncNow({ auto: true });
    };
    const first = window.setTimeout(tick, 4000);
    const timer = window.setInterval(tick, AUTO_CHECK_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [connection.configured, settings.autoSyncHours, syncNow]);

  // ---- Actions --------------------------------------------------------------------------------
  const saveKey = useCallback(async apiKey => {
    const info = await callSuccessAi('saveKey', { apiKey });
    setConnection({ status: 'ready', ...info });
    setMeta({ rateLimitedUntil: '', lastError: '' });
    return info;
  }, [setMeta]);

  const removeKey = useCallback(async () => {
    await callSuccessAi('removeKey');
    setConnection({ status: 'ready', configured: false });
  }, []);

  const setCampaignRunning = useCallback(async (campaign, run) => {
    const result = await guarded(run ? 'launch' : 'pause', { campaignId: campaign.externalId });
    update('campaigns', list => setCampaignStatus(list, campaign.externalId, result?.status || (run ? 'active' : 'paused')));
    return result;
  }, [guarded, update]);

  const createCampaign = useCallback(async (name, timezone) => {
    const result = await guarded('createCampaign', { name, timezone });
    update('campaigns', list => mergeCampaigns(list, { campaigns: [{ id: result.campaignId, name }, ...list.filter(item => item.provider === 'successai' && !item.missing).map(item => ({ id: item.externalId, name: item.name }))], details: {}, syncedAt: new Date().toISOString() }, dataRef.current.leads));
    return result;
  }, [guarded, update]);

  /** Uploads CRM leads to a Success.ai campaign (max 500) and marks them locally. */
  const addLeadsToCampaign = useCallback(async (campaign, leads) => {
    const contacts = contactsFromLeads(leads).slice(0, 500);
    const result = await guarded('addContacts', { campaignId: campaign.externalId, contacts });
    update('leads', list => markLeadsAdded(list, contacts.map(item => item.email), campaign, displayName));
    return result;
  }, [guarded, update, displayName]);

  /** Looks up specific leads now (1 API call each, max 10). */
  const checkLeads = useCallback(async leads => {
    const lookup = await guarded('lookupContacts', { emails: leads.map(lead => lead.email).filter(Boolean).slice(0, 10) });
    const campaigns = dataRef.current.campaigns;
    const preview = applyContactResults(dataRef.current.leads, lookup.results, campaigns, settings, 'Success.ai');
    update('leads', list => applyContactResults(list, lookup.results, campaigns, settings, 'Success.ai').leads);
    if (preview.tasks.length) update('activities', list => [...preview.tasks, ...list]);
    return lookup.results;
  }, [guarded, update, settings]);

  const campaignCount = useCallback((campaign, startDate, endDate) => guarded('campaignCount', { campaignId: campaign.externalId, startDate, endDate }), [guarded]);

  const updateSettings = useCallback(patch => setMeta(current => ({ settings: { ...DEFAULT_SETTINGS, ...(current.settings || {}), ...patch } })), [setMeta]);

  const campaigns = useMemo(() => data.campaigns.filter(item => item.provider === 'successai' && item.externalId), [data.campaigns]);

  const value = useMemo(() => ({
    connection, loadConnection, syncing, notice, clearNotice: () => setNotice(null), meta, settings, rateLimited,
    canManage, isAdmin, campaigns, syncNow, saveKey, removeKey, setCampaignRunning, createCampaign,
    addLeadsToCampaign, checkLeads, campaignCount, updateSettings
  }), [connection, loadConnection, syncing, notice, meta, settings, rateLimited, canManage, isAdmin, campaigns, syncNow, saveKey, removeKey, setCampaignRunning, createCampaign, addLeadsToCampaign, checkLeads, campaignCount, updateSettings]);

  return <SuccessAiContext.Provider value={value}>{children}</SuccessAiContext.Provider>;
}

export const useSuccessAi = () => useContext(SuccessAiContext);
