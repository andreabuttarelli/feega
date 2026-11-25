import { describe, expect, it } from 'vitest';
import { AlertKind, type Alert } from '../host/ai/agent-alert';
import { pageAlerts, type Bridge, type NotificationLike } from './alerts';

const alert: Alert = { kind: AlertKind.Finished, chat: 'chat-1', text: 'Claude Code finished in shop' };
const ask: Alert = { kind: AlertKind.Permission, chat: 'chat-1', text: 'Claude Code needs permission to edit a file' };

function setup({ permission = 'granted' as NotificationPermission, looking = false, bridge }: { permission?: NotificationPermission; looking?: boolean; bridge?: Bridge } = {}) {
  const made: (NotificationLike & { title: string; body: string; closed: boolean })[] = [];
  const opened: string[] = [];
  const log = { requests: 0, focused: 0 };
  let current = permission;
  const surface = pageAlerts({
    bridge,
    permission: () => current,
    request: async () => (log.requests++, (current = 'granted')),
    create: (title, options) => {
      const note = { title, body: options.body, onclick: null as (() => void) | null, closed: false, close: () => void (note.closed = true) };
      made.push(note);
      return note;
    },
    looking: () => looking,
    focus: () => void log.focused++,
    open: (chat) => void opened.push(chat)
  });
  return { surface, made, opened, log };
}

describe('alerts in a browser tab', () => {
  it('shows a notification with the text and nothing else', async () => {
    const t = setup();

    await t.surface.show(alert);

    expect(t.made.map((n) => [n.title, n.body])).toEqual([['Feega', 'Claude Code finished in shop']]);
  });

  it('asks for permission the first time only', async () => {
    const t = setup({ permission: 'default' });

    await t.surface.show(alert);
    await t.surface.show(alert);

    expect(t.log.requests).toBe(1);
    expect(t.made).toHaveLength(2);
  });

  it('shows nothing when the user denied notifications', async () => {
    const t = setup({ permission: 'denied' });

    await t.surface.show(alert);

    expect(t.made).toEqual([]);
    expect(t.log.requests).toBe(0);
  });

  it('shows nothing while the tab is in view', async () => {
    const t = setup({ looking: true });

    await t.surface.show(alert);

    expect(t.made).toEqual([]);
  });

  it('focuses the tab and opens the chat on click', async () => {
    const t = setup();
    await t.surface.show(alert);

    t.made[0].onclick?.();

    expect(t.log.focused).toBe(1);
    expect(t.opened).toEqual(['chat-1']);
  });

  it('closes a permission notification once the chat is answered', async () => {
    const t = setup();
    await t.surface.show(ask);
    await t.surface.show(alert);

    t.surface.clear('chat-1');

    expect(t.made.map((n) => n.closed)).toEqual([true, false]);
  });
});

describe('alerts in the desktop app', () => {
  const bridge = () => {
    const shown: Alert[] = [];
    const cleared: string[] = [];
    let open: (chat: string) => void = () => undefined;
    const value: Bridge = { show: async (a) => void shown.push(a), clear: (chat) => void cleared.push(chat), onOpen: (handle) => (open = handle) };
    return { value, shown, cleared, click: (chat: string) => open(chat) };
  };

  it('hands the alert to the app, which decides if the user is away', async () => {
    const b = bridge();
    const t = setup({ bridge: b.value, looking: true });

    await t.surface.show(ask);
    t.surface.clear('chat-1');

    expect(b.shown).toEqual([ask]);
    expect(b.cleared).toEqual(['chat-1']);
    expect(t.made).toEqual([]);
  });

  it('opens the chat when the app reports a click', async () => {
    const b = bridge();
    const t = setup({ bridge: b.value });

    b.click('chat-9');

    expect(t.opened).toEqual(['chat-9']);
  });
});
