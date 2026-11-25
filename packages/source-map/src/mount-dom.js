import { reviveProps, runMount } from './mount-runtime.js';

const GAP_PX = 24;
const CAPTION_PX = 11;
const CELL_GAP_PX = 8;

function element(doc, tag, css, text = '') {
  const node = doc.createElement(tag);
  node.style.cssText = css;
  node.textContent = text;
  return node;
}

function cellsOf(doc, container, current) {
  container.replaceChildren();
  if (!current.variants) {
    return [{ host: container, props: reviveProps(current.props) }];
  }
  const grid = element(doc, 'div', `display:flex;flex-wrap:wrap;gap:${GAP_PX}px;align-items:flex-start`);
  container.append(grid);
  return current.variants.map((variant) => {
    const cell = element(doc, 'div', `display:flex;flex-direction:column;align-items:flex-start;gap:${CELL_GAP_PX}px`);
    const host = element(doc, 'div', '');
    cell.dataset.feegaVariant = variant.label;
    cell.append(element(doc, 'span', `font:${CAPTION_PX}px system-ui;color:#666`, variant.label), host);
    grid.append(cell);
    return { host, props: reviveProps({ ...current.props, ...variant.props }) };
  });
}

export function startDomMount({ mountInto, mod, name, file, props, controlsUrl, win = window }) {
  const render = ({ container, fail }) => {
    let unmounts = [];

    return (current) => {
      unmounts.forEach((unmount) => unmount());
      unmounts = [];
      try {
        unmounts = cellsOf(win.document, container, current).map(({ host, props: shown }) => mountInto(host, shown, fail));
      } catch (error) {
        fail(String(error?.message ?? error));
      }
    };
  };

  runMount({ Target: mod.default, name, file, props, controlsUrl, win, render });
}

export const vueMount = ({ createApp, h }, Target) => (host, props, fail) => {
  const app = createApp({ render: () => h(Target, props) });
  app.config.errorHandler = (error) => fail(String(error?.message ?? error));
  app.mount(host);
  return () => app.unmount();
};

export const svelteMount = ({ mount, unmount }, Target) => (host, props) => {
  const instance = mount(Target, { target: host, props });
  return () => unmount(instance);
};
