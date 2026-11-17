import { ItemKind } from '@feega/motion-core/motion/gpu-full/display-list';
import { CardPart } from './card-kit';

export const postersFor = <P extends { frame: { id: string } }>(posters: readonly P[], whole: ReadonlySet<string>): P[] => posters.filter((p) => !whole.has(p.frame.id));

type Drawn = { kind: string; items?: readonly Drawn[] };

const PICTURE: string = ItemKind.Image;

export const showsPoster = (list: { items: readonly Drawn[] }): boolean => list.items.some((i) => i.kind === PICTURE || showsPoster({ items: i.items ?? [] }));

const STAGE = `:${CardPart.Stage}`;

export const showsStage = (list: { items: readonly { clip?: string }[] }): boolean => list.items.some((i) => i.clip?.endsWith(STAGE));
