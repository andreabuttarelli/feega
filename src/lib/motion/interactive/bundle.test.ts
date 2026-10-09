import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { composeHtml } from '../hyperframes/compose';
import { LIVE_GLOBAL } from './runtime';
import { Liveness, PlayMode } from './settings';
import { InteractivePreset, applyInteractivePreset } from './presets';
import { HOST_MESSAGE, PLAYER_URL, interactiveBundle } from './bundle';
import { writeComponent } from '../custom/ops';
import { ComponentMode } from '../custom/component';
import { EVENT_MESSAGE } from '../custom/runtime';

function ok(result: OpResult): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const SECRET = 'eyJhbGciOiJIUzI1NiJ9.secret';
const SIGNED = `https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/sign/canvas-assets/a.png?token=${SECRET}`;

function card(): MotionDoc {
  const doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Image', from: 0, durationInFrames: 60, props: { assetId: 'pic' } }, 'card'));
  return ok(applyInteractivePreset(doc, InteractivePreset.CardTilt, 'card'));
}

const fetchBlob = async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

describe('interactive web export', () => {
  it('ships the live runtime only when asked and only when an expression reads input', () => {
    const plain = newMotionDoc(MotionFormat.Square);

    expect(composeHtml({ doc: card(), tokens: FEEGA_TOKENS, assets: {} })).not.toContain(LIVE_GLOBAL);
    expect(composeHtml({ doc: plain, tokens: FEEGA_TOKENS, assets: {}, liveness: Liveness.Live })).not.toContain(LIVE_GLOBAL);
    expect(composeHtml({ doc: card(), tokens: FEEGA_TOKENS, assets: {}, liveness: Liveness.Live })).toContain(`window.${LIVE_GLOBAL}(`);
  });

  it('inlines every asset, so the file carries no signed URL and needs no session', async () => {
    const bundle = await interactiveBundle({ doc: card(), tokens: { ...FEEGA_TOKENS, logoUrl: SIGNED }, assetUrls: { pic: SIGNED }, title: 'Card', fetchBlob });

    expect(bundle.html).not.toContain(SECRET);
    expect(bundle.html).not.toContain('supabase.co');
    expect(bundle.html).toContain('data:image/png;base64,iVBORw');
    expect(bundle.html).toContain(PLAYER_URL);
    expect(bundle.bytes).toBe(new TextEncoder().encode(bundle.html).length);
  });

  it('carries the playback options and an embed snippet that feeds the host scroll', async () => {
    const doc = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const bundle = await interactiveBundle({ doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(bundle.html).toContain(`"playback":"${PlayMode.Scrub}"`);
    expect(bundle.snippet).toContain('<iframe');
    expect(bundle.snippet).toContain('aspect-ratio:1080/1080');
    expect(bundle.snippet).toContain('allow="accelerometer; gyroscope"');
    expect(bundle.snippet).toContain(HOST_MESSAGE);
  });

  it('lets a vertical swipe on the embed scroll the host page when scroll scrubs the timeline', async () => {
    const scrub = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const scrubbed = await interactiveBundle({ doc: scrub, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });
    const tilted = await interactiveBundle({ doc: card(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(scrubbed.html).toContain('#pad{touch-action:pan-y}');
    expect(tilted.html).toContain('#pad{touch-action:none}');
  });

  it('keeps the composed page from closing the player script early', async () => {
    const bundle = await interactiveBundle({ doc: card(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });
    const script = bundle.html.slice(bundle.html.indexOf('<script>(function'));

    expect(script.indexOf('</script>')).toBe(script.lastIndexOf('</script>'));
  });
});

describe('a live component in the embed', () => {
  const game = { source: { html: '', css: '', js: 'requestAnimationFrame(function f() { requestAnimationFrame(f); });' }, propsSchema: { type: 'object' as const, properties: {} }, mode: ComponentMode.Live };
  const played = () => ok(addClip(ok(writeComponent(newMotionDoc(MotionFormat.Square), 'Game', game)), { component: 'Custom', from: 0, durationInFrames: 60, props: { name: 'Game' } }, 'g1'));

  it('runs live and gets the keys and taps the player forwards', async () => {
    const bundle = await interactiveBundle({ doc: played(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Game', fetchBlob });

    expect(bundle.html).toContain('\\"play\\":\\"live\\"');
    expect(bundle.html).toContain(`"eventMessage":"${EVENT_MESSAGE}"`);
  });
});

