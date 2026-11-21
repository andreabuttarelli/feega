import { TabStatus, type RecentInfo, type ShellState, type TabInfo } from '../main/types';

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

const tidyPath = (dir: string) => dir.replace(/^\/(Users|home)\/[^/]+/, '~');

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

const accountChip = (state: ShellState) => {
  const label = state.email ?? 'guest';
  const avatar = el('span', { class: `avatar${state.email ? '' : ' guest'}`, text: label[0] });
  return el('button', { class: 'chip', on: () => ((menuOpen = !menuOpen), lastState && render(lastState)) }, avatar, el('span', { text: label }));
};

const accountMenu = (state: ShellState) => {
  const action = state.email ? pill('sign out', 'ghost', run(() => bridge.signOut())) : pill('sign in', 'ghost', run(() => bridge.signIn()));
  action.className = '';
  return el('div', { class: 'menu' }, el('div', { class: 'who', text: state.email ?? 'not signed in' }), action);
};

const renderBar = (state: ShellState) => {
  if (!state.email && !state.skipped && state.tabs.length === 0) {
    bar.replaceChildren(el('span', { class: 'grow' }));
    return;
  }
  const known = rendered;
  rendered = new Set(state.tabs.map((t) => t.id));
  const home = el('button', { class: `home${state.active === null ? ' on' : ''}`, html: mark(), title: 'projects', on: run(() => bridge.activate(null)) });
  const add = el('button', { class: 'add', html: PLUS, title: 'open folder', on: run(() => bridge.pickFolder()) });
  bar.replaceChildren(home, ...state.tabs.map((tab) => tabChip(tab, tab.id === state.active, !known.has(tab.id))), add, el('span', { class: 'grow' }), accountChip(state));
  document.querySelector('.menu')?.remove();
  if (menuOpen) {
    document.body.append(accountMenu(state));
  }
};

const startView = (state: ShellState): View => ({
  key: `start:${state.signingIn}`,
  build: () => {
    const actions = state.signingIn
      ? [el('button', { class: 'pill primary waiting', text: 'waiting for your browser…' }), pill('cancel', 'ghost', run(() => bridge.cancelSignIn()))]
      : [pill('sign in', 'primary', run(() => bridge.signIn())), pill('continue without account', 'ghost', run(() => bridge.skip()))];
    return el('div', { class: 'screen' }, el('h1', { class: 'mega', text: 'feega' }), el('p', { class: 'tagline', text: 'design in your codebase' }), el('div', { class: 'actions' }, ...actions));
  }
});

const recentCard = (recent: RecentInfo, index: number) => {
  const card = el(
    'button',
    { class: 'card', on: run(() => bridge.openDir(recent.dir)) },
    el('div', {}, el('div', { class: 'name', text: recent.name }), el('div', { class: 'path', text: tidyPath(recent.dir) })),
    el('div', { class: 'meta' }, el('span', { class: 'badge', text: recent.framework }), el('span', { text: ago(recent.at) }))
  );
  card.style.setProperty('animation-delay', `${(index + 1) * STAGGER_MS}ms`);
  return card;
};

const openCard = () =>
  el('button', { class: 'card open', on: run(() => bridge.pickFolder()) }, el('span', { class: 'plus', html: PLUS }), el('div', {}, el('div', { class: 'name', text: 'open folder' }), el('div', { class: 'hint', text: 'pick a web app on your machine' })));

const dashboardView = (state: ShellState): View => ({
  key: 'dashboard',
  build: () => {
    const empty = el('div', { class: 'empty' }, el('strong', { text: 'no projects yet' }), el('span', { text: 'open a folder and it will show up here' }));
    return el(
      'div',
      { class: 'dash' },
      el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker', text: 'feega desktop' }), el('h1', { class: 'mega', text: 'projects' }))),
      el('div', { class: 'grid' }, openCard(), ...state.recents.map(recentCard)),
      ...(state.recents.length ? [] : [empty])
    );
  }
});

const loadingView = (tab: TabInfo): View => ({
  key: `loading:${tab.id}`,
  build: () => el('div', { class: 'screen' }, el('h1', { class: 'mega load-name', text: tab.name }), el('div', { class: 'track' }), el('div', { class: 'line', text: tab.message })),
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
      const card = el('button', { class: 'card', on: run(() => bridge.chooseApp(tab.id, app.app)) }, el('div', { class: 'name', text: app.label }), el('div', { class: 'meta' }, el('span', { class: 'badge', text: 'app' }), el('span', { text: 'start editing' })));
      card.style.setProperty('animation-delay', `${(index + 1) * STAGGER_MS}ms`);
      return card;
    });
    return el('div', { class: 'dash' }, el('div', { class: 'dash-head' }, el('div', {}, el('p', { class: 'kicker', text: `${tab.name} holds ${tab.apps.length} apps` }), el('h1', { class: 'mega', text: 'which one?' }))), el('div', { class: 'grid' }, ...cards));
  }
});

const failedView = (tab: TabInfo): View => ({
  key: `failed:${tab.id}`,
  build: () => {
    const log = el('details', {}, el('summary', { text: 'show log' }), el('pre', { text: tab.log.join('\n') || tab.message }));
    return el(
      'div',
      { class: 'screen' },
      el('div', { class: 'err-title' }, el('span', { class: 'dot failed' }), el('span', { text: 'could not start' })),
      el('h1', { class: 'mega load-name', text: tab.name }),
      el('p', { class: 'err-msg', text: explain(tab) }),
      el('div', { class: 'actions' }, pill('retry', 'primary', run(() => bridge.retryTab(tab.id))), pill('close', 'ghost', run(() => bridge.closeTab(tab.id)))),
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
  if (menuOpen && !(event.target as HTMLElement).closest('.menu, .chip') && lastState) {
    menuOpen = false;
    render(lastState);
  }
});

bridge.onState(render);
void bridge.state().then(render);
