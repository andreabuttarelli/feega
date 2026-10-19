import { describe, expect, it } from 'vitest';
import { serverUrlOf } from './bundle-fetch';

const APP = 'tauri://localhost';
const API = 'https://feega.app';

describe('a bundled app sends its server calls to the API host', () => {
  it('a same-origin call to a server route goes to the API host, query kept', () => {
    expect(serverUrlOf(new URL(`${APP}/api/v1/projects/p1/agent?thread=t`), APP, API)).toBe(`${API}/api/v1/projects/p1/agent?thread=t`);
    expect(serverUrlOf(new URL(`${APP}/p/p1/c/c1/assets/a1`), APP, API)).toBe(`${API}/p/p1/c/c1/assets/a1`);
  });

  it('the bundle’s own files stay in the bundle', () => {
    expect(serverUrlOf(new URL(`${APP}/_app/immutable/chunks/x.js`), APP, API)).toBeNull();
    expect(serverUrlOf(new URL(`${APP}/fonts/inter.woff2`), APP, API)).toBeNull();
  });

  it('a call to another host is left alone', () => {
    expect(serverUrlOf(new URL('https://abc.supabase.co/rest/v1/nodes'), APP, API)).toBeNull();
  });
});
