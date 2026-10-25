// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';

function docWith(props: Record<string, unknown>): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Square);
  const clip = newClip({ id: 't1', from: 0, durationInFrames: doc.durationInFrames, component: 'Text', props: COMPONENTS.Text.schema.parse(props) as Record<string, unknown> });
  return { ...doc, tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [clip] } : t)) };
}

const compose = (props: Record<string, unknown>) => composeHtml({ doc: docWith(props), tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });

describe('decoration and features in the HTML export', () => {
  it('writes the decoration with explicit thickness, offset, colour and skip ink', () => {
    const html = compose({ decoration: 'underline', decorationStyle: 'wavy', decorationThickness: 0.08, decorationOffset: 0.2, decorationColor: '#ff0000', skipInk: false });

    expect(html).toContain('text-decoration-line:underline');
    expect(html).toContain('text-decoration-style:wavy');
    expect(html).toContain('text-decoration-thickness:0.08em');
    expect(html).toContain('text-underline-offset:0.2em');
    expect(html).toContain('text-decoration-color:#ff0000');
    expect(html).toContain('text-decoration-skip-ink:none');
  });

  it('writes the features and small caps as font feature settings', () => {
    expect(compose({ features: "'tnum' 1", textCase: 'small-caps' })).toContain("font-feature-settings:'tnum' 1, 'smcp' 1");
  });
});
