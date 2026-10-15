import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type NodeRow = { data?: { docHeadRevision?: unknown } };

export function headMoved(row: NodeRow, version: number): boolean {
  const head = Number(row.data?.docHeadRevision);
  return !Number.isInteger(head) || head > version;
}

export function watchMotionNode(client: SupabaseClient, nodeId: string, onChange: (row: NodeRow) => void): () => void {
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nodes', filter: `id=eq.${nodeId}` }, (payload) => {
        if (!closed) {
          onChange(payload.new as NodeRow);
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
