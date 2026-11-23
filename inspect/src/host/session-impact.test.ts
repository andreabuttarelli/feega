import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { Gate, ImpactKind, ToHost, ToView, type EditAsk, type HostMessage, type ViewMessage } from '../messages';
import { SettingKey } from '../settings';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const FIXTURE = join(__dirname, 'impact-fixtures/react');

function setup(settings: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'feega-impact-'));
  cpSync(FIXTURE, root, { recursive: true });
  const sent: ViewMessage[] = [];
  let deliver: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => void sent.push(m),
    receive: (cb: (m: HostMessage) => unknown) => (deliver = cb),
    settings: () => settings,
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore()
  } as unknown as Platform;
  const session = inspectSession(platform, root);
  const text = (file: string) => readFileSync(join(root, file), 'utf8');
  return { session, sent, text, deliver: (m: HostMessage) => deliver(m) };
}

const heroAsk: EditAsk = { at: 'src/components/Hero.tsx:4:10', prop: LiveProp.Color, value: 'blue', css: { color: 'blue' } };
const cardAsk: EditAsk = { at: 'src/components/Card.tsx:4:10', prop: LiveProp.Color, value: 'blue', css: { color: 'blue' } };

describe('impact in the session', () => {
  it('un edit dal impatto ignoto non scrive e mostra il diff', async () => {
    const { session, sent, text } = setup();
    const before = text('src/components/Hero.css');

    await session.edit(heroAsk);

    expect(text('src/components/Hero.css')).toBe(before);
    const preview = sent.find((m) => m.kind === ToView.Preview);
    expect(preview).toMatchObject({ reason: 'the rule lands in a global stylesheet', files: [{ path: 'src/components/Hero.css', removed: ['  color: red;'], added: ['  color: blue;'] }] });
  });

  it('Apply scrive quello che il diff mostrava', async () => {
    const { session, sent, text } = setup();
    await session.edit(heroAsk);

    await session.edit(heroAsk, Gate.Apply);

    expect(text('src/components/Hero.css')).toContain('color: blue;');
    expect(sent.some((m) => m.kind === ToView.Edited && m.ok)).toBe(true);
  });

  it('un edit locale scrive subito, senza anteprima', async () => {
    const { session, sent, text } = setup();

    await session.edit(cardAsk);
    

    expect(text('src/components/Card.module.css')).toContain('color: blue');
    expect(sent.some((m) => m.kind === ToView.Preview)).toBe(false);
  });

  it('un edit del componente condiviso scrive subito', async () => {
    const { session, sent } = setup();

    await session.edit({ ...cardAsk, at: 'src/components/Button.tsx:4:10' });

    expect(sent.some((m) => m.kind === ToView.Preview)).toBe(false);
    expect(sent.some((m) => m.kind === ToView.Edited && m.ok)).toBe(true);
  });

  it('con l anteprima spenta scrive anche l ignoto', async () => {
    const { session, sent, text } = setup({ [SettingKey.PreviewUnknown]: false });

    await session.edit(heroAsk);

    expect(text('src/components/Hero.css')).toContain('color: blue;');
    expect(sent.some((m) => m.kind === ToView.Preview)).toBe(false);
  });

  it('una domanda di impatto risponde con il tipo del bersaglio', async () => {
    const { sent, deliver } = setup();

    await deliver({ kind: ToHost.Impact, id: 7, ask: { at: 'src/components/Button.tsx:4:10' } });

    const answer = sent.find((m) => m.kind === ToView.Impact);
    expect(answer).toMatchObject({ id: 7, impact: { kind: ImpactKind.Component, name: 'Button' } });
  });
});
