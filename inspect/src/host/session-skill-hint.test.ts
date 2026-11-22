import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryOnboardingStore } from './onboarding';
import { Stored, type Platform } from './platform';
import { inspectSession } from './session';
import { HintSurface, SKILL_COMMAND, nodeHintFs } from './skill-hint';

const hintsIn = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.SkillHint);

function setup(surface: HintSurface) {
  const root = mkdtempSync(join(tmpdir(), 'feega-hint-'));
  writeFileSync(join(root, 'AGENTS.md'), '');
  mkdirSync(join(root, 'home'));
  const sent: ViewMessage[] = [];
  const stored = new Map<string, unknown>();
  let never = false;
  let handle: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: (key: string) => stored.get(key),
    store: async (key: string, value: unknown) => void stored.set(key, value),
    log: () => undefined,
    notify: () => undefined,
    warn: async () => false,
    account: { read: async () => null },
    onboarding: memoryOnboardingStore(),
    skillHint: { fs: nodeHintFs, home: join(root, 'home'), surface, never: () => never, setNever: async () => void (never = true) }
  } as unknown as Platform;
  inspectSession(platform, root);
  const send = async (m: HostMessage) => {
    await handle(m);
    await new Promise((r) => setTimeout(r, 20));
  };
  return { sent, stored, send, isNever: () => never };
}

describe('skill hint nella sessione', () => {
  it('al ready mostra il suggerimento in un progetto con agente e senza skill', async () => {
    const t = setup(HintSurface.Panel);
    await t.send({ kind: ToHost.Ready });
    expect(hintsIn(t.sent)).toEqual([{ kind: ToView.SkillHint, command: SKILL_COMMAND }]);
  });

  it('non lo mostra nel terminale, che stampa la sua riga', async () => {
    const t = setup(HintSurface.Terminal);
    await t.send({ kind: ToHost.Ready });
    expect(hintsIn(t.sent)).toEqual([]);
  });

  it('dopo il dismiss non torna per il progetto', async () => {
    const t = setup(HintSurface.Panel);
    await t.send({ kind: ToHost.SkillHintDismiss });
    await t.send({ kind: ToHost.Ready });
    expect(t.stored.get(Stored.SkillHint)).toBe(true);
    expect(hintsIn(t.sent)).toEqual([]);
  });

  it('never lo spegne anche a livello globale', async () => {
    const t = setup(HintSurface.Panel);
    await t.send({ kind: ToHost.SkillHintNever });
    expect(t.isNever()).toBe(true);
    await t.send({ kind: ToHost.Ready });
    expect(hintsIn(t.sent)).toEqual([]);
  });
});
