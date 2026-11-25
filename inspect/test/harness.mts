import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { fileEdits, type ManyAsk } from '../src/host/file-edits.ts';
import { stylingOf } from '../src/host/styling.ts';
import { Attach, startDev } from '../src/host/dev-server.ts';
import { ServerState, ToHost, ToView, type EditAsk, type Pick, type PluginAsk } from '../src/messages.ts';
import { pluginCalls } from '../src/host/plugin-calls.ts';
import { RestartWatch } from '../src/host/restart-watch.ts';
import { shownFor, watchServer } from '../src/host/server-watch.ts';
import { inside, liveAtOf, reader } from '@feega/live-edit/live-ask';
import { readProps } from '@feega/live-edit/read-props';
import { diffOf } from '../src/host/diff-preview.ts';
import { Gate, type ApplyAsk, type ReadAsk } from '../src/messages.ts';
import { classIndex, classesAt, classOf } from '../src/host/classes.ts';
import { classImpactOf } from '../src/host/impact.ts';
import { SETTINGS } from '../src/settings.ts';
import { searchIcons } from '../src/host/icon-search.ts';
import { previewQueue } from '../src/host/icon-previews.ts';
import { breakpointsOf } from '../src/host/breakpoints.ts';
import { themesOf } from '../src/host/themes.ts';
import { commentsHost, type CommentsCloud } from '../src/host/comments.ts';
import type { CommentDraft } from '../src/host/cloud-api.ts';
import { entriesOf, insertAskOf } from '../src/host/library.ts';
import { buildCatalog } from '../../packages/library/src/catalog.ts';
import type { AddPlace } from '@feega/live-edit/add-node';
import type { AcpId } from '../src/host/ai/acp-agents.ts';
import { randomUUID } from 'node:crypto';
import { aiChat, type ChatRecord } from '../src/host/ai/ai-chat.ts';
import { Policy } from '../src/host/ai/permission-policy.ts';
import type { AgentEnv } from '../src/host/agents.ts';
import type { OpenAgent } from '../src/host/ai/agent-session.ts';

const catalog = buildCatalog(fileURLToPath(new URL('../../packages/library/items', import.meta.url)), fileURLToPath(new URL('../../packages/library/tokens.css', import.meta.url)));
const PANEL_PORT = Number(process.env.PANEL_PORT ?? 5999);
const dist = fileURLToPath(new URL('../dist/webview/', import.meta.url));
const launcher = fileURLToPath(new URL('../dist/launcher/', import.meta.url));

const pageHtml = (theme: string) => `<!doctype html><html><head><meta charset="utf-8"><style>body{padding:0 20px}</style><link rel="stylesheet" href="/panel.css">
<style>${theme}</style>
<script>window.acquireVsCodeApi = () => ({ postMessage: (m) => window.toHost(m) });</script>
</head><body class="vscode-dark"><div id="app"></div><script src="/panel.js"></script></body></html>`;

export const DARK = ':root{--vscode-editor-background:#1f1f1f;--vscode-foreground:#cccccc;--vscode-sideBar-background:#181818;--vscode-focusBorder:#0078d4;--vscode-font-family:-apple-system,system-ui,sans-serif}';
export const LIGHT = ':root{--vscode-editor-background:#ffffff;--vscode-foreground:#1f1f1f;--vscode-sideBar-background:#f8f8f8;--vscode-focusBorder:#0078d4;--vscode-font-family:-apple-system,system-ui,sans-serif}';

export type AiOverride = { env: () => AgentEnv; open: OpenAgent };

export async function openPanel(appRoot: string, theme = DARK, cloud?: CommentsCloud, aiOverride?: AiOverride) {
  const running = await startDev(appRoot, launcher, { log: () => undefined, installing: () => undefined, spawned: () => undefined, signal: new AbortController().signal }, '', Attach.Never);
  if ('refused' in running) {
    throw new Error(running.refused);
  }
  const edits = fileEdits(appRoot);
  const classes = classIndex(appRoot, {});
  const styling = await stylingOf(appRoot);

  const server = createServer(async (req, res) => {
    const name = (req.url ?? '/').slice(1).replace(/\?.*$/, '');
    if (!name || name === 'light') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(pageHtml(name === 'light' ? LIGHT : theme));
      return;
    }
    res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }).end(await readFile(join(dist, name)));
  }).listen(PANEL_PORT);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  if (process.env.PROBE) {
    page.on('console', (m) => console.log('console', m.text().slice(0, 800)));
    page.on('pageerror', (e) => console.log('pageerror', e.message));
  }
  const reply = (m: unknown) => page.evaluate((msg) => window.postMessage(msg, '*'), m);
  let closed = false;
  void watchServer({ started: running, restarts: new RestartWatch(), current: () => !closed, act: (step) => shownFor(step, undefined, '').forEach(reply) });
  const picks = new Map<number, (p: Pick | null) => void>();
  const saves: unknown[] = [];
  const copied: string[] = [];
  const comments = commentsHost(cloud, reply);
  const history = () => reply({ kind: ToView.History, changes: edits.history(), canUndo: edits.canUndo(), canRedo: edits.canRedo() });
  const runPlugin = pluginCalls({
    root: appRoot,
    appDir: () => '',
    fetch,
    propose: async (proposal, appDir) => {
      const out = await edits.proposal(proposal, appDir);
      await history();
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: '' } : { kind: ToView.Edited, ok: false, reason: out.reason });
      return out;
    }
  });
  let aiPolicy = Policy.Ask;
  let aiStored: ChatRecord[] = [];
  const installedAdapters = new Set<string>();
  const ai = aiOverride
    ? aiChat({
        ...aiOverride,
        root: () => appRoot,
        confirm: async () => true,
        where: () => `project: ${appRoot}`,
        adapters: { ready: (id) => installedAdapters.has(id), install: async (id) => void installedAdapters.add(id), launch: () => ({ command: process.execPath, args: [] }) },
        post: reply,
        policy: { get: () => aiPolicy, set: (next) => (aiPolicy = next) },
        store: { load: () => aiStored, save: (records) => void (aiStored = records) },
        now: Date.now,
        newId: randomUUID,
        created: () => undefined,
        configured: () => undefined,
        write: async (path, content, agent) => {
          await edits.agentWrite(path, content, agent);
          await history();
        }
      })
    : null;
  const previewIcons = previewQueue(fetch, (name, svg) => reply({ kind: ToView.IconPreview, name, svg }));

  await page.exposeFunction('toHost', async (m: { kind: ToHost; from?: string; to?: string; google?: boolean; family?: string; ask?: EditAsk; id?: number | string; pick?: Pick | null; query?: string; names?: string[]; text?: string; draft?: CommentDraft; at?: string; place?: string }) => {
    if (m.kind === ToHost.Ready) {
      await reply({ kind: ToView.App, url: running.url, styling, prefs: null, breakpoints: await breakpointsOf(appRoot), themes: await themesOf(appRoot) });
      await reply({ kind: ToView.Server, state: ServerState.Running });
      await comments.show();
      await reply({ kind: ToView.Settings, values: Object.fromEntries(SETTINGS.map((r) => [r.key, r.fallback])), facts: { version: '0.1.0', framework: 'sveltekit', styling } });
    }
    if (m.kind === ToHost.AiList) {
      ai?.list();
    }
    if (m.kind === ToHost.AiStart) {
      await ai?.start((m as unknown as { agent: AcpId }).agent);
    }
    if (m.kind === ToHost.AiSend) {
      void ai?.send(m.text!, (m as unknown as { context: string | null }).context);
    }
    if (m.kind === ToHost.AiAnswer) {
      ai?.answer(m.id as string, (m as unknown as { optionId: string | null }).optionId);
    }
    if (m.kind === ToHost.AiMode) {
      await ai?.setMode(m.id as string);
    }
    if (m.kind === ToHost.AiConfig) {
      await ai?.setConfig(m.id as string, (m as unknown as { value: string }).value);
    }
    if (m.kind === ToHost.AiPolicy) {
      ai?.setPolicy((m as unknown as { policy: Policy }).policy);
    }
    if (m.kind === ToHost.AiOpen) {
      ai?.open((m as unknown as { chat: string }).chat);
    }
    if (m.kind === ToHost.AiRename) {
      ai?.rename((m as unknown as { chat: string }).chat, (m as unknown as { title: string }).title);
    }
    if (m.kind === ToHost.AiDelete) {
      await ai?.remove((m as unknown as { chat: string }).chat);
    }
    if (m.kind === ToHost.AiRetry) {
      await ai?.retry();
    }
    if (m.kind === ToHost.AiCancel) {
      await ai?.cancel();
    }
    if (m.kind === ToHost.Picked) {
      picks.get(m.id as number)?.(m.pick ?? null);
    }
    if (m.kind === ToHost.Classes) {
      await reply({ kind: ToView.Classes, view: await classesAt(appRoot, await classes.snapshot(), m.at!) });
    }
    if (m.kind === ToHost.Impact) {
      const ask = (m as unknown as { ask: EditAsk }).ask;
      if (ask.cls) {
        await reply({ kind: ToView.Impact, id: m.id as number, impact: classImpactOf(classOf(await classes.snapshot(), ask.cls)) });
      }
    }
    if (m.kind === ToHost.Edit) {
      classes.invalidate();
      const out = await edits.edit(m.ask!);
      saves.push(out);
      await history();
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, saved: liveAtOf(m.ask!.at), note: out.note } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
    }
    if (m.kind === ToHost.ReadProps) {
      const ask = (m as unknown as { ask: ReadAsk }).ask;
      const usage = liveAtOf(ask.usage);
      const out = usage && inside(appRoot, usage.file) ? await readProps(reader(appRoot), { component: ask.component, usage, which: ask.which }) : null;
      await reply({ kind: ToView.UsageProps, component: ask.component, values: out?.ok ? out.values : {}, dynamic: out?.ok ? out.dynamic : [], spread: out?.ok ? out.spread : false });
    }
    if (m.kind === ToHost.ApplyProps) {
      const { ask, gate } = m as unknown as { ask: ApplyAsk; gate?: Gate };
      const plan = await edits.propsPlan(ask);
      if (gate !== Gate.Apply && plan.ok && plan.cautions.length) {
        await reply({ kind: ToView.PropsPreview, ask, reason: plan.cautions.join('; '), files: diffOf([plan.change]) });
      } else {
        const out = await edits.applyProps(ask);
        saves.push(out);
        await history();
        await reply(out.ok ? { kind: ToView.Edited, ok: true, written: '', note: out.note } : { kind: ToView.Edited, ok: false, reason: out.reason });
      }
    }
    if (m.kind === ToHost.FontReplace || m.kind === ToHost.FontLoad) {
      const out = m.kind === ToHost.FontReplace ? await edits.replaceFont(m.from!, m.to!, m.google!) : await edits.loadFont(m.family!);
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, note: out.note } : { kind: ToView.Edited, ok: false, reason: out.reason });
    }
    if (m.kind === ToHost.Structure) {
      const out = await edits.structure(m);
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, select: out.selected } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
    }
    if (m.kind === ToHost.LibraryList) {
      await reply({ kind: ToView.Library, items: entriesOf(catalog) });
    }
    if (m.kind === ToHost.LibraryInsert) {
      const ask = insertAskOf(catalog, m.id as string);
      const out = ask.ok ? await edits.library(m.at as string, m.place as AddPlace, ask.item, ask.tokens) : ask;
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: '', select: 'selected' in out ? out.selected : undefined } : { kind: ToView.Edited, ok: false, reason: out.reason });
    }
    if (m.kind === ToHost.StructureMany) {
      const out = await edits.structureMany(m as unknown as ManyAsk);
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, note: out.note, select: out.selected } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
    }
    if (m.kind === ToHost.Copy) {
      copied.push(m.text!);
    }
    if (m.kind === ToHost.IconSearch) {
      const found = await searchIcons(appRoot, fetch, m.query!, null);
      await reply({ kind: ToView.IconResults, id: m.id as number, ...found });
    }
    if (m.kind === ToHost.IconPreviews) {
      await previewIcons(m.names!);
    }
    if (m.kind === ToHost.Comments) {
      await comments.show();
    }
    if (m.kind === ToHost.CommentAdd) {
      await comments.add(m.draft!);
    }
    if (m.kind === ToHost.CommentResolve) {
      await comments.resolve(m.id as string);
    }
    if (m.kind === ToHost.Undo) {
      const out = await edits.undo();
      await history();
      await reply(out.ok ? { kind: ToView.Edited, ok: true, written: '' } : { kind: ToView.Edited, ok: false, reason: out.reason });
    }
    if (m.kind === ToHost.Plugin) {
      await reply({ kind: ToView.Plugin, id: m.id as number, result: await runPlugin(m.ask as unknown as PluginAsk) });
    }
  });

  await page.goto(`http://127.0.0.1:${PANEL_PORT}/`);
  const frame = page.frameLocator('[data-testid=app-frame]');
  await page.locator('.overlay').waitFor({ timeout: 240_000 });

  let nextPick = 0;
  async function pickAt(selector: string): Promise<Pick | null> {
    const target = await frame.locator(selector).first().boundingBox();
    const frameBox = await page.locator('[data-testid=app-frame]').boundingBox();
    const id = ++nextPick;
    const done = new Promise<Pick | null>((resolve) => picks.set(id, resolve));
    await reply({ kind: ToView.Pick, id, x: target!.x - frameBox!.x + 4, y: target!.y - frameBox!.y + 4 });
    return done;
  }

  const close = async () => {
    closed = true;
    await browser.close();
    server.close();
    running.stop();
  };

  return { page, frame, reply, edits, pickAt, saves, copied, close, styling, url: running.url };
}

export type Panel = Awaited<ReturnType<typeof openPanel>>;
export type { Page };
