import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { TriggerKind, type Interaction } from '@feega/motion-core/motion/prototype/model';

export const DRAG_THRESHOLD_PX = 8;

export type FrameSize = { width: number; height: number };
export type FrameRect = { left: number; top: number; width: number; height: number };
export type Hotspot = { clip: string; interaction: Interaction; box: FrameRect };
export type Delayed = { interaction: Interaction; delayMs: number };

export function hotspotsOf(doc: MotionDoc, size: FrameSize, rectOf: (clip: string) => FrameRect | null): Hotspot[] {
  return clipsOf(doc).flatMap((clip) => {
    const rect = (clip.interactions ?? []).length ? rectOf(clip.id) : null;
    if (!rect) {
      return [];
    }
    const box = { left: rect.left / size.width, top: rect.top / size.height, width: rect.width / size.width, height: rect.height / size.height };
    return (clip.interactions ?? []).filter((i) => i.trigger.kind !== TriggerKind.AfterDelay).map((interaction) => ({ clip: clip.id, interaction, box }));
  });
}

export function delayed(doc: MotionDoc): Delayed[] {
  return clipsOf(doc).flatMap((clip) =>
    (clip.interactions ?? []).flatMap((interaction) => (interaction.trigger.kind === TriggerKind.AfterDelay ? [{ interaction, delayMs: interaction.trigger.delayMs }] : []))
  );
}

export const isDrag = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
