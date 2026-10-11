import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { Ending, LOOP_RULE, LOOP_SEAM_LUMA, endingOf, loopJump } from './loop';
import { HOUSE_LOOP, MotionStyle } from './style-model';
import { DEFAULT_INTERACTIVE, PlayMode, interactiveOf } from './interactive/settings';
import { SEVERITY, Quality, Severity } from './direction';

const doc = newMotionDoc(MotionFormat.Vertical);

const endingOn = (template: string): MotionDoc => ({
  ...doc,
  comps: { card: { name: 'End card', durationInFrames: doc.durationInFrames, template: { id: template, name: 'End card', keys: {} }, tracks: [] } as never },
  tracks: [{ id: 't', kind: 'visual', name: 'V', clips: [{ id: 'p', component: 'Precomp', from: 0, durationInFrames: doc.durationInFrames, props: { comp: 'card' } }] }] as never
});

describe('videos loop by default', () => {
  it('a new video and its embed loop: the house default', () => {
    expect(HOUSE_LOOP).toBe(true);
    expect(DEFAULT_INTERACTIVE.loop).toBe(HOUSE_LOOP);
    expect(interactiveOf(doc).loop).toBe(true);
    expect(endingOf(doc)).toBe(Ending.Seamless);
  });

  it('every exception is a row of one table', () => {
    expect(endingOf({ ...doc, interactive: { ...DEFAULT_INTERACTIVE, loop: false } })).toBe(Ending.LoopOff);
    expect(endingOf({ ...doc, interactive: { ...DEFAULT_INTERACTIVE, playback: PlayMode.Scrub } })).toBe(Ending.Scrub);
    expect(endingOf({ ...doc, style: MotionStyle.UiMorph })).toBe(Ending.Reel);
    expect(endingOf(endingOn('end-card'))).toBe(Ending.EndCard);
    expect(endingOf(endingOn('lower-third'))).toBe(Ending.Seamless);
  });

  it('a jump from the last frame to the first is a warning with a concrete fix', () => {
    const detail = loopJump(doc, LOOP_SEAM_LUMA + 20);

    expect(detail).toMatch(/last frame/);
    expect(detail).toMatch(/opening|frame 0/);
    expect(SEVERITY[Quality.LoopJump]).toBe(Severity.Warning);
  });

  it('a seam under the threshold, or an ending that is not meant to loop, says nothing', () => {
    expect(loopJump(doc, LOOP_SEAM_LUMA - 1)).toBeNull();
    expect(loopJump(endingOn('end-card'), 80)).toBeNull();
  });

  it('the director is told to plan the ending back into the opening', () => {
    expect(LOOP_RULE).toMatch(/opening/);
    expect(LOOP_RULE).toMatch(/match cut/);
    expect(LOOP_RULE).toMatch(/end card/i);
  });
});
