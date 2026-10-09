import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { EASING_RULE } from '$lib/motion/style';
import { MOTION_STYLES } from '$lib/motion/style-model';
import { Vision } from './frames';
import { motionAgentPrompt } from './motion-prompt';
import { createMotionTools, type MotionSession } from './motion-tools';

const HOUSE = ['feega.out', 'feega.inOut', 'feega.in'];

function tools() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  return createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() }) as unknown as Record<string, { description: string; inputSchema: { shape: Record<string, { description?: string }> } }>;
}

describe('the motion agent prefers the house curves', () => {
  it.each(MOTION_STYLES)('%s carries the easing rule', (style) => {
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available, style })).toContain(EASING_RULE);
  });

  it('the rule names the house curves, keeps linear for drifts and loops, and refuses bounce', () => {
    for (const name of HOUSE) {
      expect(EASING_RULE).toContain(name);
    }
    expect(EASING_RULE).toMatch(/linear only for/i);
    expect(EASING_RULE).toMatch(/never bouncy or elastic/i);
  });

  it('set_keyframes says what each named ease plays', () => {
    const { description } = tools().set_keyframes;
    expect(description).toContain('standard (default, feega.inOut');
    expect(description).toContain('enter (feega.out');
    expect(description).toContain('exit (feega.in');
  });

  it('write_component tells the code to tween on the house curves', () => {
    const js = tools().write_component.inputSchema.shape.js.description ?? '';
    for (const name of HOUSE) {
      expect(js).toContain(name);
    }
  });

  it.each(['add_liquid_glass', 'add_liquid_blob'])('%s keeps its spring near critical damping', (name) => {
    expect(tools()[name].description).toContain('never a visible bounce');
  });
});
