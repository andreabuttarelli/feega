import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { LiveFeed } from '$lib/canvas/history/live';

export const HISTORY_TABLES = ['canvas_events', 'canvas_versions', 'canvas_conflicts', 'nodes'] as const;

const SUBSCRIBED = 'SUBSCRIBED';

export function watchHistory(client: SupabaseClient, canvasId: string, onChange: () => void, onFeed: (feed: LiveFeed) => void): () => void {
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

    let next = client.channel(`history:${canvasId}`);
    for (const table of HISTORY_TABLES) {
      next = next.on('postgres_changes', { event: '*', schema: 'public', table, filter: `canvas_id=eq.${canvasId}` }, () => {
        if (!closed) {
          onChange();
        }
      });
    }
    channel = next.subscribe((status: string) => {
      if (!closed) {
        onFeed(status === SUBSCRIBED ? LiveFeed.Realtime : LiveFeed.Polling);
      }
    });
  })();

  return () => {
    closed = true;
    if (channel) {
      void client.removeChannel(channel);
    }
  };
}
