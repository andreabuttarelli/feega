import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { writeComponent } from '$lib/motion/custom/ops';
import { FrameUpload, MAX_FRAME_BYTES, MAX_FRAMES_PER_VIEW, MAX_VIEWS_PER_TURN, VIEW_FRAMES, decodeFrame, docTexts, keyFrameTimes, selfCheckDue, usageByModel, Vision, visionStep } from './frames';

const jpeg = (bytes: number) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 1).toString('base64')}`;

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

describe('frames sent by the preview', () => {
  it('at most six frames per view', () => {
    const frames = Array.from({ length: MAX_FRAMES_PER_VIEW + 1 }, (_, i) => ({ time: i, data: jpeg(10) }));

    expect(FrameUpload.safeParse({ callId: 'call_1', frames }).success).toBe(false);
    expect(FrameUpload.safeParse({ callId: 'call_1', frames: frames.slice(1) }).success).toBe(true);
  });

  it('a determinism verdict may come with no frames, but an upload always carries something', () => {
    expect(FrameUpload.safeParse({ callId: 'call_1', frames: [], verdict: { ok: true, problems: [] } }).success).toBe(true);
    expect(FrameUpload.safeParse({ callId: 'call_1', frames: [] }).success).toBe(false);
  });

  it('a frame is a small JPEG, nothing else', () => {
    expect(decodeFrame(jpeg(100))).toBeInstanceOf(Buffer);
    expect(decodeFrame(jpeg(MAX_FRAME_BYTES + 1))).toBeNull();
    expect(decodeFrame(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).toBeNull();
  });
});

describe('the self-check looks at the middle of each scene', () => {
  it('one frame per scene midpoint, background ignored, at most four', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 450 }, 'bg'));
    for (let i = 0; i < 5; i++) {
      doc = must(addClip(doc, { component: 'Title', from: i * 90, durationInFrames: 60 }, `t${i}`));
    }

    const times = keyFrameTimes(doc);

    expect(times).toHaveLength(4);
    expect(times[0]).toBe(1);
    expect(times.every((t) => t < 15)).toBe(true);
  });

  it('an empty video has nothing to look at', () => {
    expect(keyFrameTimes(newMotionDoc(MotionFormat.Square))).toEqual([]);
  });
});

describe('a main model that cannot see hands the frames to the vision model', () => {
  const base: ModelMessage[] = [{ role: 'user', content: 'fix the title' }];
  const framed: ModelMessage[] = [
    ...base,
    { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'c1', toolName: VIEW_FRAMES, input: {} }] },
    {
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'c1', toolName: VIEW_FRAMES, output: { type: 'content', value: [{ type: 'text', text: '{}' }, { type: 'file', mediaType: 'image/jpeg', data: { type: 'data', data: 'AQ==' } }] } }]
    }
  ];
  const blindStep = { stepModel: 'text', visionModel: 'vision' };

  it('a model that sees keeps the frames where they are, in the tool result', () => {
    expect(visionStep({ messages: framed, shown: new Set(), stepModel: 'vision', visionModel: 'vision' })).toBeUndefined();
  });

  it('frames not yet seen go to the vision model, whatever round they came from', () => {
    const step = visionStep({ messages: [...framed, { role: 'user', content: 'The turn is over' }], shown: new Set(), ...blindStep });

    expect(step).toEqual({ model: 'vision', shown: ['c1'] });
  });

  it('frames already seen are dropped for the model that cannot see them', () => {
    const step = visionStep({ messages: framed, shown: new Set(['c1']), ...blindStep });

    expect(step?.model).toBeUndefined();
    expect(JSON.stringify(step?.messages)).not.toContain('image/jpeg');
    expect(JSON.stringify(step?.messages)).toContain('frames already inspected');
  });

  it('a step with no images anywhere changes nothing', () => {
    expect(visionStep({ messages: base, shown: new Set(), ...blindStep })).toBeUndefined();
  });
});

describe('the automatic self-check after an edit', () => {
  const edited = { edits: ['edited t1'], checkedAt: 0, views: 0 };

  it('runs once when the turn changed the video and nobody looked since', () => {
    expect(selfCheckDue(edited, Vision.Available)).toBe(true);
    expect(selfCheckDue({ ...edited, checkedAt: 1 }, Vision.Available)).toBe(false);
  });

  it('never on a turn that only read, or without a vision model', () => {
    expect(selfCheckDue({ ...edited, edits: [] }, Vision.Available)).toBe(false);
    expect(selfCheckDue(edited, Vision.Missing)).toBe(false);
  });

  it('still due after the frame budget is spent, when an edit came after the last look', () => {
    expect(selfCheckDue({ ...edited, views: MAX_VIEWS_PER_TURN }, Vision.Available)).toBe(true);
  });
});

describe('what the safety review reads before frames reach a model', () => {
  it('every visible text of the video', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, props: { text: 'Hello\nworld' } }, 't'));

    expect(docTexts(doc)).toEqual(['Hello\nworld']);
  });

  it('the text a custom component shows is screened too', () => {
    const doc = must(addClip(must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Card', { source: { html: '<h1>Big <b>sale</b></h1>', css: '', js: '' }, propsSchema: { type: 'object', properties: { line: { type: 'string', default: 'x' } } } })), { component: 'Custom', from: 0, props: { name: 'Card', line: 'Buy now' } }, 'c'));

    expect(docTexts(doc)).toEqual(expect.arrayContaining(['Big sale', 'Buy now']));
  });
});

describe('billing a turn that mixed models', () => {
  it('each step is billed to the model that actually ran it', () => {
    const usage = (inputTokens: number) => ({ inputTokens, outputTokens: 10 });
    const byModel = usageByModel([usage(100), usage(400), usage(50)], ['text', 'vision', 'text']);

    expect(byModel.get('text')).toEqual({ inputTokens: 150, outputTokens: 20 });
    expect(byModel.get('vision')).toEqual({ inputTokens: 400, outputTokens: 10 });
  });
});
