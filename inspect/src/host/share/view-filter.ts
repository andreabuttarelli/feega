import { ToView } from '../../messages';

type View = { kind?: string; [key: string]: unknown };

export type Filtered = { text: string | null; appUrl?: string };

const toVisitorApp = (message: View, origin: string): Filtered => ({ text: JSON.stringify({ ...message, url: `${origin}/` }), appUrl: String(message.url) });

const toVisitorServer = (message: View, origin: string): Filtered => {
  const info = message.info as Record<string, unknown> | undefined;
  const bare = info && { ...info, url: `${origin}/`, command: '', pid: null, port: 0, lastError: '' };
  return { text: JSON.stringify({ ...message, info: bare }) };
};

const FILTERS: Partial<Record<string, (message: View, origin: string) => Filtered>> = {
  [ToView.App]: toVisitorApp,
  [ToView.Account]: () => ({ text: null }),
  [ToView.Share]: () => ({ text: null }),
  [ToView.Server]: toVisitorServer
};

export function viewForVisitor(text: string, origin: string): Filtered {
  try {
    const message = JSON.parse(text) as View;
    const filter = message?.kind ? FILTERS[message.kind] : undefined;
    return filter ? filter(message, origin) : { text };
  } catch {
    return { text };
  }
}
