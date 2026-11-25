import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentId, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

function setup(agents?: () => AgentId[]) {
  const views: ViewMessage[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => views.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    notify: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    agents
  } as unknown as Platform;
  inspectSession(platform, mkdtempSync(join(tmpdir(), 'feega-agents-s-')));
  const ready = async () => {
    await handle({ kind: ToHost.Ready });
    await new Promise((r) => setTimeout(r, 20));
  };
  return { ready, found: () => views.filter((m): m is Extract<ViewMessage, { kind: ToView.Agents }> => m.kind === ToView.Agents) };
}

describe('detected agents reach the view', () => {
  it('sends what the platform detects when the view is ready', async () => {
    const t = setup(() => [AgentId.ClaudeCode, AgentId.Gemini]);
    await t.ready();

    expect(t.found().map((m) => m.found)).toEqual([[AgentId.ClaudeCode, AgentId.Gemini]]);
  });

  it('sends an empty list when the platform cannot detect', async () => {
    const t = setup();
    await t.ready();

    expect(t.found().map((m) => m.found)).toEqual([[]]);
  });
});
