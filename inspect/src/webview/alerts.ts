import { AlertKind, type Alert } from '../host/ai/agent-alert';

export type NotificationLike = { onclick: (() => void) | null; close: () => void };

export type Bridge = { show: (alert: Alert) => Promise<void>; clear: (chat: string) => void; onOpen: (handle: (chat: string) => void) => void };

export type PageAlertsDeps = {
  bridge?: Bridge;
  permission: () => NotificationPermission;
  request: () => Promise<NotificationPermission>;
  create: (title: string, options: { body: string; tag: string }) => NotificationLike;
  looking: () => boolean;
  focus: () => void;
  open: (chat: string) => void;
};

const TITLE = 'Feega';

export function pageAlerts({ bridge, permission, request, create, looking, focus, open }: PageAlertsDeps) {
  const pending = new Map<string, NotificationLike>();

  bridge?.onOpen(open);

  const allowed = async () => (permission() === 'default' ? (await request()) === 'granted' : permission() === 'granted');

  const showHere = async (alert: Alert) => {
    if (looking() || !(await allowed())) {
      return;
    }
    const note = create(TITLE, { body: alert.text, tag: `${alert.kind}-${alert.chat}` });
    note.onclick = () => (focus(), open(alert.chat));
    if (alert.kind === AlertKind.Permission) {
      pending.set(alert.chat, note);
    }
  };

  return {
    show: (alert: Alert) => (bridge ? bridge.show(alert) : showHere(alert)),
    clear: (chat: string) => {
      if (bridge) {
        bridge.clear(chat);
        return;
      }
      pending.get(chat)?.close();
      pending.delete(chat);
    }
  };
}

export const browserAlerts = (open: (chat: string) => void, bridge?: Bridge) =>
  pageAlerts({
    bridge,
    permission: () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
    request: () => Notification.requestPermission(),
    create: (title, options) => new Notification(title, options),
    looking: () => document.visibilityState === 'visible' && document.hasFocus(),
    focus: () => window.focus(),
    open
  });

export const desktopBridge = (): Bridge | undefined => (window as { feegaDesktop?: Bridge }).feegaDesktop;
