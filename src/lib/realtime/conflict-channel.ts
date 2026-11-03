import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

const CHANNEL_PREFIX = 'conflicts';

type ConflictRow = { actor_id: string | null; actor_kind: string; resolution: string | null };

export const REFUSED_NOTICE = 'Someone else changed this at the same time and your edit was refused. Open History to keep yours or theirs.';

export function refusedForUser(row: ConflictRow | undefined, userId: string): boolean {
  return Boolean(row && userId && row.actor_id === userId && row.resolution === null);
}

export function watchRefusals(client: SupabaseClient, canvasId: string, userId: string, onRefused: () => void): () => void {
  let closed = false;
  let channel: RealtimeChannel | null = null;

  void (async () => {
    const { data } = await client.auth.getSession();
    if (closed || !data.session?.access_token) {
      return;
    }
    await client.realtime.setAuth(data.session.access_token);
    if (closed) {
      return;
    }

    channel = client
      .channel(`${CHANNEL_PREFIX}:${canvasId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'canvas_conflicts', filter: `canvas_id=eq.${canvasId}` }, (payload) => {
        if (!closed && refusedForUser(payload.new as ConflictRow, userId)) {
          onRefused();
        }
      })
      .subscribe();
  })();

  return () => {
    closed = true;
    if (channel) {
      void client.removeChannel(channel);
    }
  };
}
