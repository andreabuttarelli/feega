import { CANVAS_CSS, CANVAS_ID } from './focus.js';

import { FUNCTION_MARK, MOUNT_PROPS, MOUNT_STATUS, Status } from './mount-protocol.js';

export const Reason = { NoExport: 'The component is not exported', Empty: 'It rendered nothing' };

const SETTLE_MS = 350;
const GAP_PX = 24;
const CAPTION_PX = 11;

const isMarkedFunction = (value) => value !== null && typeof value === 'object' && value[FUNCTION_MARK] === true;

export function reviveProps(props) {
  return Object.fromEntries(Object.entries(props ?? {}).map(([name, value]) => [name, isMarkedFunction(value) ? () => undefined : value]));
}

export const rendersNothing = (container) => container.querySelector('*') === null && container.textContent.trim() === '';

function propsFor(base, extra) {
  return reviveProps({ ...base, ...extra });
}

export function startMount({ react, createRoot, mod, name, file, props, providers, controlsUrl, win = window }) {
  const { createElement, Component, Fragment } = react;
  const doc = win.document;
  const container = doc.getElementById('root');
  const style = doc.createElement('style');
  style.id = CANVAS_ID;
  style.textContent = CANVAS_CSS;
  doc.head.append(style);

  const post = (message) => win.parent.postMessage({ type: MOUNT_STATUS, ...message }, '*');
  const Target = mod[name] ?? mod.default;
  if (!Target) {
    post({ status: Status.Failed, reason: Reason.NoExport });
    return;
  }

  let ready = false;
  let version = 0;
  let current = { props, variants: null };

  class Boundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error) {
      post({ status: ready ? Status.Error : Status.Failed, reason: String(error?.message ?? error) });
    }
    render() {
      return this.state.error ? null : this.props.children;
    }
  }

  const cell = (variant) => createElement('div', { key: variant.label, 'data-feega-variant': variant.label, style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 } }, createElement('span', { style: { font: `${CAPTION_PX}px system-ui`, color: '#666' } }, variant.label), createElement(Target, propsFor(current.props, variant.props)));

  const view = () => (current.variants ? createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: GAP_PX, alignItems: 'flex-start' } }, current.variants.map(cell)) : createElement(Target, propsFor(current.props)));

  const root = createRoot(container);
  const draw = () => root.render(createElement(Boundary, { key: ++version }, createElement(providers ?? Fragment, null, view())));

  win.addEventListener('error', (event) => !ready && post({ status: Status.Failed, reason: String(event.message) }));
  win.addEventListener('message', (event) => {
    if (event.data?.type === MOUNT_PROPS) {
      current = { props: event.data.props ?? current.props, variants: event.data.variants ?? null };
      draw();
    }
  });

  draw();
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
