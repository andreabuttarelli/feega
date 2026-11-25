import { reactTypeOf, stampSources } from './framework-meta.js';
import { rootOf } from './component-root.js';
import { MOUNT_STATUS, Status } from './mount-protocol.js';
import { startMount } from './mount-runtime.js';
import { requestOfHash } from './page-mount-url.js';

const NESTED_HOST = Symbol.for('feega.nested-host');
const STARTED = Symbol.for('feega.page-mount.started');
const POLL_MS = 100;
const GIVE_UP_MS = 15000;
const NOT_RENDERED = 'The page did not render the component';
const NO_MODULES = 'The bundle does not expose React';
const HIDE_PAGE_CSS = 'body > *:not(#root){display:none!important}';
const KIND = { string: 'text', number: 'number', boolean: 'toggle' };

export function controlsOfProps(props) {
  return Object.entries(props).flatMap(([name, value]) => (KIND[typeof value] ? [{ name, kind: KIND[typeof value], required: false, default: value }] : []));
}

const isReact = (exports) => typeof exports?.createElement === 'function' && exports.Component && exports.Fragment;
const isClient = (exports) => typeof exports?.createRoot === 'function';

export function webpackModules(win) {
  const chunks = win.webpackChunk_N_E;
  if (!chunks) {
    return null;
  }
  let registry = null;
  chunks.push([[Symbol('feega')], {}, (require) => (registry = require)]);
  const loaded = Object.values(registry?.c ?? {}).map((module) => module.exports);
  const react = loaded.find(isReact);
  const client = loaded.find(isClient);
  return react && client ? { react, createRoot: client.createRoot } : null;
}

const markNested = (win) => {
  win[NESTED_HOST] = true;
};

function containerIn(doc) {
  const style = doc.createElement('style');
  style.textContent = HIDE_PAGE_CSS;
  const container = doc.createElement('div');
  container.id = 'root';
  doc.head.append(style);
  doc.body.prepend(container);
}

export function startPageMount({ win, request, modules = () => webpackModules(win) }) {
  markNested(win);
  if (win[STARTED]) {
    return true;
  }
  stampSources(win.document);
  const root = rootOf(win.document, request.source, request.index);
  const Type = root && reactTypeOf(root);
  const loaded = Type && modules();
  if (!loaded) {
    return false;
  }
  win[STARTED] = true;
  containerIn(win.document);
  const controls = controlsOfProps(request.props);
  const controlsUrl = `data:application/json,${encodeURIComponent(JSON.stringify({ controls }))}`;
  startMount({ ...loaded, mod: { default: Type }, name: request.name, file: request.file, props: request.props, providers: null, controlsUrl, win });
  return true;
}

export function watchPageMount(win) {
  const request = requestOfHash(win.location.hash);
  if (!request) {
    return false;
  }
  markNested(win);
  const started = Date.now();
  const poll = () => {
    if (startPageMount({ win, request })) {
      return;
    }
    if (Date.now() - started > GIVE_UP_MS) {
      win.parent.postMessage({ type: MOUNT_STATUS, status: Status.Failed, reason: win.webpackChunk_N_E ? NOT_RENDERED : NO_MODULES }, '*');
      return;
    }
    win.setTimeout(poll, POLL_MS);
  };
  poll();
  return true;
}
