import { LOGO_PATHS, type Logo } from '../../../landing/src/lib/site/codebase/logos';
import { platformRow } from '../main/platform';
import { PIXELS, pixelSvg } from './pixel';
import { STACKS, Stack } from '../../../cli/lib/scaffold/stacks';
import { TEMPLATES, TEMPLATE_LABELS, Template } from '../../../cli/lib/scaffold/templates';
import { Step } from '../../../cli/lib/scaffold/step';
import { el, pill, run, type View } from './dom';
import { onboardingView, skipOnboarding, type OnboardingDeps } from './onboarding';
import { Link, NodeStatus, TabStatus, UpdateState, type RecentInfo, type ShellState, type TabInfo } from '../main/types';

type Bridge = {
  state: () => Promise<ShellState>;
  signIn: () => Promise<void>;
  cancelSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  skip: () => Promise<void>;
  pickFolder: () => Promise<void>;
  openDir: (dir: string) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  retryTab: (id: string) => Promise<void>;
  chooseApp: (id: string, app: string) => Promise<void>;
  activate: (id: string | null) => Promise<void>;
  setPreferences: (change: Partial<ShellState['preferences']>) => Promise<void>;
  openLink: (link: Link) => Promise<void>;
  overlay: (open: boolean) => Promise<void>;
  checkUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  quit: () => Promise<void>;
  checkNode: () => Promise<boolean>;
  pickParent: () => Promise<string | null>;
  createProject: (ask: { parent: string; name: string; stack: Stack; template: Template }) => Promise<void>;
  dismissInvite: () => Promise<void>;
  clearProject: () => Promise<void>;
  finishOnboarding: () => Promise<void>;
  replayOnboarding: () => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  copy: (text: string) => Promise<void>;
  onSettings: (listener: () => void) => void;
  onState: (listener: (state: ShellState) => void) => void;
};

const bridge = (window as unknown as { feega: Bridge }).feega;
const bar = document.getElementById('bar') as HTMLElement;
const main = document.getElementById('main') as HTMLElement;

const MARK_LOBE = 'M61.87 142.25A57 57 0 1 1 136.13 142.25A69.5 69.5 0 0 0 61.87 142.25Z';
const MARK = [0, 90, 180, 270].map((turn) => `<path d="${MARK_LOBE}" transform="rotate(${turn} 150 150)"/>`).join('');
const MARK_FILL = '#ff5100';
const MARK_SIZE = 16;
const PLUS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 2.5v11M2.5 8h11"/></svg>';
const CROSS = '<svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STAGGER_MS = 50;

const FRIENDLY: [RegExp, string][] = [
  [/several apps here/i, 'this folder holds several apps. open one of them directly.'],
  [/no web app/i, 'no web app (package.json) found in this folder.'],
  [/EADDRINUSE/i, 'a port needed by the dev server is already in use.'],
  [/not found|ENOENT/i, 'something the dev server needs was not found.']
];

const mark = (size: number = MARK_SIZE) => `<svg width="${size}" height="${size}" viewBox="0 0 300 300" fill="${MARK_FILL}">${MARK}</svg>`;

const HOME_PREFIX = /^(\/(Users|home)\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)/;

const tidyPath = (dir: string) => dir.replace(HOME_PREFIX, '~');

const ago = (at: number) => {
  const age = Date.now() - at;
  if (!at) {
    return '';
  }
  if (age < MINUTE_MS) {
    return 'just now';
  }
  if (age < HOUR_MS) {
    return `${Math.floor(age / MINUTE_MS)}m ago`;
  }
  if (age < DAY_MS) {
    return `${Math.floor(age / HOUR_MS)}h ago`;
  }
  return `${Math.floor(age / DAY_MS)}d ago`;
};

const explain = (tab: TabInfo) => {
  const text = [tab.message, ...tab.log].join('\n');
  return FRIENDLY.find(([pattern]) => pattern.test(text))?.[1] ?? tab.message;
};

enum Route {
  Home = 'home',
  Settings = 'settings',
  NewProject = 'new-project'
}

const PORT_MIN = 1024;
const PORT_MAX = 65535;
const DEFAULT_CUSTOM_PORT = 4100;
const AUTO_PORT = 0;

let route = Route.Home;
let overlayOn = false;
let menuOpen = false;
let rendered = new Set<string>();
let lastState: ShellState | null = null;
let shownKey = '';

const tabChip = (tab: TabInfo, active: boolean, fresh: boolean) => {
  const close = el('span', { class: 'x', html: CROSS, title: 'close', on: run(() => bridge.closeTab(tab.id)) });
  close.addEventListener('click', (event) => event.stopPropagation());
  const chip = el('button', { class: `tab${active ? ' on' : ''}${fresh ? ' fresh' : ''}`, on: run(() => bridge.activate(tab.id)) }, el('span', { class: `dot ${tab.status === TabStatus.Choosing ? 'starting' : tab.status}` }), el('span', { class: 'name', text: tab.name }), close);
  return chip;
};

const toggleMenu = (open: boolean) => {
  menuOpen = open;
  syncOverlay();
  if (lastState) {
    render(lastState);
  }
};

const showRoute = (next: Route) => {
  route = next;
  menuOpen = false;
  syncOverlay();
  if (lastState) {
    render(lastState);
  }
};

const syncOverlay = () => {
  const wanted = menuOpen || route === Route.Settings || lastState?.onboarded === false;
  if (wanted !== overlayOn) {
    overlayOn = wanted;
    void bridge.overlay(wanted);
  }
};

const accountChip = (state: ShellState) => {
  const label = state.email ?? 'guest';
  const avatar = el('span', { class: `avatar${state.email ? '' : ' guest'}`, text: label[0] });
  return el('button', { class: 'chip', on: () => toggleMenu(!menuOpen) }, avatar, el('span', { text: label }));
};

const menuRow = (label: string, on: () => void, hint = '') => el('button', { class: 'row', on }, el('span', { text: label }), el('span', { class: 'hint', text: hint }));

const shortcuts = () => platformRow(document.documentElement.dataset.platform ?? '').shortcuts;

const UPDATE_HINTS: Record<UpdateState, string> = {
  [UpdateState.Idle]: '',
  [UpdateState.Checking]: 'checking…',
  [UpdateState.Downloading]: 'downloading…',
  [UpdateState.Ready]: 'ready',
  [UpdateState.UpToDate]: 'up to date',
  [UpdateState.Failed]: 'failed'
};

const updateHint = (state: ShellState) => UPDATE_HINTS[state.update.state];

const updatePill = (state: ShellState) =>
  state.update.state === UpdateState.Ready ? [el('button', { class: 'update-pill', title: state.update.message, on: run(() => bridge.installUpdate()) }, el('span', { class: 'dot ready' }), el('span', { text: 'update ready · restart' }))] : [];

const INVITE_TEXT = 'Create a free account to keep your recent projects and get new templates';

const invitePill = (state: ShellState) =>
  state.invite
    ? [el('div', { class: 'invite' }, el('span', { class: 'text', text: INVITE_TEXT, title: INVITE_TEXT }), pill('sign in', 'primary small', run(() => bridge.signIn())), pill('later', 'outline small', run(() => bridge.dismissInvite())))]
    : [];

const accountMenu = (state: ShellState) => {
  const label = state.email ?? 'guest · not signed in';
  const who = el('div', { class: 'who' }, el('span', { class: `avatar${state.email ? '' : ' guest'}`, text: (state.email ?? 'guest')[0] }), el('span', { class: 'label', text: label }));
  const account = state.email ? menuRow('account settings', run(() => bridge.openLink(Link.Account)), '↗') : el('button', { class: 'pill primary small signin', text: 'sign in', on: run(() => bridge.signIn()) });
  const rows = [
    who,
    account,
    menuRow('settings', () => showRoute(Route.Settings), shortcuts().settings),
    menuRow('check for updates', run(() => bridge.checkUpdates()), updateHint(state)),
    menuRow('docs', run(() => bridge.openLink(Link.Docs)), '↗'),
    menuRow('community', run(() => bridge.openLink(Link.Community)), '↗'),
    el('div', { class: 'divider' }),
    ...(state.email ? [menuRow('sign out', run(() => bridge.signOut()))] : []),
    menuRow('quit feega', run(() => bridge.quit()), shortcuts().quit)
  ];
  return el('div', { class: 'menu' }, ...rows);
};

const switchEl = (on: boolean, change: (next: boolean) => void) => {
  const knob = el('span', { class: 'knob' });
  const node = el('button', { class: `switch${on ? ' on' : ''}`, on: () => change(!on) }, knob);
  node.setAttribute('role', 'switch');
  node.setAttribute('aria-checked', String(on));
  return node;
};

const settingRow = (title: string, hint: string, control: HTMLElement) => el('div', { class: 'setting' }, el('div', {}, el('div', { class: 'title', text: title }), el('div', { class: 'desc', text: hint })), control);

const portControl = (editorPort: number) => {
  const custom = editorPort > 0;
  const input = el('input', { class: `port${custom ? '' : ' hidden'}` }) as HTMLInputElement;
  input.type = 'number';
  input.min = String(PORT_MIN);
  input.max = String(PORT_MAX);
  input.value = custom ? String(editorPort) : String(DEFAULT_CUSTOM_PORT);
  input.addEventListener('change', () => void bridge.setPreferences({ editorPort: Math.min(PORT_MAX, Math.max(PORT_MIN, Number(input.value) || DEFAULT_CUSTOM_PORT)) }));
  input.addEventListener('keydown', (event) => event.stopPropagation());
  const auto = el('button', { class: `seg${custom ? '' : ' on'}`, text: 'auto', on: run(() => bridge.setPreferences({ editorPort: AUTO_PORT })) });
  const own = el('button', { class: `seg${custom ? ' on' : ''}`, text: 'custom', on: run(() => bridge.setPreferences({ editorPort: DEFAULT_CUSTOM_PORT })) });
  return el('div', { class: 'port-control' }, input, el('div', { class: 'segmented' }, auto, own));
};

const settingsPanel = (state: ShellState) => {
  const { editorPort, reopenOnLaunch, telemetry, automaticUpdates, cloud } = state.preferences;
  return el(
    'div',
    { class: 'panel' },
    settingRow('editor port', 'port of the first editor. more tabs take the next free one.', portControl(editorPort)),
    settingRow('open last projects on launch', 'reopen the folders that were open when you quit.', switchEl(reopenOnLaunch, (next) => void bridge.setPreferences({ reopenOnLaunch: next }))),
    settingRow('automatic updates', 'check for a new version on launch and every few hours.', switchEl(automaticUpdates, (next) => void bridge.setPreferences({ automaticUpdates: next }))),
    settingRow('Feega Cloud (beta)', 'share and comment through Feega Cloud. applies to editors opened from now on.', switchEl(cloud, (next) => void bridge.setPreferences({ cloud: next }))),
    settingRow('onboarding', 'walk through the welcome steps again.', pill('show again', 'outline small', run(() => bridge.replayOnboarding()))),
    settingRow('anonymous usage data', 'counts only, never your code. off starts the editor with FEEGA_TELEMETRY=0.', switchEl(telemetry, (next) => void bridge.setPreferences({ telemetry: next })))
  );
};

const settingsView = (state: ShellState): View => ({
  key: 'settings',
  build: () => el('div', { class: 'dash' }, el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker', text: 'feega desktop' }), el('h1', { class: 'display page-title', text: 'settings' })), pill('done', 'primary', () => showRoute(Route.Home))), settingsPanel(state)),
  patch: (root) => {
    const typing = root.querySelector('input:focus');
    if (!typing) {
      root.querySelector('.panel')?.replaceWith(settingsPanel(state));
    }
  }
});

const renderBar = (state: ShellState) => {
  const known = rendered;
  rendered = new Set(state.tabs.map((t) => t.id));
  const home = el('button', { class: `home${state.active === null ? ' on' : ''}`, html: mark(), title: 'projects', on: run(() => bridge.activate(null)) });
  const add = el('button', { class: 'add', html: PLUS, title: 'new project or open folder', on: run(() => bridge.activate(null)) });
  bar.replaceChildren(home, ...state.tabs.map((tab) => tabChip(tab, tab.id === state.active, !known.has(tab.id))), add, el('span', { class: 'grow' }), ...invitePill(state), ...updatePill(state), accountChip(state));
  document.querySelector('.menu')?.remove();
  if (menuOpen) {
    document.body.append(accountMenu(state));
  }
};

const art = (name: string, size: number, extra = '') => el('span', { class: `art ${extra}`.trim(), html: pixelSvg(PIXELS[name], size) });

const FRAMEWORK_LOGO: Record<string, Logo> = {
  next: 'Next',
  nuxt: 'Nuxt',
  sveltekit: 'Svelte',
  svelte: 'Svelte',
  astro: 'Astro',
  react: 'React',
  'react router': 'ReactRouter',
  vue: 'Vue',
  vite: 'Vite'
};

const badge = (framework: string) => {
  const logo = FRAMEWORK_LOGO[framework];
  const icon = logo ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${LOGO_PATHS[logo]}"/></svg>` : '';
  return el('span', { class: 'badge', html: `${icon}<span>${framework}</span>` });
};

const recentCard = (recent: RecentInfo, index: number) => {
  const card = el(
    'button',
    { class: 'card', on: run(() => bridge.openDir(recent.dir)) },
    el('div', {}, el('div', { class: 'name', text: recent.name }), el('div', { class: 'path', text: tidyPath(recent.dir) })),
    el('div', { class: 'meta' }, badge(recent.framework), el('span', { text: ago(recent.at) }))
  );
  card.style.setProperty('animation-delay', `${(index + 1) * STAGGER_MS}ms`);
  return card;
};

const OPEN_HINT = 'open a web app folder. feega starts its dev server and opens the editor.';
const OPEN_HINT_SHORT = 'pick a web app on your machine';

const openCard = (alone: boolean) =>
  el(
    'button',
    { class: `card open${alone ? ' wide' : ''}`, on: run(() => bridge.pickFolder()) },
    art('folder', alone ? 10 : 6),
    el('div', {}, el('div', { class: 'name', text: 'open folder' }), el('div', { class: 'hint', text: alone ? OPEN_HINT : OPEN_HINT_SHORT }))
  );

const NEW_PROJECT_LOGOS: Logo[] = ['Next', 'Nuxt', 'Svelte', 'Astro', 'React', 'Vue'];

const logoRow = () => el('span', { class: 'logos', html: NEW_PROJECT_LOGOS.map((logo) => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${LOGO_PATHS[logo]}"/></svg>`).join('') });

const newProjectCard = (alone: boolean) =>
  el(
    'button',
    { class: `card open new${alone ? ' wide' : ''}`, on: () => showRoute(Route.NewProject) },
    logoRow(),
    el('div', {}, el('div', { class: 'name', text: 'new project' }), el('div', { class: 'hint', text: 'pick a framework and a template. feega sets it up and opens the editor.' }))
  );

const dashboardView = (state: ShellState): View => ({
  key: 'dashboard',
  build: () =>
    el(
      'div',
      { class: 'dash' },
      el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker', text: 'feega desktop' }), el('h1', { class: 'display page-title', text: 'projects' })), el('div', { class: 'actions' }, pill('open folder', 'outline', run(() => bridge.pickFolder())), pill('new project', 'primary', () => showRoute(Route.NewProject)))),
      el('div', { class: 'grid' }, el('div', { class: 'starts' }, newProjectCard(state.recents.length === 0), openCard(state.recents.length === 0)), ...state.recents.map(recentCard))
    )
});

const STEP_TEXT: Record<Step, string> = {
  [Step.Files]: 'writing the project',
  [Step.Plugin]: 'connecting feega to the source',
  [Step.Install]: 'installing packages',
  [Step.Done]: 'opening the editor'
};

type Draft = { stack: Stack; template: Template; name: string; parent: string };

const draft: Draft = { stack: Stack.ReactVite, template: Template.Landing, name: '', parent: '' };

const logoSvg = (logo: Logo) => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${LOGO_PATHS[logo]}"/></svg>`;

const STACK_LOGO: Record<Stack, Logo> = {
  [Stack.ReactVite]: 'React',
  [Stack.Next]: 'Next',
  [Stack.SvelteKit]: 'Svelte',
  [Stack.VueVite]: 'Vue',
  [Stack.Astro]: 'Astro',
  [Stack.Nuxt]: 'Nuxt'
};

const choiceRow = <T extends string>(options: [T, string][], current: T, choose: (value: T) => void, logos: Partial<Record<T, Logo>> = {}) =>
  el('div', { class: 'choices' }, ...options.map(([value, label]) => {
    const logo = logos[value];
    const html = logo ? `${logoSvg(logo)}<span>${label}</span>` : `<span>${label}</span>`;
    return el('button', { class: `choice${value === current ? ' on' : ''}`, html, on: () => choose(value) });
  }));

const rerender = () => {
  shownKey = '';
  if (lastState) {
    render(lastState);
  }
};

const FRAMEWORK_BADGE: Record<Stack, string> = {
  [Stack.ReactVite]: 'react',
  [Stack.Next]: 'next',
  [Stack.SvelteKit]: 'sveltekit',
  [Stack.VueVite]: 'vue',
  [Stack.Astro]: 'astro',
  [Stack.Nuxt]: 'nuxt'
};

const templateHint = (template: Template) => (TEMPLATES[template].length ? `${TEMPLATES[template].length} library sections` : 'an empty page');

const newProjectView = (state: ShellState): View => ({
  key: 'new-project',
  build: () => {
    draft.parent = draft.parent || state.documents;
    const name = el('input', { class: 'text-input' }) as HTMLInputElement;
    name.placeholder = 'my-site';
    name.value = draft.name;
    name.addEventListener('input', () => (draft.name = name.value));
    name.addEventListener('keydown', (event) => event.stopPropagation());
    const create = () => {
      if (!draft.name.trim()) {
        name.focus();
        return;
      }
      void bridge.createProject({ parent: draft.parent, name: draft.name, stack: draft.stack, template: draft.template }).then(() => showRoute(Route.Home));
    };
    const frameworks = choiceRow(Object.values(Stack).map((stack): [Stack, string] => [stack, STACKS[stack].label]), draft.stack, (stack) => ((draft.stack = stack), rerender()), STACK_LOGO);
    const templates = choiceRow(Object.values(Template).map((template): [Template, string] => [template, TEMPLATE_LABELS[template]]), draft.template, (template) => ((draft.template = template), rerender()));
    const folder = el('button', { class: 'pill outline small', text: tidyPath(draft.parent), title: draft.parent, on: run(async () => ((draft.parent = (await bridge.pickParent()) ?? draft.parent), rerender())) });
    return el(
      'div',
      { class: 'dash' },
      el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker', text: 'feega desktop' }), el('h1', { class: 'display page-title', text: 'new project' })), pill('cancel', 'outline', () => showRoute(Route.Home))),
      el('div', { class: 'panel form' }, el('div', { class: 'field' }, el('div', { class: 'title', text: 'framework' }), frameworks), el('div', { class: 'field' }, el('div', { class: 'title', text: 'template' }), templates, el('div', { class: 'desc', text: templateHint(draft.template) })), el('div', { class: 'field' }, el('div', { class: 'title', text: 'name' }), name), el('div', { class: 'field' }, el('div', { class: 'title', text: 'folder' }), folder), el('div', { class: 'actions' }, pill('create project', 'primary', create)))
    );
  },
  patch: () => undefined
});

const creatingView = (state: ShellState): View => ({
  key: 'creating',
  build: () => {
    const project = state.project!;
    return el('div', { class: 'screen' }, art('start', 8, 'float'), el('h1', { class: 'display load-name', text: project.name }), el('div', { class: 'track' }), el('div', { class: 'line', text: STEP_TEXT[project.step as Step] ?? project.step }), el('div', { class: 'line sub', text: project.line }));
  },
  patch: (root) => {
    const lines = root.querySelectorAll('.line');
    lines[0].textContent = STEP_TEXT[(state.project?.step ?? '') as Step] ?? '';
    lines[1].textContent = state.project?.line ?? '';
  }
});

const projectFailedView = (state: ShellState): View => ({
  key: 'project-failed',
  build: () =>
    el('div', { class: 'screen' }, art('help', 8), el('div', { class: 'err-title' }, el('span', { class: 'dot failed' }), el('span', { text: 'could not create the project' })), el('h1', { class: 'display load-name', text: state.project!.name }), el('p', { class: 'err-msg', text: state.project!.error }), el('div', { class: 'actions' }, pill('back', 'primary', run(async () => (await bridge.clearProject(), showRoute(Route.NewProject))))))
});

const nodeView = (state: ShellState): View => ({
  key: `node:${state.node.message}`,
  build: () =>
    el('div', { class: 'screen' }, art('help', 8), el('div', { class: 'err-title' }, el('span', { class: 'dot failed' }), el('span', { text: 'node.js needed' })), el('h1', { class: 'display load-name', text: 'install node.js' }), el('p', { class: 'err-msg', text: state.node.message }), el('div', { class: 'actions' }, pill('install node.js', 'primary', run(() => bridge.openLink(Link.Node))), pill('check again', 'outline', run(() => bridge.checkNode()))))
});

const checkingView: View = { key: 'checking', build: () => el('div', { class: 'screen' }, art('start', 8, 'float'), el('div', { class: 'track' }), el('div', { class: 'line', text: 'checking node.js' })) };

const loadingView = (tab: TabInfo): View => ({
  key: `loading:${tab.id}`,
  build: () => el('div', { class: 'screen' }, art('start', 8, 'float'), el('h1', { class: 'display load-name', text: tab.name }), el('div', { class: 'track' }), el('div', { class: 'line', text: tab.message })),
  patch: (root) => {
    const line = root.querySelector('.line');
    if (line) {
      line.textContent = tab.message;
    }
  }
});

const pickerView = (tab: TabInfo): View => ({
  key: `choosing:${tab.id}`,
  build: () => {
    const cards = tab.apps.map((app, index) => {
      const card = el('button', { class: 'card app', on: run(() => bridge.chooseApp(tab.id, app.app)) }, el('div', { class: 'name', text: app.label }), el('div', { class: 'meta' }, badge(app.framework), el('span', { text: 'start editing' })));
      card.style.setProperty('animation-delay', `${(index + 1) * STAGGER_MS}ms`);
      return card;
    });
    return el('div', { class: 'dash' }, el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker' }, art('stack', 3), `${tab.name} holds ${tab.apps.length} apps`), el('h1', { class: 'display page-title', text: 'which one?' }))), el('div', { class: 'grid' }, ...cards));
  }
});

const failedView = (tab: TabInfo): View => ({
  key: `failed:${tab.id}`,
  build: () => {
    const log = el('details', {}, el('summary', { text: 'show log' }), el('pre', { text: tab.log.join('\n') || tab.message }));
    return el(
      'div',
      { class: 'screen' },
      art('help', 8),
      el('div', { class: 'err-title' }, el('span', { class: 'dot failed' }), el('span', { text: 'could not start' })),
      el('h1', { class: 'display load-name', text: tab.name }),
      el('p', { class: 'err-msg', text: explain(tab) }),
      el('div', { class: 'actions' }, pill('retry', 'primary', run(() => bridge.retryTab(tab.id))), pill('close', 'outline', run(() => bridge.closeTab(tab.id)))),
      log
    );
  }
});

const TAB_VIEWS: Record<TabStatus, (tab: TabInfo) => View> = {
  [TabStatus.Starting]: loadingView,
  [TabStatus.Choosing]: pickerView,
  [TabStatus.Failed]: failedView,
  [TabStatus.Ready]: (tab) => ({ key: `ready:${tab.id}`, build: () => el('div') })
};

const onboardingDeps: OnboardingDeps = {
  signIn: () => bridge.signIn(),
  cancelSignIn: () => bridge.cancelSignIn(),
  openUrl: (url) => bridge.openUrl(url),
  copy: (text) => bridge.copy(text),
  finish: async () => {
    route = Route.Home;
    await bridge.finishOnboarding();
  },
  changed: () => lastState && render(lastState)
};

const viewOf = (state: ShellState): View => {
  if (!state.onboarded) {
    return onboardingView(state, onboardingDeps);
  }
  if (state.node.status === NodeStatus.Problem) {
    return nodeView(state);
  }
  if (state.project) {
    return state.project.error ? projectFailedView(state) : creatingView(state);
  }
  if (route === Route.Settings) {
    return settingsView(state);
  }
  const tab = state.tabs.find((t) => t.id === state.active);
  if (tab) {
    return TAB_VIEWS[tab.status](tab);
  }
  if (state.node.status === NodeStatus.Checking && state.tabs.length === 0) {
    return checkingView;
  }
  return route === Route.NewProject ? newProjectView(state) : dashboardView(state);
};

const renderMain = (state: ShellState) => {
  const view = viewOf(state);
  const current = main.firstElementChild as HTMLElement | null;
  if (current && view.key === shownKey && view.patch) {
    view.patch(current);
    return;
  }
  const root = view.build();
  if (view.key !== shownKey) {
    root.classList.add('enter');
  }
  shownKey = view.key;
  main.replaceChildren(root);
};

function render(state: ShellState) {
  lastState = state;
  syncOverlay();
  renderBar(state);
  renderMain(state);
}

document.addEventListener('click', (event) => {
  if (menuOpen && !(event.target as HTMLElement).closest('.menu, .chip')) {
    toggleMenu(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (lastState?.onboarded === false) {
      skipOnboarding(onboardingDeps);
      return;
    }
    if (menuOpen) {
      toggleMenu(false);
      return;
    }
    if (route === Route.Settings) {
      showRoute(Route.Home);
    }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === ',') {
    showRoute(Route.Settings);
  }
});

bridge.onSettings(() => showRoute(Route.Settings));
bridge.onState(render);
void bridge.state().then(render);
