import { z } from 'zod';
import { SECTION_DEFAULT_FILL } from '$lib/canvas/node-data';
import { sectionBoxAround } from '$lib/canvas/section';
import type { UndoItem } from '$lib/canvas/undo-plan';
import type { Members } from '$lib/server/motion/element-groups';
import { MoveOutcome, created, refused, type Moved } from '$lib/server/motion/move-element';

export const sectionAskSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(50), id: z.string().uuid().optional() }).strict();

const SECTION_TITLE = 'Section';

type NewSection = { id?: string; x: number; y: number; width: number; height: number; data: Record<string, unknown> };

export type SectionDeps = { members: Members; create: (section: NewSection) => Promise<{ id: string }> };

export async function wrapInSection({ members, create }: SectionDeps, ids: readonly string[], id?: string): Promise<Moved> {
  const held = await members.read(ids);
  if (!held.length) {
    return refused(MoveOutcome.Invalid, 'pick something on the canvas to wrap in a section');
  }

  const box = sectionBoxAround(held.map((m) => m.box));
  const made = await create({ id, x: box.left, y: box.top, width: box.width, height: box.height, data: { title: SECTION_TITLE, fill: SECTION_DEFAULT_FILL } });
  await members.sendBack(made.id);
  const joins = (await Promise.all(held.map((m) => members.join(m.id, made.id)))).filter((u): u is UndoItem => u !== null);
  return { outcome: MoveOutcome.Done, frameId: made.id, clipId: '', created: true, versions: { [made.id]: 1 }, undo: [created(made.id, { x: box.left, y: box.top }), ...joins] };
}
