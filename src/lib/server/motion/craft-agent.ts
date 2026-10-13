import sharp from 'sharp';
import type { Tool } from 'ai';
import { runChild } from '$lib/server/agents/spawn-agent';
import type { SdkUsage } from '$lib/server/ai-log';
import { MODEL_IMAGE_MAX_PX } from '$lib/server/chat-attachments/model-parts';
import { craftRun, type CraftInput, type CraftPorts, type CraftResult } from './craft';
import type { MotionAsset } from './editor';
import { VIEW_FRAMES, type Frame, type Reference } from './frames';
import { fetchImageBytes } from './ui-read';

export const CRAFT_KEY = 'motion-craft';

const REFERENCE_QUALITY = 85;

export type CraftHost = {
  orgId: string;
  model: string;
  frame: { width: number; height: number };
  session: { references?: Reference[]; frames: ReadonlyMap<string, Frame[]> };
  assets: () => readonly MotionAsset[];
  tools: () => Record<string, Tool>;
  remainingUsd: () => number;
  onStep: () => void;
  onSpent: (usd: number) => void;
  storeSheet: (frames: readonly Frame[]) => Promise<string | null>;
  log: (usage: SdkUsage) => void;
  abort?: AbortSignal;
};

async function referenceOf(url: string): Promise<Reference | null> {
  const picture = await fetchImageBytes(url).catch(() => null);
  if (!picture) {
    return null;
  }
  const jpeg = await sharp(Buffer.from(picture.data, 'base64')).resize(MODEL_IMAGE_MAX_PX, MODEL_IMAGE_MAX_PX, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: REFERENCE_QUALITY }).toBuffer().catch(() => null);
  return jpeg ? { mediaType: 'image/jpeg', data: jpeg.toString('base64') } : null;
}

export function craftAgent(host: CraftHost): (input: CraftInput) => Promise<CraftResult> {
  const ports: CraftPorts = {
    references: async (ids) => {
      const urls = ids.flatMap((id) => host.assets().find((a) => a.id === id)?.url ?? []);
      const read = await Promise.all(urls.map(referenceOf));
      return read.filter((r): r is Reference => r !== null);
    },
    run: async (ask) => {
      const all = host.tools();
      const out = await runChild(host, { model: host.model, system: ask.system, content: ask.content, tools: Object.fromEntries(ask.tools.flatMap((n) => (all[n] ? [[n, all[n]]] : []))), budgetUsd: ask.budgetUsd, steps: ask.steps, onStep: host.onStep });
      host.onSpent(out.usd);
      host.log(out.usage);
      const views = out.steps.flatMap((s) => s.toolCalls.filter((c) => c.toolName === VIEW_FRAMES).map((c) => c.toolCallId)).filter((id) => host.session.frames.has(id));
      return { text: out.text, usd: out.usd, views };
    },
    sheet: async (callId) => {
      const frames = host.session.frames.get(callId);
      return frames?.length ? host.storeSheet(frames) : null;
    },
    remainingUsd: host.remainingUsd
  };
  return (input) => craftRun(ports, input, { session: host.session, frame: host.frame });
}
