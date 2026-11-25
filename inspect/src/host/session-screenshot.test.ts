import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localTools } from '../../../npx/src/mcp/local-tools';
import { Picture } from '../../../npx/src/mcp/tools';
import { AgentAsk, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { editorRegistry } from './local-bridge/editors';
import { publishLocalTo } from './local-bridge/publish';
import type { Platform } from './platform';
import { inspectSession } from './session';

const PNG = 'iVBORw0KGgo=';

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'feega-shot-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), '{}');
  const registry = editorRegistry({ dir: mkdtempSync(join(tmpdir(), 'feega-reg-')), alive: () => true });
  const sent: ViewMessage[] = [];
  let handle: (message: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (message: ViewMessage) => void sent.push(message),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    localBridge: publishLocalTo(registry)
  } as unknown as Platform;
  const session = inspectSession(platform, dir);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const tools = localTools({ registry, send: fetch, cwd: dir });
  const asked = () => sent.flatMap((m) => (m.kind === ToView.AgentAsk ? [m] : []));
  const eventually = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  return { session, tools, asked, send: handle, eventually };
}

describe('what the agent sees through the tools', () => {
  it('feega_screenshot reaches the panel and comes back as the picture it drew', async () => {
    const { session, tools, asked, send, eventually } = await setup();

    const picture = tools.feega_screenshot.run({});
    await eventually(() => asked().length === 1);
    expect(asked()[0]).toMatchObject({ ask: AgentAsk.Screenshot, selection: false });
    send({ kind: ToHost.AgentAnswer, id: asked()[0].id, png: PNG, text: null });

    expect(await picture).toEqual(new Picture(PNG));
    await session.stop();
  });

  it('feega_screenshot asks for the selection crop when the agent wants it', async () => {
    const { session, tools, asked, send, eventually } = await setup();

    const picture = tools.feega_screenshot.run({ selection: true });
    await eventually(() => asked().length === 1);
    expect(asked()[0]).toMatchObject({ selection: true });
    send({ kind: ToHost.AgentAnswer, id: asked()[0].id, png: PNG, text: null });
    await picture;

    await session.stop();
  });

  it('feega_context returns the block the panel shows in the composer', async () => {
    const { session, tools, asked, send, eventually } = await setup();

    const context = tools.feega_context.run({});
    await eventually(() => asked().length === 1);
    expect(asked()[0].ask).toBe(AgentAsk.Context);
    send({ kind: ToHost.AgentAnswer, id: asked()[0].id, png: null, text: 'Feega page\npage: /pricing' });

    expect(await context).toEqual({ context: 'Feega page\npage: /pricing' });
    await session.stop();
  });

  it('feega_screenshot fails clearly when the panel could not draw the tab', async () => {
    const { session, tools, asked, send, eventually } = await setup();

    const picture = tools.feega_screenshot.run({});
    await eventually(() => asked().length === 1);
    send({ kind: ToHost.AgentAnswer, id: asked()[0].id, png: null, text: null });

    await expect(picture).rejects.toThrow('Feega could not capture the tab');
    await session.stop();
  });
});
