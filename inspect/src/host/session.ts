import { readFile, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { appsIn } from '@feega/dev-run/run-plan';
import { AddKind, type AddPlace } from '@feega/live-edit/add-node';
import { liveAtOf } from '@feega/live-edit/live-ask';
import { LiveProp } from '@feega/live-edit/live-fields';
import { StructureOp } from '@feega/live-edit/structure';
import type { SupportItem } from '../support';
import { AccountState, Gate, ImpactKind, Onboarding, OnboardingOutcome, OnboardingStep, ServerAction, ServerState, Styling, ToHost, ToView, WebviewUsage, type Author, type Authored, type EditAsk, type ImpactAsk, type HostMessage, type Pick, type Prefs, type ViewMessage } from '../messages';
import { SettingKey, StylingChoice } from '../settings';
import { SignInEnd, signIn } from './sign-in';
import { addPlugin } from './add-plugin';
import { currentIcon } from './icon-current';
import { mcpIcon, searchIcons } from './icon-search';
import { previewQueue } from './icon-previews';
import { appOfSource, firstStampedFile, urlOf } from './attach-url';
import { serverInfo } from './server-info';
import { Attach, attachDev, factsOf, startDev, type Refused, type Running } from './dev-server';
import { RestartWatch, Signal, Step } from './restart-watch';
import { shownFor, watchServer } from './server-watch';
import { commentsHost } from './comments';
import { shareSession } from './share/share-session';
import { copyImage } from './image-copy';
import { fileEdits, type Snapshot, type Written } from './file-edits';
import { editQueue } from './edit-queue';
import { impactOf } from './impact';
import { usageIndex } from './usages';
import { fsWatch } from './file-watch';
import { diffOf } from './diff-preview';
import type { KeptServers } from './kept-servers';
import { forget, remember, type Memo } from './orphans';
import { Stored, type Platform } from './platform';
import { stylingOf } from './styling';
import { breakpointsOf } from './breakpoints';
import { scalesOf } from './scales';
import { themesOf } from './themes';
import { MCP_COMMAND } from '../webview/onboarding-slides';
import { EditKind, UsageKind, usageSession, type EditDetails } from './usage';
import { aiUsage } from './ai/ai-usage';
import { breakpointOf, fileExtOf, identifierOf, linesOf, propCategoryOf, stateOf, targetOf, webviewDimsOf } from './usage-dims';
import { editKindOf } from './edit-kind';
import { selectionSync } from './selection-sync';
import { wiringOf } from './wiring';
import { INCLUDED_IN_CLOUD, entriesOf, insertAskOf } from './library';
import { PRICING_URL, ProRefusal, SEE_PRICING, SIGN_IN, SIGN_IN_FOR_PRO, proItemFor } from './pro-insert';
import { pluginCalls } from './plugin-calls';
import { pluginsSession } from './plugins-session';
import { dependenciesOf, offerInstall } from './install-offer';
import { HintSurface, SKILL_COMMAND, hintDue, installedAfterHint } from './skill-hint';
import { install } from './dev-server';
import { SUPPORT_ITEMS } from '../support';
import { aiChat } from './ai/ai-chat';
import { policyOf } from './ai/permission-policy';
import { openAcpAgent } from './ai/acp-session';
import { machineEnv } from './agents';

const START_WITH_FEEGA = 'Start with Feega';
const PICK_TIMEOUT_MS = 3000;
const SYNC_SELECTION_DELAY_MS = 200;
const LATER_EDITS = 'later edits depend on this change: undo them first';
const CACHE_DIRS = ['.svelte-kit', 'node_modules/.vite', '.next', '.nuxt', '.astro'];
const ERROR_LINES = 6;
const MINUTE_MS = 60_000;
const ERROR = /error|failed|cannot|exception/i;
const COMPILE_TIMEOUT_MS = 5000;
const WATCHER_SEES_WRITE_MS = 400;

enum Replay {
  Fresh,
  History
}

const ONBOARDING_OUTCOME: Record<OnboardingOutcome, string> = {
  [OnboardingOutcome.Finished]: 'completed',
  [OnboardingOutcome.Skipped]: 'skipped'
};

const STRUCTURE_TARGETS: Partial<Record<EditKind, string>> = {
  [EditKind.Structure]: 'markup',
  [EditKind.Template]: 'library_insert'
};

const WEBVIEW_USAGE: Record<WebviewUsage, UsageKind> = {
  [WebviewUsage.CopyForAgent]: UsageKind.CopyForAgent,
  [WebviewUsage.FocusOpened]: UsageKind.FocusOpened,
  [WebviewUsage.StateSwitch]: UsageKind.StateSwitch,
  [WebviewUsage.BreakpointSwitch]: UsageKind.BreakpointSwitch,
  [WebviewUsage.ErrorWebview]: UsageKind.ErrorWebview
};

const IMPACT_CLASS: Partial<Record<ImpactKind, string>> = {
  [ImpactKind.Local]: 'local',
  [ImpactKind.Component]: 'shared'
};

const ONBOARDING_MCP_CHOICE = 'mcp';

const ONBOARDING_END: Record<OnboardingOutcome, UsageKind> = {
  [OnboardingOutcome.Finished]: UsageKind.OnboardingFinished,
  [OnboardingOutcome.Skipped]: UsageKind.OnboardingSkipped
};

export type Session = ReturnType<typeof inspectSession>;

export const appOf = (platform: Platform, workspace: string, root: string) => (root === workspace ? (platform.stored<string>(Stored.App) ?? null) : relative(workspace, root));

export const memoOf = (platform: Platform): Memo => ({ get: (key) => platform.stored(key as Stored), update: (key, value) => platform.store(key as Stored, value).then(() => undefined) });

export function inspectSession(platform: Platform, workspace: string, startApp: string | null = null, startRoute?: string, kept: KeptServers<Running> | null = null) {
  let running: Running | null = null;
  let app = startApp;
  let root = app === null ? workspace : join(workspace, app);
  let starts = 0;
  let cancel: AbortController | null = null;
  let signing: AbortController | null = null;
  const pids = memoOf(platform);
  let route = startRoute;
  let lastError = '';
  let startedAt = 0;
  let nextPick = 0;
  const picks = new Map<number, (pick: Pick | null) => void>();
  const stylingChoice = () => platform.settings()[SettingKey.Styling] as StylingChoice;
  const pageCompiled = async () => {
    if (!running) {
      return;
    }
    await new Promise((done) => setTimeout(done, WATCHER_SEES_WRITE_MS));
    await fetch(new URL(route ?? '/', running.upstream), { signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS) }).catch(() => undefined);
  };
  const editsAt = (dir: string) => fileEdits(dir, stylingChoice, platform.stored<Snapshot>(Stored.History), pageCompiled);
  let edits = editsAt(root);
  const queue = editQueue();
  const ai = aiChat({
    root: () => root,
    env: platform.ai?.env ?? (() => machineEnv()),
    open: platform.ai?.open ?? openAcpAgent,
    confirm: (question, yes) => platform.confirm(question, yes),
    post: (message) => (message.kind === ToView.AiEvent && aiStats?.heard(message.event), platform.send(message)),
    policy: {
      get: () => policyOf(platform.stored(Stored.AiPolicy), platform.settings()[SettingKey.AiPermissions]),
      set: (policy) => void platform.store(Stored.AiPolicy, policy)
    },
    write: async (path, content, agent) => {
      const out = await edits.agentWrite(path, content, agent);
      if (!out.ok) {
        throw new Error(out.reason);
      }
      agentEdited(out);
      await postHistory();
    }
  });
  const authors = new Map<number, string>();
  const approvals = new Map<string, Author>();
  let author: Author | undefined;
  const usagesOf = (dir: string) => usageIndex(dir, { watch: platform.watchFiles ?? fsWatch });
  let usages = usagesOf(root);
  const post = (message: ViewMessage) => platform.send(message);
  let signedIn = false;
  let editKind = EditKind.Other;
  const usage = platform.usage ? usageSession({ ...platform.usage, facts: () => ({ framework: running?.plan.framework ?? null, signedIn }) }) : null;
  const aiStats = usage ? aiUsage(usage) : null;
  const aiWrites = new Set<number>();
  let aiAgent: string | undefined;
  let projectSeen = false;
  let lastImpact: string | undefined;
  let onboardingStep: string | undefined;
  usage?.begin();

  async function postSettings() {
    const framework = running?.plan.framework ?? 'unknown';
    const styling = await stylingOf(root, stylingChoice());
    if (!projectSeen && framework !== 'unknown') {
      projectSeen = true;
      usage?.track(UsageKind.ProjectDetected, { styling: styling === Styling.Tailwind ? 'tailwind' : 'plain_css' });
    }
    await post({ kind: ToView.Settings, values: platform.settings(), facts: { version: platform.version, framework, styling } });
  }

  async function postHistory() {
    await platform.store(Stored.History, edits.snapshot());
    await post({ kind: ToView.History, changes: edits.history().map((change) => ({ ...change, by: authors.get(change.id) })), canUndo: edits.canUndo(), canRedo: edits.canRedo() });
  }

  async function editDetails(out: Written & { ok: true }, ask: EditAsk | null, replay: Replay): Promise<EditDetails> {
    const styling = await stylingOf(root, stylingChoice());
    const impactClass = lastImpact;
    lastImpact = undefined;

    return {
      ...linesOf(out.touched ?? []),
      file_ext: fileExtOf(out.path),
      target: ask ? targetOf(ask, styling) : STRUCTURE_TARGETS[editKind],
      prop_category: ask ? propCategoryOf(ask.prop, ask.css) : undefined,
      breakpoint: breakpointOf(ask?.breakpoint),
      state: stateOf(ask?.state),
      source: replay === Replay.History ? 'revert' : 'manual',
      impact: impactClass
    };
  }

  function agentEdited(out: Written & { ok: true }) {
    const id = edits.latest();
    if (id !== null) {
      aiWrites.add(id);
    }
    usage?.edit(EditKind.Other, { ...linesOf(out.touched ?? []), file_ext: fileExtOf(out.path), source: 'ai', agent: aiAgent });
  }

  function reverted() {
    const id = edits.latest();
    const byAi = id !== null && aiWrites.has(id);
    usage?.track(UsageKind.EditReverted, byAi ? { source: 'ai', agent: aiAgent } : { source: 'manual' });
  }

  const undone = () => (reverted(), edits.undo());

  async function edited(out: Written, ask: EditAsk | null, replay = Replay.Fresh) {
    if (out.ok) {
      usage?.edit(editKind, usage ? await editDetails(out, ask, replay) : {});
    }
    const written = edits.latest();
    if (out.ok && replay === Replay.Fresh && author && written !== null) {
      authors.set(written, author.name);
    }
    usages.invalidate();
    await postHistory();
    const saved = ask ? (liveAtOf(ask.at) ?? undefined) : undefined;
    await post(out.ok ? { kind: ToView.Edited, ok: true, fromHistory: replay === Replay.History, written: out.written, saved, note: out.note, select: out.selected } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
    return out;
  }

  async function iconFetched(m: Extract<HostMessage, { kind: ToHost.IconGet }>) {
    const svg = await mcpIcon(fetch, m.name, m.size, m.stroke).catch((error: Error) => error);
    if (svg instanceof Error) {
      await post({ kind: ToView.Edited, ok: false, reason: svg.message });
      return;
    }
    await edits.svg(m.at, svg, m.inner).then((out) => edited(out, null));
  }

  async function iconsFound(id: number, query: string, at: string) {
    const found = await searchIcons(root, fetch, query, await currentIcon(root, at));
    await post({ kind: ToView.IconResults, id, ...found });
  }

  const iconPreviews = previewQueue(fetch, (name, svg) => post({ kind: ToView.IconPreview, name, svg }));

  async function imageSaved(name: string, bytes: Uint8Array) {
    const out = await copyImage(join(root, running?.plan.appDir ?? ''), name, bytes);
    await post(out.ok ? { kind: ToView.ImageSaved, url: out.url } : { kind: ToView.Edited, ok: false, reason: out.reason });
  }

  async function imageChosen() {
    const image = await platform.pickImage?.();
    if (image) {
      await imageSaved(image.name, image.bytes);
    }
  }

  async function imageAdded(at: string, place?: AddPlace) {
    const image = await platform.pickImage?.();
    if (!image) {
      return;
    }
    const copied = await copyImage(join(root, running?.plan.appDir ?? ''), image.name, image.bytes);
    if (!copied.ok) {
      await post({ kind: ToView.Edited, ok: false, reason: copied.reason });
      return;
    }
    await edits.structure({ op: StructureOp.Add, at, add: { kind: AddKind.Image, src: copied.url, place } }).then((out) => edited(out, null));
  }

  async function libraryShown() {
    const catalog = (await platform.library?.()) ?? null;
    await post({ kind: ToView.Library, items: catalog ? entriesOf(catalog) : [] });
  }

  const proPrompts: Record<ProRefusal, { text: string; action: string; accept: () => unknown }> = {
    [ProRefusal.SignIn]: { text: SIGN_IN_FOR_PRO, action: SIGN_IN, accept: () => startSignIn() },
    [ProRefusal.Plan]: { text: INCLUDED_IN_CLOUD, action: SEE_PRICING, accept: () => platform.openExternal(PRICING_URL) }
  };

  async function proPrompted(refusal: ProRefusal | null) {
    if (!refusal) {
      return;
    }
    const prompt = proPrompts[refusal];
    if (await platform.warn(prompt.text, prompt.action)) {
      await prompt.accept();
    }
  }

  async function libraryInserted(m: Extract<HostMessage, { kind: ToHost.LibraryInsert }>) {
    const ask = insertAskOf((await platform.library?.()) ?? null, m.id);
    if (!ask.ok) {
      await edited(ask, null);
      return;
    }
    const ready = ask.pro ? await proItemFor(ask.item, await readFile(join(root, 'package.json'), 'utf8').catch(() => null), platform.proFiles) : { ok: true as const, item: ask.item };
    const out: Written = ready.ok ? await edits.library(m.at, m.place, ready.item, ask.tokens) : ready;
    await edited(out, null);
    if (out.ok) {
      usage?.track(UsageKind.LibraryInsert, { tier: ask.pro ? 'pro' : 'free', library_item: identifierOf(m.id) });
    }
    if (!ready.ok && ready.refusal) {
      void proPrompted(ready.refusal);
    }
  }

  function installOffered(now: Running, packages: string[]) {
    const { plan } = now;
    const hooks = { log: (line: string) => platform.log(line), installing: () => undefined, spawned: () => undefined, signal: new AbortController().signal };
    return offerInstall(
      {
        command: plan.install.join(' '),
        confirm: (question, yes) => platform.confirm(question, yes),
        install: () => install(join(root, plan.installDir), plan.install, hooks),
        say: (text) => post({ kind: ToView.Status, text })
      },
      packages
    );
  }

  const pluginRun = pluginCalls({
    get root() {
      return root;
    },
    appDir: () => running?.plan.appDir ?? '',
    propose: async (proposal, appDir) => {
      const out = await edits.proposal(proposal, appDir).then((written) => edited(written, null));
      const packages = dependenciesOf(proposal);
      if (out.ok && packages.length && running) {
        void installOffered(running, packages);
      }
      return out;
    },
    fetch
  });

  const pluginList = platform.plugins
    ? pluginsSession({ host: { root: platform.plugins.root, dev: () => platform.plugins!.dev().map((folder) => resolve(root, folder)) }, post, notify: platform.notify, onInstalled: () => usage?.track(UsageKind.PluginInstalled) })
    : null;

  const comments = commentsHost(platform.cloud, post, () => edits.history());
  const sharing = shareSession({ platform, workspace, appUrl: () => running?.url ?? null, post });

  const postAccount = (state: AccountState, email?: string) => {
    signedIn = state === AccountState.SignedIn;
    return post({ kind: ToView.Account, state, email });
  };

  async function showAccount() {
    const account = await platform.account.read();
    await postAccount(account ? AccountState.SignedIn : AccountState.SignedOut, account?.user.email);
  }

  async function startSignIn() {
    if (signing) {
      return;
    }
    usage?.track(UsageKind.SignInPrompted);
    signing = new AbortController();
    await postAccount(AccountState.Waiting);
    const outcome = await signIn({ openBrowser: platform.openExternal, signal: signing.signal });
    signing = null;
    if (outcome.end !== SignInEnd.Done) {
      await postAccount(AccountState.Cancelled);
      return;
    }
    await platform.account.write(outcome.account);
    usage?.signedIn();
    await postAccount(AccountState.SignedIn, outcome.account.user.email);
    await platform.notify(`Signed in as ${outcome.account.user.email}`);
  }

  async function showOnboarding() {
    const state = await platform.onboarding.read();
    if (state === Onboarding.Pending) {
      usage?.track(UsageKind.OnboardingStarted);
    }
    await post({ kind: ToView.Onboarding, state });
  }

  async function showSupport() {
    await post({ kind: ToView.Support, done: (await platform.support?.read()) ?? [] });
  }

  async function supportAct(item: SupportItem) {
    const entry = SUPPORT_ITEMS.find((candidate) => candidate.id === item);
    if (!entry) {
      return;
    }

    if (entry.url) {
      await platform.openExternal(entry.url);
    }
    if (entry.text) {
      await platform.copyText?.(entry.text);
    }
    await platform.support?.mark(item);
    usage?.track(UsageKind.SupportAction, { item });
    await showSupport();
  }

  async function showAgents() {
    await post({ kind: ToView.Agents, found: platform.agents?.() ?? [] });
  }

  async function showSkillHint() {
    if (platform.skillHint?.surface === HintSurface.Panel && hintDue(platform, [...new Set([root, workspace])])) {
      usage?.track(UsageKind.SkillHintShown);
      await platform.store(Stored.SkillHintShown, true);
      await post({ kind: ToView.SkillHint, command: SKILL_COMMAND });
    }
    if (installedAfterHint(platform, [...new Set([root, workspace])])) {
      usage?.track(UsageKind.SkillInstalled);
      await platform.store(Stored.SkillInstalledSent, true);
    }
  }

  const dismissSkillHint = () => platform.store(Stored.SkillHint, true);

  async function neverSkillHint() {
    await dismissSkillHint();
    await platform.skillHint?.setNever?.();
  }

  async function signOut() {
    await platform.account.clear();
    usage?.signedOut();
    await postAccount(AccountState.SignedOut);
  }

  async function wiringShown(at: string, instance?: number) {
    await post({ kind: ToView.Wiring, at, instance, wiring: await wiringOf(root, at, instance) });
  }

  const syncSelection = selectionSync({
    reveal: (at) => platform.revealSource?.(root, at),
    enabled: () => platform.settings()[SettingKey.SyncSelection] === true,
    delayMs: SYNC_SELECTION_DELAY_MS
  });

  let agentContext: string | null = null;
  const published = platform.localBridge?.(workspace, { selection: () => agentContext, changes: () => edits.history() })?.catch(() => null);

  async function impact(ask: ImpactAsk) {
    const found = await impactOf(root, ask, edits.targets, usages);
    lastImpact = IMPACT_CLASS[found.kind];

    return found;
  }

  async function impactShown(id: number, ask: ImpactAsk) {
    await post({ kind: ToView.Impact, id, impact: await impact(ask) });
  }

  async function held(ask: EditAsk): Promise<boolean> {
    const asked = platform.settings()[SettingKey.PreviewUnknown] !== false && ask.prop !== LiveProp.Text;
    const found = asked ? await impact(ask) : null;
    if (found?.kind !== ImpactKind.Unknown) {
      return false;
    }
    const preview = await edits.preview(ask);
    const files = preview.ok ? diffOf(preview.changes ?? []) : [];
    if (!files.length) {
      return false;
    }
    author && approvals.set(askKey(ask), author);
    await post({ kind: ToView.Preview, ask, reason: found.reason, files, by: author });
    return true;
  }

  async function edit(ask: EditAsk, gate = Gate.Ask): Promise<Written | null> {
    if (gate === Gate.Ask && (await held(ask))) {
      return null;
    }
    return edits.edit(ask).then((out) => edited(out, ask));
  }
  const undo = () => undone().then((out) => edited(out, null, Replay.History));

  async function revert(id: number | null) {
    if (id === null) {
      let last: Written | null = null;
      while (edits.canUndo()) {
        last = await undone();
        if (!last.ok) {
          break;
        }
        await postHistory();
      }
      if (last) {
        await edited(last, null, Replay.History);
        return;
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

  const keptMinutes = () => Number(platform.settings()[SettingKey.KeepServerAlive]) || 0;

  function infoOf(now: Running) {
    return serverInfo({ url: now.url, framework: now.plan.framework, command: now.command, pid: now.pid, attached: now.attached }, { keptMinutes: kept ? keptMinutes() : 0, startedAt, lastError });
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
    await post({ kind: ToView.App, url: running.url, styling: await stylingOf(root, stylingChoice()), prefs, route, breakpoints: await breakpointsOf(root), themes: await themesOf(root), scales: await scalesOf(root, stylingChoice()) });
    await post({ kind: ToView.Server, state: ServerState.Running, info: infoOf(running) });
    await postSettings();
  }

  async function useApp(next: string) {
    app = next;
    root = join(workspace, next);
    edits = editsAt(root);
    usages.dispose();
    usages = usagesOf(root);
    await platform.store(Stored.App, next);
  }

  async function chooseApp(apps: string[]) {
    const picked = await platform.chooseApp(apps, workspace);
    if (picked !== null) {
      await useApp(picked);
    }
    return picked;
  }

  const restarts = new RestartWatch();

  function carryOut(step: Step, started: Running) {
    shownFor(step, infoOf(started), lastError).forEach(post);
    if (step === Step.Respawn) {
      void startServer();
    }
  }

  function adopt(started: Running, current: () => boolean) {
    running = started;
    started.exited(() => {
      if (started.pid) {
        forget(pids, started.pid);
      }
      if (current() && running === started) {
        carryOut(restarts.feed(Signal.Exited, Date.now()), started);
      }
    });
    void watchServer({ started, restarts, current: () => current() && running === started, act: (step) => carryOut(step, started) });
  }

  async function startServer(attach = Attach.IfRunning): Promise<Running | Refused> {
    const parked = attach === Attach.IfRunning && !running ? (kept?.take(root) ?? null) : null;
    const mine = ++starts;
    if (parked) {
      adopt(parked, () => starts === mine);
      await showApp();
      return parked;
    }
    const current = () => starts === mine;
    running?.stop();
    running = null;
    cancel?.abort();
    const signal = (cancel = new AbortController()).signal;
    lastError = '';
    post({ kind: ToView.Server, state: ServerState.Starting });
    const hooks = {
      log: logLine,
      installing: (dir: string) => current() && post({ kind: ToView.Server, state: ServerState.Installing, reason: `Installing dependencies for ${dir} (first run)…` }),
      spawned: (pid: number) => remember(pids, pid, root),
      declined: (text: string) => void platform.warn(text),
      signal
    };
    const started = await startDev(workspace, platform.launcher, hooks, String(platform.settings()[SettingKey.DevCommand]), attach, app);
    if (!current()) {
      if (!('refused' in started)) {
        started.stop();
      }
      return started;
    }
    if ('refused' in started) {
      if (started.apps?.length && (await chooseApp(started.apps)) !== null) {
        return startServer(attach);
      }
      post({ kind: ToView.Server, state: ServerState.Stopped, reason: started.refused });
      return started;
    }
    startedAt = Date.now();
    adopt(started, current);
    await showApp();
    return started;
  }

  async function appForUrl(url: string): Promise<string | null | undefined> {
    const apps = appsIn(await factsOf(workspace));
    if (app !== null || apps.length < 2) {
      return app ?? apps[0];
    }
    const page = await fetch(url, { signal: AbortSignal.timeout(PICK_TIMEOUT_MS) }).then((r) => r.text(), () => '');
    const stamped = firstStampedFile(page);
    return (stamped && appOfSource(workspace, apps, stamped)) ?? chooseApp(apps);
  }

  async function attachUrl(text: string): Promise<Running | Refused> {
    const url = urlOf(text);
    if (!url) {
      return refuse(`"${text}" is not a web address`);
    }
    const mine = ++starts;
    running?.stop();
    running = null;
    post({ kind: ToView.Server, state: ServerState.Starting });
    const chosen = await appForUrl(url);
    if (chosen === null) {
      return refuse('no app chosen');
    }
    if (chosen !== undefined && chosen !== app) {
      await useApp(chosen);
    }
    const started = await attachDev(workspace, platform.launcher, url, app);
    if (starts !== mine) {
      return started;
    }
    if ('refused' in started && started.attachRefused) {
      refuse(started.refused);
      return (await platform.warn(started.refused, START_WITH_FEEGA)) ? startServer(Attach.Never) : started;
    }
    if ('refused' in started) {
      return refuse(started.refused);
    }
    startedAt = Date.now();
    adopt(started, () => starts === mine);
    await showApp();
    return started;
  }

  function refuse(reason: string): Refused {
    post({ kind: ToView.Server, state: ServerState.Stopped, reason });
    return { refused: reason };
  }

  async function installPlugin() {
    const out = await addPlugin(join(root, running?.plan.appDir ?? ''));
    usage?.track(out.ok ? UsageKind.SetupApplied : UsageKind.SetupFailed);
    await post({ kind: ToView.Status, text: out.ok ? (out.files.length ? `Added the Feega plugin to ${out.files.join(', ')}. Install dependencies and restart the dev server.` : 'The Feega plugin is already set up.') : out.reason });
  }

  async function switchApp() {
    if ((await chooseApp(appsIn(await factsOf(workspace)))) !== null) {
      await startServer();
    }
  }

  function close() {
    cancel?.abort();
    starts++;
    if (running && !running.attached && kept) {
      kept.park(root, running, keptMinutes() * MINUTE_MS);
    } else {
      running?.stop();
    }
    running = null;
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
    [ServerAction.RestartUnderFeega]: () => startServer(Attach.Never),
    [ServerAction.Cancel]: () => (cancel?.abort(), post({ kind: ToView.Server, state: ServerState.Stopped, reason: 'install cancelled' })),
    [ServerAction.ChooseApp]: switchApp
  };

  const handlers: { [K in ToHost]: (m: Extract<HostMessage, { kind: K }>) => unknown } = {
    [ToHost.Ready]: () => (showApp(), postSettings(), postHistory(), showAccount(), showOnboarding(), showSupport(), showAgents(), showSkillHint(), comments.show(), sharing.show(), pluginList?.show()),
    [ToHost.Edit]: (m) => edit(m.ask, m.gate),
    [ToHost.Impact]: (m) => impactShown(m.id, m.ask),
    [ToHost.Undo]: undo,
    [ToHost.Open]: (m) => platform.openSource(root, m.at),
    [ToHost.Picked]: (m) => (picks.get(m.id)?.(m.pick), picks.delete(m.id)),
    [ToHost.Restart]: () => startServer(),
    [ToHost.External]: (m) => platform.openExternal(m.url),
    [ToHost.Prefs]: (m) => platform.store(Stored.Prefs, m.prefs),
    [ToHost.Server]: (m) => SERVER_ACTIONS[m.action](),
    [ToHost.SaveVariable]: (m) => edits.saveVariable(m.ask, m.name).then((out) => edited(out, m.ask)),
    [ToHost.Font]: (m) => edits.font(m.ask, m.google).then((out) => edited(out, m.ask)),
    [ToHost.FontReplace]: (m) => edits.replaceFont(m.from, m.to, m.google).then((out) => edited(out, null)),
    [ToHost.FontLoad]: (m) => edits.loadFont(m.family).then((out) => edited(out, null)),
    [ToHost.Redo]: () => edits.redo().then((out) => edited(out, null, Replay.History)),
    [ToHost.Revert]: (m) => revert(m.id),
    [ToHost.Diff]: (m) => showDiff(m.id),
    [ToHost.SourceControl]: () => platform.sourceControl(),
    [ToHost.Move]: (m) => edits.move(m.from, m.to, m.place).then((out) => edited(out, null)),
    [ToHost.StructureMany]: (m) => edits.structureMany(m).then((out) => edited(out, null)),
    [ToHost.Detach]: (m) => edits.detach(m).then((out) => edited(out, null)),
    [ToHost.AddImage]: (m) => imageAdded(m.at, m.place),
    [ToHost.Structure]: (m) => edits.structure(m).then((out) => edited(out, null)),
    [ToHost.Setting]: (m) => platform.setSetting(m.key, m.value).then(postSettings),
    [ToHost.AttachUrl]: (m) => attachUrl(m.url),
    [ToHost.AddPlugin]: installPlugin,
    [ToHost.IconSwap]: (m) => edits.icon(m.at, m.name).then((out) => edited(out, null)),
    [ToHost.IconMarkup]: (m) => edits.svg(m.at, m.markup, m.inner).then((out) => edited(out, null)),
    [ToHost.IconGet]: iconFetched,
    [ToHost.IconSearch]: (m) => iconsFound(m.id, m.query, m.at),
    [ToHost.IconPreviews]: (m) => iconPreviews(m.names),
    [ToHost.SignIn]: startSignIn,
    [ToHost.CancelSignIn]: () => signing?.abort(),
    [ToHost.SignOut]: signOut,
    [ToHost.OnboardingStep]: (m) => ((onboardingStep = m.step), usage?.track(UsageKind.OnboardingStep, { step: m.step, outcome: 'viewed' })),
    [ToHost.OnboardingDone]: (m) => (onboardingStep && usage?.track(UsageKind.OnboardingStep, { step: onboardingStep, outcome: ONBOARDING_OUTCOME[m.outcome] }), usage?.track(ONBOARDING_END[m.outcome]), platform.onboarding.markSeen()),
    [ToHost.Support]: (m) => supportAct(m.item),
    [ToHost.SkillHintDismiss]: dismissSkillHint,
    [ToHost.SkillHintNever]: neverSkillHint,
    [ToHost.ImageChoose]: imageChosen,
    [ToHost.ImageUpload]: (m) => imageSaved(m.name, Buffer.from(m.data, 'base64')),
    [ToHost.Wiring]: (m) => wiringShown(m.at, m.instance),
    [ToHost.Link]: (m) => edits.link(m.at, m.edit, m.instance).then((out) => edited(out, null)),
    [ToHost.Attribute]: (m) => edits.attribute(m.at, m.name, m.value).then((out) => edited(out, null)),
    [ToHost.Go]: (m) => edits.go(m.at, m.ask).then((out) => edited(out, null)),
    [ToHost.Selected]: (m) => (m.at && usage?.track(UsageKind.ElementSelected), void published?.then((bridge) => bridge?.touch()), sharing.hostSelected(m.at), syncSelection(m.at)),
    [ToHost.Context]: (m) => void (agentContext = m.text),
    [ToHost.Copy]: (m) => (m.text === MCP_COMMAND && usage?.track(UsageKind.OnboardingStep, { step: OnboardingStep.Agents, outcome: 'completed', choice: ONBOARDING_MCP_CHOICE }), platform.copyText?.(m.text)),
    [ToHost.Usage]: (m) => usage?.track(WEBVIEW_USAGE[m.event], webviewDimsOf(m.dims)),
    [ToHost.Comments]: comments.show,
    [ToHost.CommentAdd]: (m) => (usage?.track(UsageKind.CloudAction, { action: 'comment_add' }), comments.add(m.draft)),
    [ToHost.CommentResolve]: (m) => comments.resolve(m.id),
    [ToHost.RevisionPublish]: (m) => (usage?.track(UsageKind.CloudAction, { action: 'revision_publish' }), comments.publish(m.summary)),
    [ToHost.ShareStart]: (m) => (usage?.track(UsageKind.ShareAction, { action: 'share_start' }), sharing.start(m.name, m.canEdit)),
    [ToHost.ShareStop]: sharing.stop,
    [ToHost.ShareKick]: (m) => sharing.kick(m.userId),
    [ToHost.ShareRole]: (m) => sharing.setRole(m.userId, m.role),
    [ToHost.LibraryList]: libraryShown,
    [ToHost.LibraryInsert]: libraryInserted,
    [ToHost.Plugin]: async (m) => post({ kind: ToView.Plugin, id: m.id, result: await pluginRun(m.ask) }),
    [ToHost.PluginEnable]: (m) => pluginList?.enable(m.id, m.enabled),
    [ToHost.PluginRemove]: (m) => pluginList?.remove(m.id),
    [ToHost.PluginInstall]: (m) => pluginList?.install(m.source),
    [ToHost.PreviewReady]: () => usage?.previewReady(),
    [ToHost.Cursor]: (m) => sharing.hostPointed(m.at),
    [ToHost.AiList]: ai.list,
    [ToHost.AiStart]: (m) => ((aiAgent = m.agent), aiStats?.started(m.agent), ai.start(m.agent)),
    [ToHost.AiSend]: (m) => (aiStats?.sent(), void ai.send(m.text, m.context)),
    [ToHost.AiCancel]: () => (aiStats?.cancelled(), ai.cancel()),
    [ToHost.AiAnswer]: (m) => (aiStats?.answered(m.id, m.optionId), ai.answer(m.id, m.optionId)),
    [ToHost.AiMode]: (m) => void ai.setMode(m.id),
    [ToHost.AiPolicy]: (m) => ai.setPolicy(m.policy)
  };

  const askKey = (ask: EditAsk) => JSON.stringify(ask);

  const approvedAsk = (message: Authored) => (message.kind === ToHost.Edit && message.gate === Gate.Apply ? message.ask : null);

  function authorOf(message: Authored): Author | undefined {
    const ask = approvedAsk(message);
    if (!ask) {
      return message.by;
    }
    const approved = approvals.get(askKey(ask));
    approvals.delete(askKey(ask));
    return approved;
  }

  async function apply(message: Authored) {
    if (message.by && approvedAsk(message)) {
      return;
    }
    author = authorOf(message);
    try {
      return await (handlers[message.kind] as (m: HostMessage) => unknown)(message);
    } finally {
      author = undefined;
    }
  }

  platform.receive((message: Authored) => {
    const kind = editKindOf(message);
    if (kind === EditKind.Other && !message.by) {
      return (handlers[message.kind] as (m: HostMessage) => unknown)(message);
    }
    return queue.run(() => (kind === EditKind.Other || (editKind = kind), apply(message)));
  });

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
    root: () => root,
    start: () => startServer(),
    attachUrl,
    addPlugin: installPlugin,
    stop: async () => {
      close();
      ai.close();
      usages.dispose();
      pluginList?.stop();
      await sharing.stop();
      await (await published)?.stop();
      aiStats?.ended();
      await usage?.end();
    },
    usageChanged: () => usage?.recheck(),
    away: () => usage?.away(),
    back: () => usage?.back(),
    url: () => running?.url ?? null,
    showApp,
    showRoute,
    settingsChanged: postSettings,
    pluginsChanged: () => pluginList?.restart(),
    pick,
    edit,
    undo,
    change: (row: string, value: string) => post({ kind: ToView.Change, row, value })
  };
}
