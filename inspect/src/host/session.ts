import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { liveAtOf } from '@feega/live-edit/live-ask';
import { ServerAction, ServerState, ToHost, ToView, type EditAsk, type HostMessage, type Pick, type Prefs, type ViewMessage } from '../messages';
import { SettingKey, StylingChoice } from '../settings';
import { Attach, startDev, type Running } from './dev-server';
import { fileEdits, type Snapshot, type Written } from './file-edits';
import { Stored, type Platform } from './platform';
import { stylingOf } from './styling';

const PICK_TIMEOUT_MS = 3000;
const LATER_EDITS = 'later edits depend on this change: undo them first';
const CACHE_DIRS = ['.svelte-kit', 'node_modules/.vite', '.next', '.nuxt', '.astro'];
const ERROR_LINES = 6;
const ERROR = /error|failed|cannot|exception/i;

export type Session = ReturnType<typeof inspectSession>;

export function inspectSession(platform: Platform, root: string, startRoute?: string) {
  let running: Running | null = null;
  let route = startRoute;
  let lastError = '';
  let startedAt = 0;
  let nextPick = 0;
  const picks = new Map<number, (pick: Pick | null) => void>();
  const stylingChoice = () => platform.settings()[SettingKey.Styling] as StylingChoice;
  const edits = fileEdits(root, stylingChoice, platform.stored<Snapshot>(Stored.History));
  const post = (message: ViewMessage) => platform.send(message);

  async function postSettings() {
    const framework = running?.plan.framework ?? 'unknown';
    const styling = await stylingOf(root, stylingChoice());
    await post({ kind: ToView.Settings, values: platform.settings(), facts: { version: platform.version, framework, styling } });
  }

  async function postHistory() {
    await platform.store(Stored.History, edits.snapshot());
    await post({ kind: ToView.History, changes: edits.history(), canUndo: edits.canUndo(), canRedo: edits.canRedo() });
  }

  async function edited(out: Written, ask: EditAsk | null) {
    await postHistory();
    const saved = ask ? (liveAtOf(ask.at) ?? undefined) : undefined;
    await post(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, saved, note: out.note } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
    return out;
  }

  const edit = (ask: EditAsk) => edits.edit(ask).then((out) => edited(out, ask));
  const undo = () => edits.undo().then((out) => edited(out, null));

  async function revert(id: number | null) {
    if (id === null) {
      while (edits.canUndo() && (await edits.undo()).ok) {
        await postHistory();
      }
      await postHistory();
      return;
    }
    if (edits.latest() !== id) {
      await post({ kind: ToView.Edited, ok: false, reason: LATER_EDITS });
      return;
    }
    await undo();
  }

  async function showDiff(id: number) {
    const [first] = edits.beforeOf(id);
    if (!first) {
      return;
    }
    await platform.showDiff(first.full, first.before);
  }

  function infoOf(now: Running) {
    return { url: now.url, framework: now.plan.framework, command: now.command, pid: now.pid, port: Number(new URL(now.url).port), attached: now.attached, startedAt, lastError };
  }

  function logLine(line: string) {
    platform.log(line);
    if (ERROR.test(line)) {
      lastError = [...lastError.split('\n'), ...line.trim().split('\n')].slice(-ERROR_LINES).join('\n');
    }
  }

  async function showApp() {
    if (!running) {
      return;
    }
    const prefs = platform.stored<Prefs>(Stored.Prefs) ?? null;
    await post({ kind: ToView.App, url: running.url, styling: await stylingOf(root, stylingChoice()), prefs, route });
    await post({ kind: ToView.Server, state: ServerState.Running, info: infoOf(running) });
    await postSettings();
  }

  async function startServer(attach = Attach.IfRunning) {
    running?.stop();
    lastError = '';
    post({ kind: ToView.Server, state: ServerState.Starting });
    const started = await startDev(root, platform.launcher, logLine, String(platform.settings()[SettingKey.DevCommand]), attach);
    if ('refused' in started) {
      post({ kind: ToView.Server, state: ServerState.Stopped, reason: started.refused });
      return started;
    }
    startedAt = Date.now();
    running = started;
    started.exited(() => post({ kind: ToView.Server, state: ServerState.Stopped, reason: lastError || 'the dev server exited', info: infoOf(started) }));
    await showApp();
    return started;
  }

  function stopServer() {
    running?.stop();
    running = null;
    post({ kind: ToView.Server, state: ServerState.Stopped, reason: 'stopped' });
  }

  async function clearCache() {
    if (!(await platform.confirm(`Delete ${CACHE_DIRS.join(', ')} in this app and restart the dev server?`, 'Clear and restart'))) {
      return;
    }
    const appRoot = join(root, running?.plan.appDir ?? '');
    running?.stop();
    await Promise.all(CACHE_DIRS.map((dir) => rm(join(appRoot, dir), { recursive: true, force: true })));
    await startServer();
  }

  const SERVER_ACTIONS: Record<ServerAction, () => unknown> = {
    [ServerAction.Start]: () => startServer(),
    [ServerAction.Restart]: () => startServer(),
    [ServerAction.Stop]: stopServer,
    [ServerAction.ReloadPage]: () => showApp(),
    [ServerAction.ClearCache]: clearCache,
    [ServerAction.ShowLogs]: () => platform.showLogs(),
    [ServerAction.ChangeCommand]: () => platform.openSettings(SettingKey.DevCommand),
    [ServerAction.RestartUnderFeega]: () => startServer(Attach.Never)
  };

  const handlers: { [K in ToHost]: (m: Extract<HostMessage, { kind: K }>) => unknown } = {
    [ToHost.Ready]: () => (showApp(), postSettings(), postHistory()),
    [ToHost.Edit]: (m) => edit(m.ask),
    [ToHost.Undo]: undo,
    [ToHost.Open]: (m) => platform.openSource(root, m.at),
    [ToHost.Picked]: (m) => (picks.get(m.id)?.(m.pick), picks.delete(m.id)),
    [ToHost.Restart]: () => startServer(),
    [ToHost.External]: (m) => platform.openExternal(m.url),
    [ToHost.Prefs]: (m) => platform.store(Stored.Prefs, m.prefs),
    [ToHost.Server]: (m) => SERVER_ACTIONS[m.action](),
    [ToHost.SaveVariable]: (m) => edits.saveVariable(m.ask, m.name).then((out) => edited(out, m.ask)),
    [ToHost.Font]: (m) => edits.font(m.ask, m.google).then((out) => edited(out, m.ask)),
    [ToHost.Redo]: () => edits.redo().then((out) => edited(out, null)),
    [ToHost.Revert]: (m) => revert(m.id),
    [ToHost.Diff]: (m) => showDiff(m.id),
    [ToHost.SourceControl]: () => platform.sourceControl(),
    [ToHost.Move]: (m) => edits.move(m.from, m.to, m.place).then((out) => edited(out, null)),
    [ToHost.Setting]: (m) => platform.setSetting(m.key, m.value).then(postSettings)
  };

  platform.receive((message) => (handlers[message.kind] as (m: HostMessage) => unknown)(message));

  function pick(x: number, y: number): Promise<Pick | null> {
    const id = ++nextPick;
    return new Promise((resolve) => {
      picks.set(id, resolve);
      setTimeout(() => (picks.delete(id), resolve(null)), PICK_TIMEOUT_MS);
      post({ kind: ToView.Pick, id, x, y });
    });
  }

  async function showRoute(next: string | undefined) {
    if (!next) {
      return;
    }
    route = next;
    await showApp();
  }

  return {
    root,
    start: () => startServer(),
    stop: () => running?.stop(),
    url: () => running?.url ?? null,
    showApp,
    showRoute,
    settingsChanged: postSettings,
    pick,
    edit,
    undo,
    change: (row: string, value: string) => post({ kind: ToView.Change, row, value })
  };
}
