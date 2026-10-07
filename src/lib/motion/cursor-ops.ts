import { newClip, type MotionDoc } from './doc';
import { TrackKind } from './components';
import { Space } from './camera';
import { writeComponent } from './custom/ops';
import type { OpResult } from './timeline';
import { anchorBox, anchorsOf, placeOf, startOf, CURSOR_PIECE, TARGET_SEPARATOR } from './clicks';
import { UI_KIT, UiKind } from './ui-kit/kit';

export type UiClick = { clipId: string; anchor: string; at: number };

const LEAD_S = 0.8;
const TAIL_S = 0.5;

const fail = (error: string): OpResult => ({ ok: false, error });

export function clickUi(doc: MotionDoc, clicks: readonly UiClick[], ids: { clip: string; track: string }): OpResult {
  const sorted = [...clicks].sort((a, b) => a.at - b.at);
  const first = sorted[0]?.at ?? 0;
  const start = Math.max(0, first - LEAD_S);
  const lines: string[] = [];

  for (const click of sorted) {
    const found = anchorsOf(doc, click.clipId);
    if (!found) {
      return fail(`${click.clipId} is not a UI clip with clickable parts (add_ui or recreate_ui)`);
    }
    const frame = Math.round(click.at * doc.fps);
    const place = placeOf(doc, click.clipId);
    const from = place ? startOf(place) : 0;
    if (frame < from || frame >= from + found.place.clip.durationInFrames) {
      return fail(`${click.clipId} is not on screen at ${click.at} s (it runs ${(from / doc.fps).toFixed(2)}–${((from + found.place.clip.durationInFrames) / doc.fps).toFixed(2)} s)`);
    }
    const box = anchorBox(doc, click.clipId, click.anchor, frame);
    if (!box) {
      return fail(`${click.clipId} has no anchor ${click.anchor}: its anchors are ${Object.keys(found.anchors).join(', ') || 'none'}`);
    }
    const x = (box.left + box.width / 2) / doc.width;
    const y = (box.top + box.height / 2) / doc.height;
    lines.push(`${x.toFixed(4)}|${y.toFixed(4)}|${(click.at - start).toFixed(3)}|${click.clipId}${TARGET_SEPARATOR}${click.anchor}`);
  }

  const piece = UI_KIT[UiKind.Cursor];
  const written = writeComponent(doc, piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });
  if (!written.ok) {
    return written;
  }
  const end = (sorted[sorted.length - 1]?.at ?? 0) + TAIL_S;
  const cursor = newClip({ id: ids.clip, from: Math.round(start * doc.fps), durationInFrames: Math.max(1, Math.round((end - start) * doc.fps)), component: 'Custom', props: { name: CURSOR_PIECE, path: lines.join('\n') }, space: Space.Screen });
  const track = { id: ids.track, kind: TrackKind.Visual, name: 'Cursor', clips: [cursor] };
  return { ok: true, doc: { ...written.doc, tracks: [track, ...written.doc.tracks] as MotionDoc['tracks'] } };
}
