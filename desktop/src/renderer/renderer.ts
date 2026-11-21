import { TabStatus, type ShellState, type TabInfo } from '../main/types';

type Bridge = {
  state: () => Promise<ShellState>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  skip: () => Promise<void>;
  pickFolder: () => Promise<void>;
  openDir: (dir: string) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  activate: (id: string | null) => Promise<void>;
  onState: (listener: (state: ShellState) => void) => void;
};

const bridge = (window as unknown as { feega: Bridge }).feega;
const bar = document.getElementById('bar') as HTMLElement;
const main = document.getElementById('main') as HTMLElement;

type Props = { class?: string; text?: string; on?: () => void };

const el = (tag: string, props: Props = {}, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  node.className = props.class ?? '';
  node.textContent = props.text ?? '';
  if (props.on) {
    node.addEventListener('click', props.on);
  }
  node.append(...children);
  return node;
};

const button = (text: string, className: string, on: () => void) => el('button', { class: className, text, on });

const tabChip = (tab: TabInfo, active: boolean) => {
  const close = el('span', { class: 'x', text: '×', on: () => void bridge.closeTab(tab.id) });
  close.addEventListener('click', (event) => event.stopPropagation());
  const chip = el('button', { class: `chip${active ? ' on' : ''}`, on: () => void bridge.activate(tab.id) }, el('span', { class: `dot ${tab.status}` }), el('span', { class: 'name', text: tab.name }), close);
  return chip;
};

const renderBar = (state: ShellState) => {
  const home = button('feega', `chip${state.active === null ? ' on' : ''}`, () => void bridge.activate(null));
  const add = button('+', 'chip', () => void bridge.pickFolder());
  bar.replaceChildren(home, ...state.tabs.map((tab) => tabChip(tab, tab.id === state.active)), add, el('span', { class: 'grow' }), ...(state.email ? [el('span', { class: 'sub', text: state.email })] : []));
};

const startScreen = () =>
  el(
    'div',
    { class: 'screen' },
    el('h1', { class: 'mega', text: 'feega' }),
    el('p', { class: 'sub', text: 'design in your codebase' }),
    el('div', { class: 'row' }, button('sign in', 'cta', () => void bridge.signIn()), button('continue without account', 'ghost', () => void bridge.skip()))
  );

const recentItem = (dir: string) => el('button', { class: 'item', on: () => void bridge.openDir(dir) }, el('span', { text: dir.split('/').filter(Boolean).at(-1) ?? dir }), el('span', { class: 'path', text: dir }));

const dashboard = (state: ShellState) => {
  const account = state.email ? button('sign out', 'ghost', () => void bridge.signOut()) : button('sign in', 'ghost', () => void bridge.signIn());
  const items = state.recents.length ? state.recents.map(recentItem) : [el('div', { class: 'empty', text: 'no recent folders' })];
  return el(
    'div',
    { class: 'dash' },
    el('div', { class: 'head' }, el('h1', { class: 'mega', text: 'folders' }), el('div', { class: 'row' }, account, button('open folder', 'cta', () => void bridge.pickFolder()))),
    el('div', { class: 'list' }, ...items)
  );
};

const tabScreen = (tab: TabInfo) =>
  el('div', { class: 'screen' }, el('h1', { class: 'mega', text: tab.status === TabStatus.Failed ? 'failed' : 'starting' }), el('p', { class: 'log', text: tab.message }));

const renderMain = (state: ShellState) => {
  const tab = state.tabs.find((t) => t.id === state.active);
  if (tab) {
    main.replaceChildren(tab.status === TabStatus.Ready ? el('div') : tabScreen(tab));
    return;
  }
  const signedOut = !state.email && !state.skipped;
  main.replaceChildren(signedOut ? startScreen() : dashboard(state));
};

const render = (state: ShellState) => {
  renderBar(state);
  renderMain(state);
};

bridge.onState(render);
void bridge.state().then(render);
