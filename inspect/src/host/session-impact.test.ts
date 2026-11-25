import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  const watchers: (() => void)[] = [];
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
    onboarding: memoryOnboardingStore(),
    watchFiles: (_root: string, changed: () => void) => {
      watchers.push(changed);
      return { dispose: () => undefined };
    }
  } as unknown as Platform;
  const session = inspectSession(platform, root);
  const text = (file: string) => readFileSync(join(root, file), 'utf8');
  const write = (file: string, content: string) => writeFileSync(join(root, file), content);
  return { session, sent, text, write, changed: () => watchers.forEach((w) => w()), deliver: (m: HostMessage) => deliver(m) };
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

  it('un file creato fuori dall editor cambia la risposta subito, senza aspettare', async () => {
    const { sent, deliver, write, changed } = setup();
    const ask = { kind: ToHost.Impact, id: 1, ask: { at: 'src/components/Card.tsx:4:10' } } as const;
    await deliver(ask);

    write('src/pages/Team.tsx', "import { Card } from '../components/Card';\n\nexport const team = Card;\n");
    changed();
    await deliver({ ...ask, id: 2 });

    const answers = sent.filter((m) => m.kind === ToView.Impact);
    expect(answers[0]).toMatchObject({ id: 1, impact: { kind: ImpactKind.Local } });
    expect(answers[1]).toMatchObject({ id: 2, impact: { kind: ImpactKind.Component, name: 'Card' } });
  });
});
