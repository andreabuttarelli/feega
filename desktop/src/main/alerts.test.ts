import { describe, expect, it } from 'vitest';
import { AlertKind, type Alert } from '../../../inspect/src/host/ai/agent-alert';
import { desktopAlerts, type AlertHost } from './alerts';

const finished: Alert = { kind: AlertKind.Finished, chat: 'c1', text: 'Claude Code finished in shop' };
const asking: Alert = { kind: AlertKind.Permission, chat: 'c1', text: 'Claude Code needs permission to edit a file' };

function setup({ focused = false, active = 'tab-1' as string | null } = {}) {
  const state = { focused, active };
  const notes: { text: string; click: () => void; closed: boolean }[] = [];
  const badges: number[] = [];
  const opened: [string, string][] = [];
  const host: AlertHost = {
    focused: () => state.focused,
    active: () => state.active,
    reveal: (tab) => void (state.active = tab),
    openChat: (tab, chat) => void opened.push([tab, chat]),
    notify: (text, click) => {
      const note = { text, click, closed: false };
      notes.push(note);
      return { close: () => void (note.closed = true) };
    },
    badge: (count) => void badges.push(count)
  };
  return { alerts: desktopAlerts(host), state, notes, badges, opened };
}

describe('desktop alerts', () => {
  it('notifies natively when the window is not focused', () => {
    const t = setup();

    t.alerts.show('tab-1', finished);

    expect(t.notes.map((n) => n.text)).toEqual([finished.text]);
  });

  it('notifies when another tab is active', () => {
    const t = setup({ focused: true, active: 'tab-2' });

    t.alerts.show('tab-1', finished);

    expect(t.notes).toHaveLength(1);
  });

  it('stays quiet while the user looks at that tab', () => {
    const t = setup({ focused: true });

    t.alerts.show('tab-1', asking);

    expect(t.notes).toEqual([]);
    expect(t.badges).toEqual([]);
  });

  it('badges the dock while a permission is pending and clears it when answered', () => {
    const t = setup();

    t.alerts.show('tab-1', asking);
    t.alerts.clear('tab-1', 'c1');

    expect(t.badges).toEqual([1, 0]);
    expect(t.notes[0].closed).toBe(true);
  });

  it('does not badge a finished turn', () => {
    const t = setup();

    t.alerts.show('tab-1', finished);

    expect(t.badges).toEqual([]);
  });

  it('counts pending permissions across tabs and drops a closed tab', () => {
    const t = setup();

    t.alerts.show('tab-1', asking);
    t.alerts.show('tab-2', asking);
    t.alerts.closed('tab-1');

    expect(t.badges).toEqual([1, 2, 1]);
  });

  it('focuses the tab and opens the chat on click', () => {
    const t = setup();
    t.alerts.show('tab-3', finished);

    t.notes[0].click();

    expect(t.state.active).toBe('tab-3');
    expect(t.opened).toEqual([['tab-3', 'c1']]);
  });
});
