import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { composeHtml } from './compose';
import { particleRuntime } from './particles';
import { Chunk, chunkByFile, chunkCode, chunkUrl } from './runtime-chunks';
import { MOTION_RUNTIME_ROUTE, RuntimeDelivery } from './runtime-delivery';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const ORIGIN = 'https://oh.feega.app';
const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Particles', from: 0, durationInFrames: 60, props: {} }, 'p'));
const compose = (runtime?: RuntimeDelivery) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: ORIGIN, runtime });
const referenced = (page: string) => [...page.matchAll(new RegExp(`<script src="${ORIGIN}${MOTION_RUNTIME_ROUTE}/([^"]+)"></script>`, 'g'))].map((m) => m[1]);

describe('runtime by reference', () => {
  it('a hosted page loads the engine and the particle renderer from versioned urls on our origin, not from its own bytes', () => {
    const page = compose(RuntimeDelivery.Hosted);

    expect(page).toContain(`<script src="${chunkUrl(ORIGIN, Chunk.Engine)}"></script>`);
    expect(page).toContain(`<script src="${chunkUrl(ORIGIN, Chunk.Particles)}"></script>`);
    expect(page).not.toContain(chunkCode(Chunk.Engine));
    expect(page).not.toContain(particleRuntime());
  });

  it('every referenced file serves exactly the code the self-contained page runs inline', () => {
    const inline = compose();
    const files = referenced(compose(RuntimeDelivery.Hosted));

    expect(files.length).toBeGreaterThan(1);
    expect(inline).toContain(chunkCode(Chunk.Engine));
    expect(inline).toContain(particleRuntime());
    expect(chunkByFile(files.find((f) => f.startsWith(Chunk.Particles))!)).toContain(particleRuntime());
    files.forEach((file) => expect(chunkByFile(file)).not.toBeNull());
  });

  it('the url changes with the code, so a cached file is never stale', () => {
    expect(chunkUrl(ORIGIN, Chunk.Engine)).toMatch(new RegExp(`${MOTION_RUNTIME_ROUTE}/engine\\.[0-9a-f]{16}\\.js$`));
    expect(chunkByFile('engine.0000000000000000.js')).toBeNull();
  });

  it('the hosted page lets the browser load those files', () => {
    expect(compose(RuntimeDelivery.Hosted)).toMatch(/script-src[^"]*https:\/\/oh\.feega\.app\/motion-runtime\//);
  });
});
