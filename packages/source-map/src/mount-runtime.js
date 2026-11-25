import { CANVAS_CSS, CANVAS_ID } from './focus.js';

import { DATE_MARK, FUNCTION_MARK, MOUNT_PROPS, MOUNT_STATUS, Status } from './mount-protocol.js';

export const Reason = { NoExport: 'The component is not exported', Empty: 'It rendered nothing' };

const SETTLE_MS = 350;
const GAP_PX = 24;
const CAPTION_PX = 11;

const MARKS = [
  { mark: FUNCTION_MARK, matches: (value) => value === true, revive: () => () => undefined },
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

export function runMount({ Target, name, file, props, controlsUrl, win = window, render }) {
  const doc = win.document;
  const container = doc.getElementById('root');
  const style = doc.createElement('style');
  style.id = CANVAS_ID;
  style.textContent = CANVAS_CSS;
  doc.head.append(style);

  const post = (message) => win.parent.postMessage({ type: MOUNT_STATUS, ...message }, '*');
  if (!Target) {
    post({ status: Status.Failed, reason: Reason.NoExport });
    return;
  }

  let ready = false;
  let current = { props, variants: null };
  const fail = (reason) => post({ status: ready ? Status.Error : Status.Failed, reason });
  const draw = render({ container, fail });

  win.addEventListener('error', (event) => !ready && post({ status: Status.Failed, reason: String(event.message) }));
  win.addEventListener('message', (event) => {
    if (event.data?.type === MOUNT_PROPS) {
      current = { props: event.data.props ?? current.props, variants: event.data.variants ?? null };
      draw(current);
    }
  });

  draw(current);
  win.setTimeout(async () => {
    if (rendersNothing(container)) {
      post({ status: Status.Failed, reason: Reason.Empty });
      return;
    }
    const controls = await win.fetch(controlsUrl).then((r) => r.json()).then((body) => body.controls).catch(() => null);
    ready = true;
    post({ status: Status.Ready, name, file, controls, props: current.props });
  }, SETTLE_MS);
}

export function startMount({ react, createRoot, mod, name, file, props, providers, controlsUrl, win = window }) {
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

    const cell = (current, variant) => createElement('div', { key: variant.label, 'data-feega-variant': variant.label, style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 } }, createElement('span', { style: { font: `${CAPTION_PX}px system-ui`, color: '#666' } }, variant.label), createElement(Target, propsFor(current.props, variant.props)));
    const view = (current) => (current.variants ? createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: GAP_PX, alignItems: 'flex-start' } }, current.variants.map((variant) => cell(current, variant))) : createElement(Target, propsFor(current.props)));
    const root = createRoot(container);

    return (current) => root.render(createElement(Boundary, { key: ++version }, createElement(providers ?? Fragment, null, view(current))));
  };

  runMount({ Target, name, file, props, controlsUrl, win, render });
}
