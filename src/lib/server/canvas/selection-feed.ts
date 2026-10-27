import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '$lib/server/db/connect';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { CANVAS_PEER_EVENT } from '$lib/realtime/canvas-presence';
import type { MarkFeed } from './selection-read';

const FEED_USE_PATH = 'src/lib/server/canvas/selection-feed.ts';

export const channelFeed: MarkFeed = async (canvasId, on) => {
  const use = SERVICE_ROLE_USES.find((u) => u.path.startsWith(FEED_USE_PATH));
  if (!use || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('selection feed not configured');
  }

  const client = createClient(publicEnv.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.realtime.setAuth(env.SUPABASE_SERVICE_ROLE_KEY);

  const channel = client.channel(`canvas:${canvasId}`, { config: { private: true } });
  channel.on('broadcast', { event: CANVAS_PEER_EVENT }, (message) => on(message.payload));
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reject(new Error(status));
      }
    });
  });

  return () => void client.removeChannel(channel);
};
