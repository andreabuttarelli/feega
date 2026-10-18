import { findClip, type MotionClip, type MotionDoc } from './doc';
import { elementFills } from './fill/elements';
import { strokesOf } from './stroke/model';

export enum Match {
  Kind = 'kind',
  Fill = 'fill',
  Stroke = 'stroke',
  Font = 'font'
}

const KEY: Record<Match, (clip: MotionClip) => string> = {
  [Match.Kind]: (clip) => (clip.component === 'Shape' ? `Shape:${String(clip.props.shape)}` : clip.component),
  [Match.Fill]: (clip) => JSON.stringify(elementFills(clip.component, clip.props)),
  [Match.Stroke]: (clip) => JSON.stringify(clip.component === 'Shape' ? strokesOf(clip.props) : (clip.props.strokes ?? [])),
  [Match.Font]: (clip) => (typeof clip.props.font === 'string' ? `${clip.props.font}|${String(clip.props.weight)}|${String(clip.props.size)}` : '')
};

export function matchingLayers(doc: MotionDoc, selection: readonly string[], match: Match = Match.Kind): string[] {
  const keyOf = KEY[match];
  const wanted = new Set(
    selection.flatMap((id) => {
      const clip = findClip(doc, id)?.clip;
      const key = clip ? keyOf(clip) : '';
      return key ? [key] : [];
    })
  );
  return doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => wanted.has(keyOf(c))).map((c) => c.id);
}
