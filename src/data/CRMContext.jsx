import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultAutomations, defaultTemplates, initialData } from './seed';
import { processLeadChange, timelineEntry } from '../common/crm';
import { claimFormSubmissions, submissionToLead } from '../supabase/formService';
import { initials } from '../common/format';
import supabase, { supabaseConfigError } from '../supabase/supabase';
import { fetchWorkspace, saveWorkspace, subscribeToWorkspace } from '../supabase/crmService';
import {
  fetchProfile,
  initializeProfileAndMembership,
  signInWithPassword,
  signOutUser,
  signUpWithPassword
} from '../supabase/authService';
import { acceptTeamInvitation, fetchMembership, fetchTeamMembers } from '../supabase/teamService';

const CRMContext = createContext(null);
const LEGACY_STORAGE_KEY = 'northstar-crm-data';
const THEME_KEY = 'northstar-crm-theme';
const SAVE_DELAY_MS = 600;
const SLOW_LOAD_MS = 15000;
const FOCUS_REFRESH_MS = 30000;
const COLLECTIONS = ['leads', 'campaigns', 'activities', 'companies', 'deals', 'products', 'invoices'];

const cacheKey = userId => `northstar-crm-cache:${userId}`;

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage full or blocked: caching is optional */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
};

const readCache = userId => {
  try {
    const raw = storage.get(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Workspace payload holds CRM records only; the team roster always comes from the database. */
const normalize = payload => {
  const source = payload && typeof payload === 'object' ? payload : initialData;
  const next = { ...source };
  delete next.team;
  COLLECTIONS.forEach(key => {
    if (!Array.isArray(next[key])) next[key] = [];
  });
  // Workspaces created before templates/automations existed get the starter set.
  if (!Array.isArray(next.templates)) next.templates = defaultTemplates;
  if (!Array.isArray(next.automations)) next.automations = defaultAutomations;
  return next;
};

const sameInstant = (a, b) => Boolean(a && b) && Date.parse(a) === Date.parse(b);
const isOlder = (a, b) => Boolean(a && b) && Date.parse(a) < Date.parse(b);

const describeError = error => {
  const message = error?.message || String(error || '');
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Cannot reach Supabase. Check your internet connection and VITE_SUPABASE_URL in .env.';
  }
  if (error?.code === 'PGRST202' || error?.code === '42P01' || /schema cache|does not exist/i.test(message)) {
    return 'The CRM database tables or functions are missing. Apply the SQL files in src/supabase/migrations in the Supabase SQL editor.';
  }
  if (/jwt|invalid api key/i.test(message)) {
    return 'Supabase rejected the API key. Check VITE_SUPABASE_ANON_KEY in .env.';
  }
  return message || 'Workspace data could not be loaded.';
};

const readInviteToken = () => new URLSearchParams(window.location.search).get('invite') || '';

const clearInviteToken = () => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite')) return;
  url.searchParams.delete('invite');
  window.history.replaceState(null, '', url.toString());
};

export function CRMProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState('Employee');
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState(null);
  const [workspaceStatus, setWorkspaceStatus] = useState('idle'); // idle | loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [slowLoad, setSlowLoad] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [inviteMessage, setInviteMessage] = useState(null);
  const [data, setData] = useState(() => normalize(null));
  const [team, setTeam] = useState([]);
  const [theme, setTheme] = useState(() => storage.get(THEME_KEY) || 'light');
  const [globalSearch, setGlobalSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const dirtyRef = useRef(false);
  const lastSyncedAtRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const dataRef = useRef(data);
  const ownerRef = useRef(workspaceOwnerId);
  const actorRef = useRef('');
  dataRef.current = data;
  ownerRef.current = workspaceOwnerId;

  // ---- Authentication -------------------------------------------------------------------
  useEffect(() => {
    storage.remove(LEGACY_STORAGE_KEY); // old shared cache could leak data between accounts

    if (supabaseConfigError) {
      setAuthReady(true);
      return undefined;
    }

    let mounted = true;
    // Token refreshes emit new session objects; only re-render when the account changes.
    const applySession = session => setUser(previous => {
      const next = session?.user ?? null;
      return previous?.id === next?.id && previous?.email === next?.email ? previous : next;
    });

    supabase.auth.getSession()
      .then(({ data: sessionData, error }) => {
        if (!mounted) return;
        if (error) console.error('Unable to restore the Supabase session:', error);
        applySession(sessionData?.session);
      })
      .catch(error => console.error('Unable to restore the Supabase session:', error))
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') setRecoveryMode(false);
      applySession(session);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ---- Workspace hydration (cache first, then Supabase) ---------------------------------
  useEffect(() => {
    const userId = user?.id;
    dirtyRef.current = false;
    lastSyncedAtRef.current = null;

    if (!userId) {
      setProfile(null);
      setRole('Employee');
      setWorkspaceOwnerId(null);
      setTeam([]);
      setData(normalize(null));
      setWorkspaceStatus('idle');
      setLoadError('');
      setProfileError('');
      setCloudError('');
      return undefined;
    }

    let active = true;
    const cached = readCache(userId);

    if (cached?.ownerId && cached.data) {
      // Instant start: render the last known workspace while Supabase is refreshed.
      setData(normalize(cached.data));
      setWorkspaceOwnerId(cached.ownerId);
      setRole(cached.role || 'Employee');
      setProfile(cached.profile || null);
      setTeam(Array.isArray(cached.team) ? cached.team : []);
      setWorkspaceStatus('ready');
    } else {
      setWorkspaceStatus('loading');
    }
    setLoadError('');
    setSlowLoad(false);
    setProfileError('');

    const slowTimer = window.setTimeout(() => {
      if (active) setSlowLoad(true);
    }, SLOW_LOAD_MS);

    const hydrate = async () => {
      try {
        try {
          await initializeProfileAndMembership();
        } catch (error) {
          console.error('Unable to initialize the CRM identity:', error);
          if (active) setProfileError(describeError(error));
        }

        const inviteToken = readInviteToken();
        if (inviteToken) {
          try {
            await acceptTeamInvitation(inviteToken);
            if (active) setInviteMessage({ type: 'success', text: 'Invitation accepted. You are now part of the team workspace.' });
          } catch (error) {
            if (active) setInviteMessage({ type: 'error', text: error.message || 'The invitation could not be accepted.' });
          } finally {
            clearInviteToken();
          }
        }

        const [nextProfile, membership] = await Promise.all([fetchProfile(userId), fetchMembership(userId)]);
        if (!active) return;

        const ownerId = membership.workspaceOwnerId;
        const nextRole = ownerId === userId ? 'Admin' : (membership.role || nextProfile?.role || 'Employee');

        const [remote, members] = await Promise.all([
          fetchWorkspace(ownerId),
          fetchTeamMembers(ownerId).catch(error => {
            console.error('Unable to load team members:', error);
            return null;
          })
        ]);
        if (!active) return;

        let nextData;
        if (remote?.payload && typeof remote.payload === 'object') {
          nextData = normalize(remote.payload);
          lastSyncedAtRef.current = remote.updatedAt;
        } else {
          nextData = normalize(cached?.ownerId === ownerId ? cached.data : null);
          lastSyncedAtRef.current = await saveWorkspace(ownerId, nextData);
          if (!active) return;
        }

        const ownerChanged = cached?.ownerId && cached.ownerId !== ownerId;
        if (!dirtyRef.current || ownerChanged) {
          dirtyRef.current = false;
          setData(nextData);
        }

        setProfile(nextProfile);
        setRole(nextRole);
        setWorkspaceOwnerId(ownerId);
        setTeam(members || [{
          id: userId,
          user_id: userId,
          name: nextProfile?.full_name || user.email,
          email: user.email,
          role: nextRole,
          status: 'Active',
          isOwner: ownerId === userId,
          initials: initials(nextProfile?.full_name || user.email)
        }]);
        setCloudError(members ? '' : 'Team members could not be loaded. Apply the latest migration in src/supabase/migrations.');
        setLoadError('');
        setWorkspaceStatus('ready');
        lastRefreshRef.current = Date.now();
      } catch (error) {
        console.error('Unable to load the Supabase CRM workspace:', error);
        if (!active) return;
        if (cached?.ownerId) {
          setCloudError(`Showing your last saved copy. ${describeError(error)}`);
        } else {
          setLoadError(describeError(error));
          setWorkspaceStatus('error');
        }
      } finally {
        window.clearTimeout(slowTimer);
        if (active) setSlowLoad(false);
      }
    };

    hydrate();
    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, [user?.id, reloadKey]);

  // ---- Saving --------------------------------------------------------------------------
  const flush = useCallback(async () => {
    const ownerId = ownerRef.current;
    if (!dirtyRef.current || !ownerId) return;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      lastSyncedAtRef.current = await saveWorkspace(ownerId, dataRef.current);
      setCloudError('');
      setSaveState(dirtyRef.current ? 'saving' : 'saved');
    } catch (error) {
      console.error('Unable to save the Supabase CRM workspace:', error);
      dirtyRef.current = true;
      setSaveState('error');
      setCloudError(`Changes could not be saved to Supabase. ${describeError(error)}`);
    }
  }, []);

  useEffect(() => {
    if (!workspaceOwnerId || !dirtyRef.current) return undefined;
    const timer = window.setTimeout(flush, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [data, workspaceOwnerId, flush]);

  // Local cache for instant start-up on the next visit.
  useEffect(() => {
    if (!user?.id || !workspaceOwnerId || workspaceStatus !== 'ready') return undefined;
    const timer = window.setTimeout(() => {
      storage.set(cacheKey(user.id), JSON.stringify({ ownerId: workspaceOwnerId, role, profile, team, data }));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [user?.id, workspaceOwnerId, workspaceStatus, role, profile, team, data]);

  // ---- Keeping in sync with teammates --------------------------------------------------
  const applyRemote = useCallback(remote => {
    if (!remote?.payload || dirtyRef.current) return;
    if (sameInstant(remote.updatedAt, lastSyncedAtRef.current) || isOlder(remote.updatedAt, lastSyncedAtRef.current)) return;
    lastSyncedAtRef.current = remote.updatedAt;
    setData(normalize(remote.payload));
  }, []);

  const refreshTeam = useCallback(async () => {
    const ownerId = ownerRef.current;
    if (!ownerId) return [];
    const members = await fetchTeamMembers(ownerId);
    setTeam(members);
    return members;
  }, []);

  useEffect(() => {
    if (!workspaceOwnerId || workspaceStatus !== 'ready') return undefined;
    return subscribeToWorkspace(workspaceOwnerId, applyRemote);
  }, [workspaceOwnerId, workspaceStatus, applyRemote]);

  useEffect(() => {
    if (!workspaceOwnerId) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
        return;
      }
      if (dirtyRef.current) {
        flush();
        return;
      }
      if (Date.now() - lastRefreshRef.current < FOCUS_REFRESH_MS) return;
      lastRefreshRef.current = Date.now();
      fetchWorkspace(workspaceOwnerId).then(applyRemote).catch(() => undefined);
      refreshTeam().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [workspaceOwnerId, flush, applyRemote, refreshTeam]);

  // ---- Theme ---------------------------------------------------------------------------
  useEffect(() => {
    storage.set(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // ---- Actions -------------------------------------------------------------------------
  const update = useCallback((key, updater) => {
    if (key === 'team') {
      setTeam(current => (typeof updater === 'function' ? updater(current) : updater));
      return;
    }
    dirtyRef.current = true;
    setSaveState('saving');
    setData(current => {
      const nextValue = typeof updater === 'function' ? updater(current[key]) : updater;
      if (key !== 'leads') return { ...current, [key]: nextValue };
      // Lead changes run timeline logging and workflow automations.
      return { ...current, ...processLeadChange(current, nextValue, actorRef.current) };
    });
  }, []);

  // ---- Web form submissions -> leads ---------------------------------------------------
  const importSubmissions = useCallback(async () => {
    const ownerId = ownerRef.current;
    if (!ownerId) return 0;
    try {
      const rows = await claimFormSubmissions(ownerId);
      if (!rows.length) return 0;
      const incoming = rows.map(submissionToLead).filter(lead => lead.email);
      update('leads', list => {
        const byEmail = new Map(list.map(lead => [lead.email?.toLowerCase(), lead]));
        const fresh = [];
        const repeat = new Map();
        incoming.forEach(lead => {
          const match = byEmail.get(lead.email);
          if (match) repeat.set(match.id, lead);
          else if (!fresh.some(item => item.email === lead.email)) fresh.push(lead);
        });
        const updated = list.map(lead => (repeat.has(lead.id)
          ? { ...lead, timeline: [timelineEntry('form', `Submitted ${repeat.get(lead.id).formName || 'a web form'} again${repeat.get(lead.id).notes ? ` — ${repeat.get(lead.id).notes}` : ''}`, 'Web form'), ...(lead.timeline || [])] }
          : lead));
        return [...fresh, ...updated];
      });
      return incoming.length;
    } catch (error) {
      if (!/does not exist|schema cache|PGRST20/i.test(error?.message || '')) console.error('Unable to import form submissions:', error);
      return 0;
    }
  }, [update]);

  useEffect(() => {
    if (workspaceStatus !== 'ready' || !workspaceOwnerId) return undefined;
    importSubmissions();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') importSubmissions();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [workspaceStatus, workspaceOwnerId, importSubmissions]);

  const signOut = useCallback(async () => {
    await flush();
    if (user?.id) storage.remove(cacheKey(user.id));
    await signOutUser();
  }, [flush, user?.id]);

  const retryLoad = useCallback(() => setReloadKey(key => key + 1), []);

  // ---- Derived data --------------------------------------------------------------------
  const teamWithStats = useMemo(() => team.map(member => {
    const owned = data.leads.filter(lead => lead.owner === member.name);
    return {
      ...member,
      leads: owned.length,
      conversions: owned.filter(lead => lead.status === 'Converted').length
    };
  }), [team, data.leads]);

  const viewData = useMemo(() => ({ ...data, team: teamWithStats }), [data, teamWithStats]);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account';
  actorRef.current = displayName;

  const ownerOptions = useMemo(() => {
    const names = new Set(team.map(member => member.name).filter(Boolean));
    if (!names.size) names.add(displayName);
    return [...names];
  }, [team, displayName]);

  const value = useMemo(() => ({
    data: viewData,
    team: teamWithStats,
    ownerOptions,
    displayName,
    theme,
    setTheme,
    role,
    isOwner: Boolean(user?.id && user.id === workspaceOwnerId),
    profile,
    user,
    workspaceOwnerId,
    authReady,
    workspaceStatus,
    loadError,
    slowLoad,
    retryLoad,
    configError: supabaseConfigError,
    recoveryMode,
    setRecoveryMode,
    profileError,
    cloudError,
    saveState,
    inviteMessage,
    clearInviteMessage: () => setInviteMessage(null),
    globalSearch,
    setGlobalSearch,
    signIn: signInWithPassword,
    signUp: signUpWithPassword,
    signOut,
    update,
    refreshTeam,
    importSubmissions
  }), [
    viewData, teamWithStats, ownerOptions, displayName, theme, role, user, workspaceOwnerId, profile,
    authReady, workspaceStatus, loadError, slowLoad, retryLoad, recoveryMode, profileError, cloudError,
    saveState, inviteMessage, globalSearch, signOut, update, refreshTeam, importSubmissions
  ]);

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

export const useCRM = () => useContext(CRMContext);
