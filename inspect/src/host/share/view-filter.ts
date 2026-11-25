import type { VisitorInfo } from '../../../../packages/share-protocol/src/frame';
import { ToView } from '../../messages';

type View = { kind?: string; [key: string]: unknown };

export type Filtered = { text: string | null; appUrl?: string };

const toVisitorApp = (message: View, origin: string): Filtered => ({ text: JSON.stringify({ ...message, url: `${origin}/` }), appUrl: String(message.url) });

const toVisitorServer = (message: View, origin: string): Filtered => {
  const info = message.info as Record<string, unknown> | undefined;
  const bare = info && { ...info, url: `${origin}/`, command: '', pid: null, port: 0, lastError: '' };
  return { text: JSON.stringify({ ...message, info: bare }) };
};

const WAITING_FOR_HOST = 'Waiting for the host to approve this change';

const toAuthor = (message: View, _origin: string, visitor: VisitorInfo): Filtered => {
  const by = message.by as { userId?: string } | undefined;
  return { text: by?.userId === visitor.userId ? JSON.stringify({ kind: ToView.Status, text: WAITING_FOR_HOST }) : null };
};

const toOthers = (message: View, _origin: string, visitor: VisitorInfo): Filtered => {
  const peers = (message.peers as { userId: string }[]).filter((peer) => peer.userId !== visitor.userId);
  return { text: JSON.stringify({ ...message, peers }) };
};

const FILTERS: Partial<Record<string, (message: View, origin: string, visitor: VisitorInfo) => Filtered>> = {
  [ToView.App]: toVisitorApp,
  [ToView.Account]: () => ({ text: null }),
  [ToView.Share]: () => ({ text: null }),
  [ToView.Server]: toVisitorServer,
  [ToView.Preview]: toAuthor,
  [ToView.Peers]: toOthers
};

export function viewForVisitor(text: string, origin: string, visitor: VisitorInfo): Filtered {
  try {
    const message = JSON.parse(text) as View;
    const filter = message?.kind ? FILTERS[message.kind] : undefined;
    return filter ? filter(message, origin, visitor) : { text };
  } catch {
    return { text };
  }
}
