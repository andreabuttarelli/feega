import type { Element } from '$lib/motion/move-element';
import type { CopiedStyle } from '$lib/motion/style-copy';

export enum Copied {
  Elements = 'elements',
  Tiles = 'tiles',
  Keyframes = 'keyframes'
}

export type CopiedElements = { kind: Copied.Elements; frameId: string; clipIds: string[]; elements: Element[] };

type Held = CopiedElements | { kind: Copied.Tiles } | { kind: Copied.Keyframes };

let held = $state<Held | null>(null);
let style = $state.raw<CopiedStyle | null>(null);

export const elementClipboard = {
  get kind(): Copied | null {
    return held?.kind ?? null;
  },
  get elements(): CopiedElements | null {
    return held?.kind === Copied.Elements ? held : null;
  },
  copyElements(frameId: string, clipIds: string[], elements: Element[]) {
    held = { kind: Copied.Elements, frameId, clipIds, elements };
  },
  get style(): CopiedStyle | null {
    return style;
  },
  copyStyle(copied: CopiedStyle) {
    style = copied;
  },
  copyTiles() {
    held = { kind: Copied.Tiles };
  },
  copyKeyframes() {
    held = { kind: Copied.Keyframes };
  }
};
