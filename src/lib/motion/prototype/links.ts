import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';

export type PrototypeLink = { id: string; clip: string; from: string; to: string; trigger: TriggerKind; action: ActionKind };

const isFrameLink = (kind: ActionKind): boolean => kind === ActionKind.Navigate || kind === ActionKind.OpenOverlay;

export function prototypeLinks(docs: ReadonlyMap<string, MotionDoc>): PrototypeLink[] {
  return [...docs].flatMap(([from, doc]) =>
    clipsOf(doc).flatMap((clip) =>
      (clip.interactions ?? []).flatMap((i) => {
        const to = isFrameLink(i.action.kind) && 'target' in i.action ? i.action.target : null;
        return to && docs.has(to) ? [{ id: i.id, clip: clip.id, from, to, trigger: i.trigger.kind, action: i.action.kind }] : [];
      })
    )
  );
}
