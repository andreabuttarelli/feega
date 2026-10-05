import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export function watchMotionNode(client: SupabaseClient, nodeId: string, onChange: () => void): () => void {
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
      .channel(`motion-node:${nodeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nodes', filter: `id=eq.${nodeId}` }, () => {
        if (!closed) {
          onChange();
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
