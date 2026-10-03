import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export function watchBatch(client: SupabaseClient, batchId: string, onChange: () => void): () => void {
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
      .channel(`studio-batch:${batchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_batch_items', filter: `batch_id=eq.${batchId}` }, () => {
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
