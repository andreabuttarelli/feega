import { z } from 'zod';
import type { ModelMessage } from 'ai';
import { COMPONENTS, Control, TrackKind } from '$lib/motion/components';
import { fieldsOf } from '$lib/motion/inspector';
import type { MotionDoc } from '$lib/motion/doc';

export const VIEW_FRAMES = 'view_frames';
const FRAME_TOOLS: ReadonlySet<string> = new Set([VIEW_FRAMES, 'write_component', 'patch_component']);
export const MAX_FRAMES_PER_VIEW = 6;
export const MAX_VIEWS_PER_TURN = 3;
export const MAX_FRAME_BYTES = 200_000;
export const SELF_CHECK_FRAMES = 4;
export const SELF_CHECK_MAX_STEPS = 6;

const JPEG_DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;
const SEEN = '[frames already inspected]';
const SECONDS_PRECISION = 100;

export type Frame = { time: number; bytes: Buffer };

export const FrameUpload = z
  .object({
    callId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    frames: z
      .array(z.object({ time: z.number().min(0), data: z.string().max(Math.ceil((MAX_FRAME_BYTES * 4) / 3) + 64) }))
      .max(MAX_FRAMES_PER_VIEW),
    verdict: z.object({ ok: z.boolean(), problems: z.array(z.string().max(500)).max(20) }).optional()
  })
  .refine((u) => u.frames.length > 0 || u.verdict, 'nothing to upload');

export function decodeFrame(dataUrl: string): Buffer | null {
  const match = JPEG_DATA_URL.exec(dataUrl);
  if (!match) {
    return null;
  }
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.length > 0 && bytes.length <= MAX_FRAME_BYTES ? bytes : null;
}

function isScene(clip: MotionDoc['tracks'][number]['clips'][number], doc: MotionDoc): boolean {
  return COMPONENTS[clip.component].track === TrackKind.Visual && clip.durationInFrames < doc.durationInFrames;
}

export function keyFrameTimes(doc: MotionDoc, max = SELF_CHECK_FRAMES): number[] {
  const midpoints = doc.tracks
    .filter((t) => t.kind === TrackKind.Visual)
    .flatMap((t) => t.clips.filter((c) => isScene(c, doc)).map((c) => c.from + c.durationInFrames / 2));
  const unique = [...new Set(midpoints.map(Math.round))].sort((a, b) => a - b);
  const step = (unique.length - 1) / (max - 1);
  const picked = unique.length <= max ? unique : Array.from({ length: max }, (_, i) => unique[Math.round(i * step)]);
  return picked.map((f) => Math.round((f / doc.fps) * SECONDS_PRECISION) / SECONDS_PRECISION);
}

type Call = { toolName: string; toolCallId: string };

export type VisionStepInput = { lastCalls: readonly Call[]; messages: ModelMessage[]; frames: ReadonlyMap<string, Frame[]>; visionModel: string };

function hasImage(message: ModelMessage): boolean {
  return Array.isArray(message.content) && message.content.some((part) => part.type === 'file');
}

function withoutImages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => (m.role === 'user' && hasImage(m) ? { role: 'user', content: SEEN } : m));
}

function framesMessage(frames: Frame[]): ModelMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text: `Frames you asked for, in order, at ${frames.map((f) => `${f.time}s`).join(', ')}. Look for clipped or overflowing text, overlaps, poor contrast and anything outside the safe area.` },
      ...frames.map((f) => ({ type: 'file' as const, mediaType: 'image/jpeg', data: f.bytes }))
    ]
  };
}

export function visionStep(input: VisionStepInput): { model?: string; messages?: ModelMessage[] } | undefined {
  const viewed = input.lastCalls.filter((c) => FRAME_TOOLS.has(c.toolName)).flatMap((c) => input.frames.get(c.toolCallId) ?? []);
  if (viewed.length) {
    return { model: input.visionModel, messages: [...withoutImages(input.messages), framesMessage(viewed)] };
  }
  if (input.messages.some(hasImage)) {
    return { messages: withoutImages(input.messages) };
  }
  return undefined;
}

export enum Vision {
  Available = 'available',
  Missing = 'missing'
}

export type CheckState = { edits: readonly string[]; checkedAt: number; views: number };

export function selfCheckDue(state: CheckState, vision: Vision): boolean {
  return vision === Vision.Available && state.edits.length > state.checkedAt;
}

const TEXT_CONTROLS = new Set([Control.Text, Control.Textarea]);

const TAG = /<[^>]*>/g;
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const WORDS = /[a-zA-Z]{3,}\s+[a-zA-Z]/;

function literals(js: string): string[] {
  return [...js.matchAll(STRING_LITERAL)].map((m) => m[2]).filter((text) => WORDS.test(text));
}

function customTexts(doc: MotionDoc): string[] {
  const shown = Object.values(doc.components).flatMap((c) => [c.source.html.replace(TAG, '').replace(/\s+/g, ' ').trim(), ...literals(c.source.js)]);
  const values = doc.tracks.flatMap((t) => t.clips.filter((c) => c.component === 'Custom').flatMap((c) => Object.entries(c.props).filter(([k]) => k !== 'name').map(([, v]) => v)));
  return [...shown, ...values].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export function docTexts(doc: MotionDoc): string[] {
  return [...libraryTexts(doc), ...customTexts(doc)];
}

function libraryTexts(doc: MotionDoc): string[] {
  return doc.tracks.flatMap((t) =>
    t.clips.flatMap((c) =>
      fieldsOf(c.component)
        .filter((f) => TEXT_CONTROLS.has(f.control))
        .map((f) => (c.props as Record<string, unknown>)[f.key])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    )
  );
}

export function selfCheckPrompt(times: number[]): string {
  return `Self-check: call ${VIEW_FRAMES} with times [${times.join(', ')}] and look at the result. If text is clipped or overflows, overlaps another element, has poor contrast or leaves the safe area, fix it once with the editing tools; otherwise change nothing.`;
}

export const SUMMARY_PROMPT = 'The turn is over. Write the user a short summary of the video as it now stands: what you made or changed, what you checked in the frames, and anything left to decide. Plain sentences, no tool names, no working notes.';

export type TokenUsage = Partial<Record<'inputTokens' | 'outputTokens' | 'cachedTokens' | 'thinkingTokens', number>>;

function added(a: TokenUsage, b: TokenUsage): TokenUsage {
  const sum: TokenUsage = { ...a };
  for (const [key, value] of Object.entries(b) as [keyof TokenUsage, number | undefined][]) {
    if (value === undefined) {
      continue;
    }
    sum[key] = (sum[key] ?? 0) + value;
  }
  return sum;
}

export function usageByModel(usages: readonly TokenUsage[], models: readonly string[]): Map<string, TokenUsage> {
  const byModel = new Map<string, TokenUsage>();
  usages.forEach((usage, i) => byModel.set(models[i], added(byModel.get(models[i]) ?? {}, usage)));
  return byModel;
}
