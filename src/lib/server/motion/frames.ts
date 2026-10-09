import { z } from 'zod';
import type { ModelMessage, Tool } from 'ai';
import { COMPONENTS, Control, TrackKind } from '$lib/motion/components';
import { fieldsOf } from '$lib/motion/inspector';
import type { MotionDoc } from '$lib/motion/doc';
import { blocking, type QualityProblem } from '$lib/motion/direction';
import { REFERENCE_TOOLS } from '$lib/server/web/web-tools';

export const VIEW_FRAMES = 'view_frames';
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

const FRAMES_ASK = 'Look for clipped or overflowing text, overlaps, poor contrast and anything outside the safe area.';

function framesOutput(output: unknown, frames: readonly Frame[] = [], refs: readonly Reference[] = []) {
  if (!frames.length) {
    return { type: 'json' as const, value: output as never };
  }
  const picture = (mediaType: string, data: string) => ({ type: 'file' as const, mediaType, data: { type: 'data' as const, data } });
  const compared = refs.length ? [{ type: 'text' as const, text: REFERENCE_ASK }, ...refs.map((r) => picture(r.mediaType, r.data))] : [];
  return {
    type: 'content' as const,
    value: [
      { type: 'text' as const, text: JSON.stringify(output) },
      { type: 'text' as const, text: `Frames, in order, at ${frames.map((f) => `${f.time}s`).join(', ')}. ${FRAMES_ASK}` },
      ...frames.map((f) => picture('image/jpeg', f.bytes.toString('base64'))),
      ...compared
    ]
  };
}

export type FramedSession = { frames: ReadonlyMap<string, Frame[]>; references?: readonly Reference[] };

export function withFrames(tools: Record<string, Tool>, session: FramedSession): Record<string, Tool> {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [name, t.toModelOutput ? t : { ...t, toModelOutput: ({ toolCallId, output }: { toolCallId: string; output: unknown }) => framesOutput(output, session.frames.get(toolCallId), session.references) }])
  );
}

type Part = { type: string; output?: { type: string; value?: unknown } };

const isFile = (part: { type: string }) => part.type === 'file';

const framedResult = (part: Part) => part.type === 'tool-result' && part.output?.type === 'content' && Array.isArray(part.output.value) && part.output.value.some(isFile);

function hasImage(message: ModelMessage): boolean {
  return Array.isArray(message.content) && (message.content as Part[]).some((part) => isFile(part) || framedResult(part));
}

function blind(message: ModelMessage): ModelMessage {
  if (message.role === 'user' && hasImage(message)) {
    return { role: 'user', content: SEEN };
  }
  if (message.role !== 'tool' || !hasImage(message)) {
    return message;
  }
  return { ...message, content: message.content.map((part) => (framedResult(part as Part) && part.type === 'tool-result' && part.output.type === 'content' ? { ...part, output: { ...part.output, value: [...part.output.value.filter((v) => !isFile(v)), { type: 'text' as const, text: SEEN }] } } : part)) };
}

function imageCalls(messages: readonly ModelMessage[]): string[] {
  return messages.flatMap((m) => (m.role === 'tool' ? m.content.flatMap((part) => (framedResult(part as Part) && part.type === 'tool-result' ? [part.toolCallId] : [])) : []));
}

export type VisionStepInput = { messages: ModelMessage[]; shown: ReadonlySet<string>; stepModel: string; visionModel: string };

export function visionStep(input: VisionStepInput): { model?: string; messages?: ModelMessage[]; shown?: string[] } | undefined {
  if (input.stepModel === input.visionModel) {
    return undefined;
  }
  const unseen = imageCalls(input.messages).filter((id) => !input.shown.has(id));
  if (unseen.length) {
    return { model: input.visionModel, shown: unseen };
  }
  if (input.messages.some(hasImage)) {
    return { messages: input.messages.map(blind) };
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

export type DeliveryState = CheckState & { gate?: readonly QualityProblem[] };

export const openErrors = (state: DeliveryState) => blocking(state.gate ?? []);

export function deliveryBlocked(state: DeliveryState, vision: Vision): boolean {
  return selfCheckDue(state, vision) || (vision === Vision.Available && openErrors(state).length > 0);
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

const SUMMARY_ASK = 'write the user a short summary of the video as it now stands: what you made or changed, what you checked in the frames, and anything left to decide. Plain sentences, no tool names, no working notes.';

export function selfCheckPrompt(times: number[]): string {
  return `Self-check: call ${VIEW_FRAMES} with times [${times.join(', ')}] and look at the result. If text is clipped or overflows, overlaps another element, has poor contrast or leaves the safe area, or the result lists quality problems, fix them with the editing tools; otherwise change nothing. Then, as your last message, ${SUMMARY_ASK}`;
}

export const MAX_SELF_CHECK_REFS = 3;

const REFERENCE_ASK =
  'The pictures after the frames are the references you looked at this turn. Set each frame next to the reference it follows and write the difference in one line per frame: type scale (the largest type as a share of the frame height, here and there), edge bleed (does the big type run off the edge?), grid and rules, columns of small text, where the blocks of colour sit. Colour alone is not a match. Fix the biggest differences first, with the editing tools; a deliberate bleed off the edge is declared with set_visibility bleed true.';

export type Reference = { mediaType: string; data: string };

export function viewedReferences(messages: readonly ModelMessage[], max = MAX_SELF_CHECK_REFS): Reference[] {
  const seen = messages.flatMap((m) =>
    m.role !== 'tool'
      ? []
      : m.content.flatMap((part) => {
          if (part.type !== 'tool-result' || !REFERENCE_TOOLS.has(part.toolName) || part.output.type !== 'content') {
            return [];
          }
          return part.output.value.flatMap((v) => (v.type === 'file' && v.data.type === 'data' && typeof v.data.data === 'string' ? [{ mediaType: v.mediaType, data: v.data.data }] : []));
        })
  );
  return seen.slice(-max);
}

export function checkMessage(errors: readonly QualityProblem[], times: number[]): ModelMessage {
  return { role: 'user', content: errors.length ? fixPrompt(errors, times) : selfCheckPrompt(times) };
}

export function fixPrompt(errors: readonly QualityProblem[], times: number[]): string {
  return `Not deliverable yet: the quality gate still finds these errors in the video:\n${errors.map((e) => `- ${e.detail}`).join('\n')}\nFix each one with the editing tools, then call ${VIEW_FRAMES} with times [${times.join(', ')}] to check again. Then, as your last message, ${SUMMARY_ASK}`;
}

export function stillOpenNote(errors: readonly QualityProblem[]): string {
  return errors.length ? `\n\nStill open after the last check, not fixed:\n${errors.map((e) => `- ${e.detail}`).join('\n')}` : '';
}

export const SUMMARY_PROMPT = `The turn is over: ${SUMMARY_ASK}`;

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
