import supabase from './supabase';

const TABLE = 'crm_workspace_20260602000000';
let pendingWrite = Promise.resolve();

export async function fetchWorkspace(ownerId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('payload, updated_at')
    .eq('user_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  return data ? { payload: data.payload, updatedAt: data.updated_at } : null;
}

/** Saves are serialized so an older payload can never land after a newer one. */
export function saveWorkspace(ownerId, payload) {
  const write = pendingWrite.catch(() => undefined).then(async () => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: ownerId, payload, updated_at: updatedAt }, { onConflict: 'user_id' });

    if (error) throw error;
    return updatedAt;
  });

  pendingWrite = write;
  return write;
}

/** Live updates from other team members (requires the 000600 migration's realtime step). */
export function subscribeToWorkspace(ownerId, onChange) {
  const channel = supabase
    .channel(`crm-workspace-${ownerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${ownerId}` },
      change => {
        if (change.new?.payload) onChange({ payload: change.new.payload, updatedAt: change.new.updated_at });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
