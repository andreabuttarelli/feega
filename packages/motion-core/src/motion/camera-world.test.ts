import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { FEEGA_TOKENS } from './brand';
import { addClip } from './timeline';
import { composeHtml } from './hyperframes/compose';
import { setCamera } from './camera-ops';
import type { ComponentId } from './components';

const BADGE = { source: { html: '<div>badge</div>', css: '', js: '' }, propsSchema: { type: 'object' as const, properties: {} }, version: 1, check: null };
const PROPS: Partial<Record<ComponentId, Record<string, unknown>>> = { Custom: { name: 'Badge' } };

const LAYERS: ComponentId[] = ['Text', 'Shape', 'Image', 'Video', 'Custom'];

function staged(): MotionDoc {
  let doc: MotionDoc = { ...newMotionDoc(MotionFormat.Landscape), components: { Badge: BADGE } };
  for (const component of LAYERS) {
    const added = addClip(doc, { component, from: 0, durationInFrames: 60, props: PROPS[component] }, component);
    if (!added.ok) {
      throw new Error(`${component}: ${added.error}`);
    }
    doc = added.doc;
  }
  const lit = setCamera(doc, {});
  if (!lit.ok) {
    throw new Error(lit.error);
  }
  return lit.doc;
}

const worldOf = (html: string) => html.slice(html.indexOf('id="world"'), html.indexOf('<!--/world-->'));

describe('one camera for the whole scene', () => {
  it.each(LAYERS)('a %s clip sits in the camera world', (component) => {
    const html = composeHtml({ doc: staged(), tokens: FEEGA_TOKENS, assets: {}, origin: 'https://feega.app' });

    expect(worldOf(html)).toContain(`data-clip="${component}"`);
  });
});
