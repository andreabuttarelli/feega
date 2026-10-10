import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));
const scheduleRebuild = vi.fn();
vi.mock('$lib/server/motion/embed-rebuild-db', () => ({ scheduleRebuild }));

const { GET } = await import('./+server');
const { Chunk, chunkUrl } = await import('$lib/motion/hyperframes/runtime-chunks');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';

async function open(id: string, body: string | null) {
  const fetch = async () => (body === null ? new Response('', { status: 404 }) : new Response(body));
  return GET({ params: { id }, fetch, url: new URL(`https://oh.feega.app/e/${id}`) } as unknown as Parameters<typeof GET>[0]);
}

describe('/e/[id]', () => {
  it('a legacy page is served as it is and rebuilt in the background, a source page is not', async () => {
    const legacy = `<!doctype html><html><head><title>Saturn</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify({ html: '<p>clip</p>', width: 10, height: 10, duration: 1, playback: 'autoplay', loop: false })});</script></body></html>`;

    const served = await open(NODE, legacy);
    expect(served.status).toBe(200);
    expect(scheduleRebuild).toHaveBeenCalledWith(NODE, 'https://oh.feega.app');

    scheduleRebuild.mockClear();
    const { embedSource } = await import('$lib/motion/interactive/bundle');
    const { MotionFormat, newMotionDoc } = await import('$lib/motion/doc');
    const { FEEGA_TOKENS } = await import('$lib/motion/brand');
    await open(NODE, await embedSource({ doc: newMotionDoc(MotionFormat.Landscape), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob: vi.fn() }));
    expect(scheduleRebuild).not.toHaveBeenCalled();
  });

  it('serves the published bundle as a page anyone can frame', async () => {
    const res = await open(NODE, '<html>clip</html>');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe('<html>clip</html>');
  });

  it('serves an embed published with an older player through the current one', async () => {
    const cfg = { html: '<p>clip</p>', width: 1920, height: 1080, duration: 24, playback: 'scrub', loop: false };
    const legacy = `<!doctype html><html><head><title>Saturn</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script></body></html>`;

    const page = await (await open(NODE, legacy)).text();

    expect(page).toContain('<title>Saturn</title>');
    expect(page).toContain('function selfScroll');
    expect(page).toContain('\\u003cp>clip\\u003c/p>');
    expect(page).toContain('"standaloneMs":500');
  });

  it('points large inlined assets at cached urls instead of shipping them in the page', async () => {
    const audio = `data:audio/mpeg;base64,${Buffer.alloc(4096, 7).toString('base64')}`;

    const page = await (await open(NODE, `<html>${audio}</html>`)).text();

    expect(page).not.toContain('base64');
    expect(page).toMatch(new RegExp(`https://oh\\.feega\\.app/e/${NODE}/a/[0-9a-f]+`));
  });

  it('serves an embed published with jsdelivr libraries from our origin', async () => {
    const cdn = 'https://cdn.jsdelivr.net/npm/';
    const html = `<meta http-equiv="Content-Security-Policy" content="script-src ${cdn}@hyperframes/core@0.8.114/dist/hyperframe.runtime.iife.js ${cdn}three@0.181.2/" /><script src="${cdn}@hyperframes/core@0.8.114/dist/hyperframe.runtime.iife.js"></script><script type="importmap">{"imports":{"three":"${cdn}three@0.181.2/build/three.module.js","three/addons/":"${cdn}three@0.181.2/examples/jsm/","opentype":"${cdn}opentype.js@1.3.4/dist/opentype.module.js"}}</script>`;
    const cfg = { html, width: 1920, height: 1080, duration: 24, playback: 'autoplay', loop: true };
    const legacy = `<!doctype html><html><head><title>Saturn</title><script src="${cdn}@hyperframes/player@0.8.114/dist/hyperframes-player.global.js"></script></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script></body></html>`;

    const page = await (await open(NODE, legacy)).text();
    const libs = 'https://oh.feega.app/motion-libs/';

    expect(page).not.toContain('jsdelivr');
    expect(page).toContain(`<script src="${libs}hyperframes-player@0.8.114/hyperframes-player.global.js" integrity="sha384-`);
    expect(page).toContain(`${libs}hyperframes-core@0.8.114/hyperframe.runtime.iife.js`);
    expect(page).toContain(`\\"three\\":\\"${libs}three@0.181.2/esm/three.module.js\\"`);
    expect(page).toContain(`\\"three/addons/\\":\\"${libs}three@0.181.2/esm/addons/\\"`);
    expect(page).toContain(`${libs}opentype.js@1.3.4/esm/opentype.module.js`);
  });

  it('loads the libraries a downloaded bundle inlined from our origin when it is hosted', async () => {
    const libs = 'https://oh.feega.app/motion-libs/';
    const three = `data:text/javascript;base64,${Buffer.from('export const X=1;'.repeat(400)).toString('base64')}`;
    const html = `<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39; data:; style-src &#39;unsafe-inline&#39;" /><script>/*! p5@1.11.11 | LGPL-2.1 | https://github.com/processing/p5.js */\nwindow.p5=function(){};</script><script type="importmap">{"imports":{"three":"${three}"}}</script>`;
    const cfg = { html, width: 1920, height: 1080, duration: 24, playback: 'autoplay', loop: true };
    const stored = `<!doctype html><html><head><title>Saturn</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script></body></html>`;

    const page = await (await open(NODE, stored)).text();

    expect(page).not.toContain('window.p5=function');
    expect(page).not.toContain('data:text/javascript');
    expect(page).toContain(`\\u003cscript src=\\"${libs}p5@1.11.11/p5.min.js\\" integrity=\\"sha384-`);
    expect(page).toContain(`\\"three\\":\\"${libs}three@0.181.2/esm/three.module.js\\"`);
    expect(page).toContain(`script-src &#39;unsafe-inline&#39; ${libs} data:`);
  });

  it('an embed frozen with an old particle renderer draws with the current one', async () => {
    const script = `<script data-hot>(function(){const PT_AT=(function ym(t,e){return [];});const PT_DRAW=(function(t,e,o,n){t.createRadialGradient(0,0,0,0,0,1);});\nconst B=[{"id":"p"}];\nfunction particlesNow(time){PT_DRAW(null,PT_AT(B[0],time),"circle",null);}\n})();</script>`;
    const cfg = { html: `<html><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39; https://feega.app/motion-libs/x.js" /></head><body>${script}</body></html>`, width: 1920, height: 1080, duration: 24, playback: 'autoplay', loop: true };
    const legacy = `<!doctype html><html><head><title>fd37</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script></body></html>`;

    const page = await (await open(NODE, legacy)).text();

    expect(page).not.toContain('createRadialGradient');
    expect(page).toContain(`\\u003cscript src=\\"${chunkUrl('https://oh.feega.app', Chunk.Particles)}\\">`);
    expect(page).toContain('const PT_AT=');
    expect(page).toContain(`${new URL(chunkUrl('https://oh.feega.app', Chunk.Particles)).origin}/motion-runtime/`);
  });

  it('an embed frozen with a 1k environment from jsdelivr loads the small one from our origin and does not wait for it', async () => {
    const hdr = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r181/examples/textures/equirectangular/moonless_golf_1k.hdr';
    const env = "  return hdri().then((t) => { if (t) s.scene.environment = pmrem.fromEquirectangular(t).texture; });\n}";
    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="connect-src data: https://cdn.jsdelivr.net; worker-src &#39;none&#39;" /></head><body><script type="module">const LOOK = {"hdri":"${hdr}"};function environment(s) {\n${env}\nconst redraw = (time) => painter.again(time);</script></body></html>`;
    const cfg = { html, width: 1920, height: 1080, duration: 24, playback: 'autoplay', loop: true };
    const legacy = `<!doctype html><html><head><title>fd37</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script></body></html>`;

    const page = await (await open(NODE, legacy)).text();

    expect(page).not.toContain('moonless_golf_1k');
    expect(page).toContain('https://oh.feega.app/motion-env/r181/moonless_golf_256.hdr');
    expect(page).toContain('connect-src data: https://cdn.jsdelivr.net https://oh.feega.app;');
    expect(page).toContain('RoomEnvironment');
    expect(page).toContain('redraw(window.__hfThreeTime || 0)');
  });

  it('an unpublished embed is a 404', async () => {
    await expect(open(NODE, null)).rejects.toMatchObject({ status: 404 });
  });
});
