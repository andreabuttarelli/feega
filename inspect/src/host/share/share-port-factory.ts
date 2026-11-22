import type { Present } from '../../../../packages/share-protocol/src/frame';
import type { CommentsCloud } from '../comments';
import type { Ended } from './client';
import { shareHost, type ShareApi, type ShareControl } from './share-host';

export type ShareHooks = { onPresence: (visitors: Present[]) => void; onEnded: (why: Ended) => void };

export type SharePort = { editorUrl: () => Promise<string | null>; control: (hooks: ShareHooks) => ShareControl };

export type CloudShareDeps = {
  api: ShareApi & CommentsCloud['api'];
  relayUrl: string;
  send: typeof fetch;
  editorUrl: () => Promise<string | null>;
};

export function cloudShare({ api, relayUrl, send, editorUrl }: CloudShareDeps): { share: SharePort; cloud: CommentsCloud } {
  let active: string | null = null;

  const control = (hooks: ShareHooks): ShareControl => {
    const inner = shareHost({
      api,
      relayUrl,
      send,
      onPresence: (_id, visitors) => hooks.onPresence(visitors),
      onEnded: (_id, why) => ((active = null), hooks.onEnded(why))
    });
    return {
      start: async (request) => {
        const info = await inner.start(request);
        active = info.id;
        return info;
      },
      stop: async (id) => {
        active = null;
        await inner.stop(id);
      },
      kick: inner.kick,
      setRole: inner.setRole
    };
  };

  return { share: { editorUrl, control }, cloud: { api, sessionId: () => active } };
}
