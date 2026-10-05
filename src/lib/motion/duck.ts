import { findClip, type MotionDoc } from './doc';
import { Ease } from './design';
import type { Keyframe } from './keyframes';
import type { Region } from './audio-analysis';
import { setKeyframes, type OpResult } from './timeline';

export type DuckOptions = { depth: number; attack: number; release: number };

export const DUCK_DEFAULTS: DuckOptions = {
  depth: 0.25,
  attack: 0.2,
  release: 0.4
};

function merged(regions: Region[], gap: number): Region[] {
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  return sorted.reduce<Region[]>((out, r) => {
    const last = out[out.length - 1];
    if (last && r.start - last.end < gap) {
      last.end = Math.max(last.end, r.end);
      return out;
    }
    return [...out, { ...r }];
  }, []);
}

export function duckUnder(doc: MotionDoc, musicId: string, voiceId: string, speech: Region[] | null, options: Partial<DuckOptions> = {}): OpResult {
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  const { depth, attack, release } = { ...DUCK_DEFAULTS, ...given };
  const music = findClip(doc, musicId)?.clip;
  const voice = findClip(doc, voiceId)?.clip;
  if (!music || !voice || voice.component !== 'Audio') {
    return {
      ok: false,
      error: `duck needs a music clip and an Audio voice-over clip (got ${musicId}, ${voiceId})`
    };
  }

  const fps = doc.fps;
  const shown = {
    start: voice.from / fps,
    end: (voice.from + voice.durationInFrames) / fps
  };
  const shift = shown.start - voice.trimStart / fps;
  const placed = (
    speech ?? [
      {
        start: voice.trimStart / fps,
        end: voice.trimStart / fps + voice.durationInFrames / fps
      }
    ]
  )
    .map((r) => ({
      start: Math.max(shown.start, r.start + shift),
      end: Math.min(shown.end, r.end + shift)
    }))
    .filter((r) => r.end > r.start);
  if (!placed.length) {
    return {
      ok: false,
      error: 'no speech to duck under: the voice-over has no speech inside its clip'
    };
  }

  const base = Number((music.props as { volume?: number }).volume ?? 1);
  const low = Math.round(base * depth * 1000) / 1000;
  const local = (seconds: number) => Math.round(seconds * fps) - music.from;
  const key = (frame: number, value: number): Keyframe => ({
    frame,
    value,
    ease: Ease.Linear
  });

  const ducks = merged(placed, attack + release).flatMap((r) => [key(local(r.start - attack), base), key(local(r.start), low), key(local(r.end), low), key(local(r.end + release), base)]);
  const inside = ducks.filter((k) => k.frame >= 0 && k.frame <= music.durationInFrames);
  const track = inside[0]?.frame > 0 ? [key(0, base), ...inside] : inside;
  return setKeyframes(doc, musicId, 'volume', track);
}

export function voicesOver(doc: MotionDoc, musicId: string): string[] {
  const found = findClip(doc, musicId);
  if (!found) {
    return [];
  }
  const { track, clip: music } = found;
  const end = music.from + music.durationInFrames;
  const others = doc.tracks.filter((t) => t.id !== track.id).flatMap((t) => t.clips);
  return others.filter((c) => c.component === 'Audio' && c.from < end && c.from + c.durationInFrames > music.from).map((c) => c.id);
}
