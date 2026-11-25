import { describe, expect, it } from 'vitest';
import { SETTINGS, SettingKey, settingsWith } from '../../settings';
import { AgentEventKind, ToolStatus, type AgentEvent } from './agent-session';
import { AlertKind, alertOf, alerts, type Alert, type AlertPort } from './agent-alert';

const subject = { agent: 'Claude Code', project: 'shop', chat: 'chat-1' };

const permission = (kind: string): AgentEvent => ({ kind: AgentEventKind.Permission, id: '1', options: [], tool: { id: 't', title: 'rm -rf secrets', kind, status: ToolStatus.Pending, diffs: [] } });

const done = (reason: string): AgentEvent => ({ kind: AgentEventKind.Done, reason });

describe('the alert an agent event raises', () => {
  it('says the agent finished in the project', () => {
    expect(alertOf(done('end_turn'), subject)).toEqual({ kind: AlertKind.Finished, chat: 'chat-1', text: 'Claude Code finished in shop' });
  });

  it('says what a permission is for, from the tool kind', () => {
    expect(alertOf(permission('execute'), subject)?.text).toBe('Claude Code needs permission to run a command');
    expect(alertOf(permission('edit'), subject)?.text).toBe('Claude Code needs permission to edit a file');
    expect(alertOf(permission('something-new'), subject)?.text).toBe('Claude Code needs permission to continue');
  });

  it('never carries the tool title or the reply', () => {
    const text = alertOf(permission('execute'), subject)!.text;

    expect(text).not.toContain('rm -rf');
    expect(alertOf({ kind: AgentEventKind.Text, text: 'secret' }, subject)).toBeNull();
  });

  it('stays quiet when the user cancelled the turn', () => {
    expect(alertOf(done('cancelled'), subject)).toBeNull();
  });

  it('reports a refusal and an error without their reasons', () => {
    expect(alertOf(done('refusal'), subject)?.text).toBe('Claude Code was refused in shop');
    expect(alertOf({ kind: AgentEventKind.Failed, reason: 'token sk-123 rejected' }, subject)?.text).toBe('Claude Code stopped with an error in shop');
  });
});

const setup = (values: Partial<Record<SettingKey, boolean>> = {}, looking?: boolean) => {
  const shown: Alert[] = [];
  const cleared: string[] = [];
  const opened: string[] = [];
  const port: AlertPort = { looking: looking === undefined ? undefined : () => looking, show: async (alert) => (shown.push(alert), true), clear: (chat) => void cleared.push(chat) };
  const settings = () => ({ ...settingsWith(() => undefined), ...values });
  const hub = alerts({ port, settings, opened: (chat) => void opened.push(chat) });
  return { hub, shown, cleared, opened };
};

const finished: Alert = { kind: AlertKind.Finished, chat: 'chat-1', text: 'x' };

describe('when an alert is shown', () => {
  it('is on by default for both kinds', () => {
    expect(SETTINGS.find((r) => r.key === SettingKey.Notifications)?.fallback).toBe(true);
    expect(SETTINGS.find((r) => r.key === SettingKey.NotifyFinished)?.fallback).toBe(true);
    expect(SETTINGS.find((r) => r.key === SettingKey.NotifyPermission)?.fallback).toBe(true);
  });

  it('shows when the user is away', async () => {
    const t = setup({}, false);

    await t.hub.raise(finished);

    expect(t.shown).toEqual([finished]);
  });

  it('does not show when the user is looking', async () => {
    const t = setup({}, true);

    await t.hub.raise(finished);

    expect(t.shown).toEqual([]);
  });

  it('leaves looking to the surface when the platform cannot tell', async () => {
    const t = setup();

    await t.hub.raise(finished);

    expect(t.shown).toEqual([finished]);
  });

  it('respects each toggle and the master switch', async () => {
    const t = setup({ [SettingKey.NotifyFinished]: false });
    await t.hub.raise(finished);
    await t.hub.raise({ ...finished, kind: AlertKind.Permission });
    expect(t.shown.map((a) => a.kind)).toEqual([AlertKind.Permission]);

    const off = setup({ [SettingKey.Notifications]: false });
    await off.hub.raise(finished);
    await off.hub.raise({ ...finished, kind: AlertKind.Permission });
    expect(off.shown).toEqual([]);
  });

  it('opens the chat when the user acts on the alert', async () => {
    const t = setup();

    await t.hub.raise(finished);

    expect(t.opened).toEqual(['chat-1']);
  });

  it('clears what the chat had pending', () => {
    const t = setup();

    t.hub.clear('chat-1');

    expect(t.cleared).toEqual(['chat-1']);
  });

  it('does nothing on a platform without a port', async () => {
    const hub = alerts({ port: undefined, settings: () => settingsWith(() => undefined), opened: () => undefined });

    await expect(hub.raise(finished)).resolves.toBeUndefined();
    expect(() => hub.clear('chat-1')).not.toThrow();
  });
});
