import { CANVAS_CSS, CANVAS_ID } from './focus.js';
import { gridOf } from './variant-grid.js';

import { DATE_MARK, FUNCTION_MARK, JSX_MARK, MOUNT_CONTROLS, MOUNT_PROPS, MOUNT_STATUS, Status, TEXT_MARK } from './mount-protocol.js';

export const Reason = { NoExport: 'The component is not exported', Empty: 'It rendered nothing' };

const SETTLE_MS = 350;
const HARMLESS_ERROR = /ResizeObserver loop/i;
const GIVE_UP_MS = 8000;
const GAP_PX = 24;
const CAPTION_PX = 11;
const FIT_PARAM = 'fit';
const FIT_PADDING_PX = 16;
const FIT_CSS = `body{padding:${FIT_PADDING_PX}px!important}`;

const MARKS = [
  { mark: FUNCTION_MARK, matches: (value) => value === true, revive: () => () => undefined },
  { mark: JSX_MARK, matches: (value) => value === true, revive: () => undefined },
  { mark: TEXT_MARK, matches: (value) => typeof value === 'string', revive: (value) => value },
  { mark: DATE_MARK, matches: (value) => typeof value === 'string', revive: (value) => new Date(value) }
];

function reviveValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const marked = MARKS.find(({ mark, matches }) => matches(value[mark]));
  return marked ? marked.revive(value[marked.mark]) : value;
}

export function reviveProps(props) {
  return Object.fromEntries(Object.entries(props ?? {}).map(([name, value]) => [name, reviveValue(value)]));
}

export const rendersNothing = (container) => container.querySelector('*') === null && container.textContent.trim() === '';

function propsFor(base, extra) {
  return reviveProps({ ...base, ...extra });
}

export function runMount({ Target, name, file, props, controlsUrl, win = window, render, giveUpMs = GIVE_UP_MS }) {
  const doc = win.document;
  const container = doc.getElementById('root');
  const style = doc.createElement('style');
  style.id = CANVAS_ID;
  const fits = new URLSearchParams(win.location.search).has(FIT_PARAM);
  style.textContent = fits ? CANVAS_CSS + FIT_CSS : CANVAS_CSS;
  doc.head.append(style);

  const send = (message) => win.parent.postMessage(message, '*');
  const askedControls = () => win.fetch(controlsUrl).then((r) => r.json()).then((body) => body.controls).catch(() => null);
  let controlsSent = false;
  const sendControls = async () => {
    if (controlsSent) {
      return;
    }
    controlsSent = true;
    send({ type: MOUNT_CONTROLS, controls: await askedControls() });
  };
  const post = (message) => {
    send({ type: MOUNT_STATUS, ...message });
    if (message.status === Status.Failed && message.reason !== Reason.NoExport) {
      void sendControls();
    }
  };
  if (!Target) {
    post({ status: Status.Failed, reason: Reason.NoExport });
    return;
  }

  let ready = false;
  let current = { props, variants: null };
  const fail = (reason) => post({ status: ready ? Status.Error : Status.Failed, reason });
  const draw = render({ container, fail });

  const breaksMount = (event) => !ready && !HARMLESS_ERROR.test(String(event.message)) && rendersNothing(container);
  win.addEventListener('error', (event) => breaksMount(event) && post({ status: Status.Failed, reason: String(event.message) }));
  win.addEventListener('message', (event) => {
    if (event.data?.type === MOUNT_PROPS) {
      current = { props: event.data.props ?? current.props, variants: event.data.variants ?? null };
      draw(current);
    }
  });

  draw(current);
  const started = Date.now();
  const settle = async () => {
    if (rendersNothing(container)) {
      if (Date.now() - started < giveUpMs) {
        win.setTimeout(settle, SETTLE_MS);
        return;
      }
      post({ status: Status.Failed, reason: Reason.Empty });
      return;
    }
    const controls = await askedControls();
    ready = true;
    const box = container.getBoundingClientRect();
    const padding = fits ? FIT_PADDING_PX * 2 : 0;
    post({ status: Status.Ready, name, file, controls, props: current.props, size: { width: Math.ceil(box.width) + padding, height: Math.ceil(box.height) + padding } });
  };
  win.setTimeout(settle, SETTLE_MS);
}

export function startMount({ react, createRoot, mod, name, file, props, providers, controlsUrl, win = window, giveUpMs }) {
  const { createElement, Component, Fragment } = react;
  const Target = mod[name] ?? mod.default;

  const render = ({ container, fail }) => {
    let version = 0;

    class Boundary extends Component {
      state = { error: null };
      static getDerivedStateFromError(error) {
        return { error };
      }
      componentDidCatch(error) {
        fail(String(error?.message ?? error));
      }
      render() {
        return this.state.error ? null : this.props.children;
      }
    }

    const cell = (variant, current) => createElement('div', { key: variant.label, 'data-feega-variant': variant.label }, createElement(Target, propsFor(current.props, variant.props)));
    const caption = (key, text) => createElement('span', { key, style: { font: `${CAPTION_PX}px system-ui`, color: '#888', whiteSpace: 'nowrap' } }, text);
    const grid = (current) => {
      const { columnName, columns, rows } = gridOf(current.variants);
      const style = { display: 'grid', gridTemplateColumns: `max-content repeat(${columns.length}, 1fr)`, gap: GAP_PX, alignItems: 'center', justifyItems: 'start', width: 'max-content' };
      const head = [createElement('span', { key: 'corner' }), ...columns.map((column) => caption(`c-${column}`, `${columnName}=${column}`))];
      const body = rows.flatMap((row, at) => [caption(`h-${at}`, row.header), ...row.cells.map((variant, i) => (variant ? cell(variant, current) : createElement('span', { key: `x-${at}-${i}` })))]);
      return createElement('div', { style }, ...head, ...body);
    };
    const view = (current) => (current.variants ? grid(current) : createElement(Target, propsFor(current.props)));
    const root = createRoot(container);

    return (current) => root.render(createElement(Boundary, { key: ++version }, createElement(providers ?? Fragment, null, view(current))));
  };

  runMount({ Target, name, file, props, controlsUrl, win, render, giveUpMs });
}
