import { AlertKind, type Alert } from '../../../inspect/src/host/ai/agent-alert';

export type Handle = { close: () => void };

export type AlertHost = {
  focused: () => boolean;
  active: () => string | null;
  reveal: (tab: string) => void;
  openChat: (tab: string, chat: string) => void;
  notify: (text: string, click: () => void) => Handle;
  badge: (count: number) => void;
};

export function desktopAlerts(host: AlertHost) {
  const pending = new Map<string, Handle>();

  const keyOf = (tab: string, chat: string) => `${tab}:${chat}`;

  const looking = (tab: string) => host.focused() && host.active() === tab;

  const drop = (key: string) => {
    pending.get(key)?.close();
    if (pending.delete(key)) {
      host.badge(pending.size);
    }
  };

  return {
    show: (tab: string, alert: Alert) => {
      if (looking(tab)) {
        return;
      }
      const handle = host.notify(alert.text, () => (host.reveal(tab), host.openChat(tab, alert.chat)));
      if (alert.kind === AlertKind.Permission) {
        pending.set(keyOf(tab, alert.chat), handle);
        host.badge(pending.size);
      }
    },
    clear: (tab: string, chat: string) => drop(keyOf(tab, chat)),
    closed: (tab: string) => [...pending.keys()].filter((key) => key.startsWith(`${tab}:`)).forEach(drop)
  };
}
