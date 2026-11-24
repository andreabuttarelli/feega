import { describe, expect, it } from 'vitest';
import { PROPS_ROUTE, mountHtml, mountModule, mountRequestOf } from './mount-page.ts';

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

  it('tells the bridge in the page not to install itself in this document', () => {
    expect(mountHtml('file=a')).toContain("Symbol.for('feega.nested-host')");
  });
});

describe('mountModule', () => {
  const request = { file: 'src/Card.tsx', name: 'Card', props: { size: 'sm' } };
  const page = { runtimeUrl: RUNTIME, componentUrl: '/src/Card.tsx', providersUrl: null };

  it('imports the component from the project and starts the runtime', () => {
    const code = mountModule(request, page);

    expect(code).toContain('import * as mod from "/src/Card.tsx"');
    expect(code).toContain(`from "${RUNTIME}"`);
    expect(code).toContain(`${PROPS_ROUTE}?file=src%2FCard.tsx&name=Card`);
    expect(code).toContain('"size":"sm"');
  });

  it('loads the providers module when there is one, and survives it failing', () => {
    const code = mountModule(request, { ...page, providersUrl: '/src/main.tsx?feega-providers' });

    expect(code).toContain('import("/src/main.tsx?feega-providers")');
    expect(code).toContain('.catch(');
  });

  it('starts with no providers when the project has none', () => {
    expect(mountModule(request, page)).toContain('const providers = null;');
  });
});
