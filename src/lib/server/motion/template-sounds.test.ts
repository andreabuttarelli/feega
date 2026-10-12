import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { TrackKind } from '$lib/motion/components';
import { Sfx } from '$lib/motion/sfx';
import { insertTemplate, setTemplateValues } from '$lib/motion/template/library';
import { PROMPT_INPUT_TEMPLATE } from '$lib/motion/template/prompt-input/template';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { templateCues, withTemplateSounds } from './template-sounds';

const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};

const placed = (from = 0) => {
  const out = insertTemplate(newMotionDoc(MotionFormat.Landscape), PROMPT_INPUT_TEMPLATE, { from, newId: ids() });
  if (!out.ok) {
    throw new Error(out.error);
  }
  return out;
};

describe('template sounds', () => {
  it('a key tap per keystroke and one click on send, from where the clip starts', () => {
    const at = placed(60);
    const cues = templateCues(at.doc, at.clipId);

    expect(cues.filter((c) => c.sfx === Sfx.Click)).toHaveLength(1);
    expect(cues.filter((c) => c.sfx === Sfx.Key).length).toBeGreaterThan(40);
    expect(cues[0].at).toBeGreaterThan(2);
  });

  it('a prompt that only types, without pressing send, has no click', () => {
    const at = placed();
    const held = setTemplateValues(at.doc, at.clipId, { submit: 'hold' });

    expect(held.ok && templateCues(held.doc, at.clipId).some((c) => c.sfx === Sfx.Click)).toBe(false);
  });

  it('a template without sounds has none', () => {
    const out = insertTemplate(newMotionDoc(MotionFormat.Landscape), builtinTemplate('builtin:lower-third')!, { from: 0, newId: ids() });

    expect(out.ok && templateCues(out.doc, out.clipId)).toEqual([]);
  });

  it('lays them as audio clips, making each sound asset once', async () => {
    const at = placed();
    const make = vi.fn(async (sfx: Sfx) => ({ ok: true as const, assetId: `a-${sfx}`, url: null, seconds: 0.1 }));

    const out = await withTemplateSounds(at.doc, at.clipId, make, ids());
    const clips = out.ok ? out.doc.tracks.filter((t) => t.kind === TrackKind.Audio).flatMap((t) => t.clips) : [];

    expect(make).toHaveBeenCalledTimes(2);
    expect(clips.length).toBe(templateCues(at.doc, at.clipId).length);
  });
});
