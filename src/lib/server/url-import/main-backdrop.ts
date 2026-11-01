import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { FillType, type Fill } from '@feega/motion-core/motion/fill/model';

export type Backdrop = { fill: string; bind?: string };

type Placed = { holder: string; clip: MotionClip };

const PAGE = '';
const OPAQUE = 0.9;
const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const BYTE = 255;
const MAX_DEPTH = 64;

function opaqueHex(colour: unknown): string | null {
  const found = typeof colour === 'string' ? colour.match(HEX) : null;
  if (!found) {
    return null;
  }
  const alpha = found[2] ? parseInt(found[2], 16) / BYTE : 1;
  return alpha >= OPAQUE ? `#${found[1].toLowerCase()}` : null;
}

function paintOf(clip: MotionClip): Backdrop | null {
  if (clip.component !== 'Shape' || Number(clip.transform?.opacity ?? 1) < OPAQUE) {
    return null;
  }
  const fills = clip.props.fills as Fill[] | undefined;
  const solid = fills ? fills.find((f) => f.type === FillType.Solid && f.visible !== false && (f.opacity ?? 1) >= OPAQUE) : undefined;
  const fill = opaqueHex(fills ? (solid as { color?: string } | undefined)?.color : clip.props.fill);
  return fill ? { fill, ...(clip.bind?.fill ? { bind: clip.bind.fill } : {}) } : null;
}

export function backdropsOf(doc: MotionDoc): (mainId: string) => Backdrop | null {
  const holders = new Map<string, MotionClip[]>([[PAGE, doc.tracks.flatMap((t) => t.clips as MotionClip[])], ...Object.entries(doc.comps).map(([id, c]) => [id, c.tracks.flatMap((t) => t.clips as MotionClip[])] as const)]);
  const byId = new Map([...holders].map(([holder, clips]) => [holder, new Map(clips.map((c) => [c.id, c]))]));
  const placed = new Map<string, Placed>();
  for (const [holder, clips] of holders) {
    for (const clip of clips) {
      const comp = clip.component === 'Precomp' ? String(clip.props.comp) : '';
      if (comp && !placed.has(comp)) {
        placed.set(comp, { holder, clip });
      }
    }
  }
  return (mainId) => {
    let at = placed.get(mainId);
    for (let depth = 0; at && depth < MAX_DEPTH; depth++) {
      const clips = byId.get(at.holder)!;
      for (let up = at.clip.parent ? clips.get(at.clip.parent) : undefined; up; up = up.parent ? clips.get(up.parent) : undefined) {
        const paint = paintOf(up);
        if (paint) {
          return paint;
        }
      }
      at = at.holder === PAGE ? undefined : placed.get(at.holder);
    }
    return null;
  };
}
