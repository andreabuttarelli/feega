import { describe, expect, it } from 'vitest';
import { ASTRO_ROUTE, PROPS_ROUTE, astroModule, mountHtml, reactModule, svelteModule, mountRequestOf } from './mount-page.ts';

const RUNTIME = '/@fs/x/mount-runtime.js';

describe('mountRequestOf', () => {
  it('reads file, name and props from the query', () => {
    const url = new URL('http://localhost/__feega/mount?file=src/Card.tsx&name=Card&props=' + encodeURIComponent('{"size":"sm"}'));

    expect(mountRequestOf(url)).toEqual({ file: 'src/Card.tsx', name: 'Card', props: { size: 'sm' } });
  });

  it('starts from no props when the query has none or has garbage', () => {
    expect(mountRequestOf(new URL('http://x/?file=a.tsx&name=A'))!.props).toEqual({});
    expect(mountRequestOf(new URL('http://x/?file=a.tsx&name=A&props=%7B'))!.props).toEqual({});
  });

  it('refuses a file outside the project', () => {
    expect(mountRequestOf(new URL('http://x/?file=../secret.tsx&name=A'))).toBeNull();
    expect(mountRequestOf(new URL('http://x/?file=/etc/passwd&name=A'))).toBeNull();
  });

  it('refuses a request with no file', () => {
    expect(mountRequestOf(new URL('http://x/?name=A'))).toBeNull();
  });
});

describe('mountHtml', () => {
  it('points the page at the module that renders the component', () => {
    expect(mountHtml('file=src%2FCard.tsx&name=Card')).toContain('<script type="module" src="/__feega/mount-module.js?file=src%2FCard.tsx&name=Card">');
  });

  it('has the root the component renders into', () => {
    expect(mountHtml('file=a')).toContain('<div id="root">');
  });

  it('reports a failure before the component starts, such as a framework plugin that cannot serve the page', () => {
    const html = mountHtml('file=a');

    expect(html).toContain("addEventListener('error'");
    expect(html).toContain('feega:mount:status');
    expect(html.indexOf("addEventListener('error'")).toBeLessThan(html.indexOf('type="module"'));
  });

  it('tells the bridge in the page not to install itself in this document', () => {
    expect(mountHtml('file=a')).toContain("Symbol.for('feega.nested-host')");
  });
});

describe('reactModule', () => {
  const request = { file: 'src/Card.tsx', name: 'Card', props: { size: 'sm' } };
  const page = { runtimeUrl: RUNTIME, componentUrl: '/src/Card.tsx', providersUrl: null, styleUrls: [] };

  it('imports the component from the project and starts the runtime', () => {
    const code = reactModule(request, page);

    expect(code).toContain('import * as mod from "/src/Card.tsx"');
    expect(code).toContain(`from "${RUNTIME}"`);
    expect(code).toContain(`${PROPS_ROUTE}?file=src%2FCard.tsx&name=Card`);
    expect(code).toContain('"size":"sm"');
  });

  it('loads the providers module when there is one, and survives it failing', () => {
    const code = reactModule(request, { ...page, providersUrl: '/src/main.tsx?feega-providers' });

    expect(code).toContain('import("/src/main.tsx?feega-providers")');
    expect(code).toContain('.catch(');
  });

  it('starts with no providers when the project has none', () => {
    expect(reactModule(request, page)).toContain('const providers = null;');
  });
});

describe('global styles of the app', () => {
  const request = { file: 'src/Card.svelte', name: 'Card', props: {} };
  const page = { runtimeUrl: RUNTIME, domRuntimeUrl: '/@fs/x/mount-dom.js', componentUrl: '/src/Card.svelte', providersUrl: null, styleUrls: ['/src/app.css', '@/theme.css'] };

  it('are imported before a Svelte component mounts', () => {
    const code = svelteModule(request, page);

    expect(code).toContain('import "/src/app.css";');
    expect(code).toContain('import "@/theme.css";');
  });

  it('are imported before a React component mounts', () => {
    expect(reactModule({ ...request, file: 'src/Card.tsx' }, page)).toContain('import "/src/app.css";');
  });

  it('add nothing when the app has none', () => {
    expect(svelteModule(request, { ...page, styleUrls: [] })).not.toContain('.css');
  });
});

describe('mountHtml for SvelteKit', () => {
  it('gives the page the environment object SvelteKit reads public env from', () => {
    expect(mountHtml('file=a')).toContain('__sveltekit_dev');
  });
});

describe('astroModule', () => {
  const page = { runtimeUrl: RUNTIME, domRuntimeUrl: '/@fs/x/mount-dom.js', componentUrl: '/src/Card.astro', providersUrl: null, styleUrls: [] };

  it('asks the dev server to render the Astro component with the props', () => {
    const code = astroModule({ file: 'src/Card.astro', name: 'Card', props: { size: 'sm' } }, page);

    expect(code).toContain(`${ASTRO_ROUTE}?file=src%2FCard.astro`);
    expect(code).toContain('astroMount');
    expect(code).toContain('"size":"sm"');
  });
});
