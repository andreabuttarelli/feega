import { reviveProps, runMount } from './mount-runtime.js';
import { gridOf } from './variant-grid.js';

const GAP_PX = 24;
const CAPTION_PX = 11;

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
  const { columnName, columns, rows } = gridOf(current.variants);
  const grid = element(doc, 'div', `display:grid;grid-template-columns:max-content repeat(${columns.length},1fr);gap:${GAP_PX}px;align-items:center;justify-items:start;width:max-content`);
  const caption = (text) => element(doc, 'span', `font:${CAPTION_PX}px system-ui;color:#888;white-space:nowrap`, text);
  container.append(grid);
  grid.append(element(doc, 'span', ''), ...columns.map((column) => caption(`${columnName}=${column}`)));
  return rows.flatMap((row) => {
    grid.append(caption(row.header));
    return row.cells.map((variant) => {
      const host = element(doc, 'div', '');
      grid.append(host);
      if (!variant) {
        return null;
      }
      host.dataset.feegaVariant = variant.label;
      return { host, props: reviveProps({ ...current.props, ...variant.props }) };
    }).filter(Boolean);
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

export const astroMount = (renderUrl) => (host, props, fail) => {
  const url = `${renderUrl}&props=${encodeURIComponent(JSON.stringify(props))}`;
  let live = true;
  fetch(url)
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`Astro could not render it (${response.status})`))))
    .then((html) => live && host.insertAdjacentHTML('beforeend', html))
    .catch((error) => live && fail(String(error?.message ?? error)));
  return () => {
    live = false;
    host.replaceChildren();
  };
};
