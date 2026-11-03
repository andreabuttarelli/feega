import { clipsOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ActionKind, TriggerKind, type Interaction } from '@feega/motion-core/motion/prototype/model';

export const DRAG_THRESHOLD_PX = 8;

export type FrameSize = { width: number; height: number };
export type FrameRect = { left: number; top: number; width: number; height: number };
export type Hotspot = { clip: string; interaction: Interaction; box: FrameRect };
export type Delayed = { interaction: Interaction; delayMs: number };

const paintedUp = (doc: MotionDoc): MotionClip[] => [...doc.tracks].reverse().flatMap((t) => t.clips as MotionClip[]);

function parentsBeforeChildren(clips: MotionClip[]): MotionClip[] {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const placed = new Set<string>();
  const order: MotionClip[] = [];
  const place = (clip: MotionClip) => {
    if (placed.has(clip.id)) {
      return;
    }
    placed.add(clip.id);
    const parent = clip.parent ? byId.get(clip.parent) : undefined;
    if (parent) {
      place(parent);
    }
    order.push(clip);
  };
  clips.forEach(place);
  return order;
}

export function hotspotsOf(doc: MotionDoc, size: FrameSize, rectOf: (clip: string) => FrameRect | null): Hotspot[] {
  return parentsBeforeChildren(paintedUp(doc)).flatMap((clip) => {
    const rect = (clip.interactions ?? []).length ? rectOf(clip.id) : null;
    if (!rect) {
      return [];
    }
    const box = { left: rect.left / size.width, top: rect.top / size.height, width: rect.width / size.width, height: rect.height / size.height };
    return (clip.interactions ?? []).filter((i) => i.trigger.kind !== TriggerKind.AfterDelay && i.action.kind !== ActionKind.ChangeTo).map((interaction) => ({ clip: clip.id, interaction, box }));
  });
}

export function delayed(doc: MotionDoc): Delayed[] {
  return clipsOf(doc).flatMap((clip) =>
    (clip.interactions ?? []).flatMap((interaction) => (interaction.trigger.kind === TriggerKind.AfterDelay ? [{ interaction, delayMs: interaction.trigger.delayMs }] : []))
  );
}

export const isDrag = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
