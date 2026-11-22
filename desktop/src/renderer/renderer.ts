import { LOGO_PATHS, type Logo } from '../../../landing/src/lib/site/codebase/logos';
import { platformRow } from '../main/platform';
import { PIXELS, pixelSvg } from './pixel';
import { Link, TabStatus, UpdateState, type RecentInfo, type ShellState, type TabInfo } from '../main/types';

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
  onSettings: (listener: () => void) => void;
  onState: (listener: (state: ShellState) => void) => void;
};

type View = { key: string; build: () => HTMLElement; patch?: (root: HTMLElement) => void };

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
const HERO_TITLE = 'start designing in your codebase';
const HERO_LEAD = 'edit your running app like in figma. every change lands in your source.';
const FACTS = ['free, forever', 'every edit a diff', 'no AI, no tokens'];

const FRIENDLY: [RegExp, string][] = [
  [/several apps here/i, 'this folder holds several apps. open one of them directly.'],
  [/no web app/i, 'no web app (package.json) found in this folder.'],
  [/EADDRINUSE/i, 'a port needed by the dev server is already in use.'],
  [/not found|ENOENT/i, 'something the dev server needs was not found.']
];

type Props = { class?: string; text?: string; html?: string; on?: () => void; title?: string };

const el = (tag: string, props: Props = {}, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  node.className = props.class ?? '';
  if (props.text !== undefined) {
    node.textContent = props.text;
  }
  if (props.html !== undefined) {
    node.innerHTML = props.html;
  }
  if (props.title) {
    node.title = props.title;
  }
  if (props.on) {
    node.addEventListener('click', props.on);
  }
  node.append(...children);
  return node;
};

const run = (action: () => Promise<unknown>) => () => void action();

const pill = (text: string, kind: string, on: () => void) => el('button', { class: `pill ${kind}`, text, on });

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
  Settings = 'settings'
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
  const wanted = menuOpen || route === Route.Settings;
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
  const { editorPort, reopenOnLaunch, telemetry, automaticUpdates } = state.preferences;
  return el(
    'div',
    { class: 'panel' },
    settingRow('editor port', 'port of the first editor. more tabs take the next free one.', portControl(editorPort)),
    settingRow('open last projects on launch', 'reopen the folders that were open when you quit.', switchEl(reopenOnLaunch, (next) => void bridge.setPreferences({ reopenOnLaunch: next }))),
    settingRow('automatic updates', 'check for a new version on launch and every few hours.', switchEl(automaticUpdates, (next) => void bridge.setPreferences({ automaticUpdates: next }))),
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
  if (!state.email && !state.skipped && state.tabs.length === 0) {
    bar.replaceChildren(el('span', { class: 'brand', html: `${mark(22)}<span>feega</span>` }), el('span', { class: 'grow' }));
    return;
  }
  const known = rendered;
  rendered = new Set(state.tabs.map((t) => t.id));
  const home = el('button', { class: `home${state.active === null ? ' on' : ''}`, html: mark(), title: 'projects', on: run(() => bridge.activate(null)) });
  const add = el('button', { class: 'add', html: PLUS, title: 'open folder', on: run(() => bridge.pickFolder()) });
  bar.replaceChildren(home, ...state.tabs.map((tab) => tabChip(tab, tab.id === state.active, !known.has(tab.id))), add, el('span', { class: 'grow' }), ...updatePill(state), accountChip(state));
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

const startView = (state: ShellState): View => ({
  key: `start:${state.signingIn}`,
  build: () => {
    const actions = state.signingIn
      ? [el('button', { class: 'pill waiting', text: 'waiting for your browser…' }), pill('cancel', 'outline', run(() => bridge.cancelSignIn()))]
      : [pill('sign in', 'primary', run(() => bridge.signIn())), pill('continue without account', 'outline', run(() => bridge.skip()))];
    return el('div', { class: 'screen banded' }, el('h1', { class: 'display serif hero-title', text: HERO_TITLE }), el('p', { class: 'lead', text: HERO_LEAD }), el('div', { class: 'actions' }, ...actions), el('ul', { class: 'facts' }, ...FACTS.map((fact) => el('li', { text: fact }))), el('div', { class: 'band' }));
  }
});

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
    art('start', alone ? 10 : 6),
    el('div', {}, el('div', { class: 'name', text: 'open folder' }), el('div', { class: 'hint', text: alone ? OPEN_HINT : OPEN_HINT_SHORT }))
  );

const dashboardView = (state: ShellState): View => ({
  key: 'dashboard',
  build: () =>
    el(
      'div',
      { class: 'dash' },
      el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker', text: 'feega desktop' }), el('h1', { class: 'display page-title', text: 'projects' })), pill('open folder', 'primary', run(() => bridge.pickFolder()))),
      el('div', { class: 'grid' }, openCard(state.recents.length === 0), ...state.recents.map(recentCard))
    )
});

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

const viewOf = (state: ShellState): View => {
  if (route === Route.Settings) {
    return settingsView(state);
  }
  const tab = state.tabs.find((t) => t.id === state.active);
  if (tab) {
    return TAB_VIEWS[tab.status](tab);
  }
  return !state.email && !state.skipped ? startView(state) : dashboardView(state);
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
