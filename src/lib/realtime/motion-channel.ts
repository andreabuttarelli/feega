import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { ChannelStatus, createLink, type LinkPort } from './connection-link';
import { browserEnvironment } from './canvas-channel';

export type NodeRow = { data?: { docHeadRevision?: unknown } };

export function headMoved(row: NodeRow, version: number): boolean {
  const head = Number(row.data?.docHeadRevision);
  return !Number.isInteger(head) || head > version;
}

export type MotionWatch = {
  onChange: (row: NodeRow) => void;
  onResync: () => void;
  environment?: Pick<LinkPort, 'online' | 'random' | 'schedule'>;
  listen?: (wake: () => void) => () => void;
};

const listenToTab = (wake: () => void): (() => void) => {
  const visible = () => {
    if (document.visibilityState === 'visible') {
      wake();
    }
  };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  return () => {
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('focus', wake);
    window.removeEventListener('online', wake);
  };
};

export function watchMotionNode(client: SupabaseClient, nodeId: string, watch: MotionWatch): () => void {
  const environment = watch.environment ?? browserEnvironment;
  let closed = false;
  let channel: RealtimeChannel | null = null;
  let firstJoin = true;

  const link = createLink({
    ...environment,
    open: () => {
      void join().catch(() => link.channel(ChannelStatus.Error));
    },
    close: leave,
    resync: () => {
      if (!firstJoin) {
        watch.onResync();
      }
      firstJoin = false;
    },
    onState: () => {}
  });

  async function join(): Promise<void> {
    const { data } = await client.auth.getSession();
    if (closed || !data.session?.access_token) {
      return;
    }
    await client.realtime.setAuth(data.session.access_token);
    if (closed) {
      return;
    }

    leave();
    const joined = client.channel(`motion-node:${nodeId}`);
    channel = joined;
    joined
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nodes', filter: `id=eq.${nodeId}` }, (payload) => {
        if (!closed) {
          watch.onChange(payload.new as NodeRow);
        }
      })
      .subscribe((raw) => {
        if (!closed && joined === channel) {
          link.channel(String(raw) as ChannelStatus);
        }
      });
  }

  function leave() {
    const dead = channel;
    channel = null;
    if (dead) {
      void client.removeChannel(dead);
    }
  }

  const unlisten = (watch.listen ?? listenToTab)(() => {
    link.online();
    watch.onResync();
  });
  link.start();

  return () => {
    closed = true;
    link.stop();
    unlisten();
    leave();
  };
}
