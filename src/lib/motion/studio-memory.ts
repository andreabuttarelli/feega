import type { MotionDoc } from './doc';
import { TrackKind } from './components';

export type StudioMemory = { style: string | null; typeScale: number | null; palette: string[]; fonts: string[]; shots: string[]; music: string[] };

const SHOT = /^Shot[A-Z]\w*$/;

type Remembered = Pick<MotionDoc, 'tracks' | 'fonts' | 'assets' | 'style' | 'referenceLook'>;

const unique = (items: string[]) => [...new Set(items)];

export function studioMemory(doc: Remembered): StudioMemory {
  const clips = doc.tracks.flatMap((t) => t.clips.map((c) => ({ kind: t.kind, props: c.props as Record<string, unknown> })));
  const shots = clips.flatMap((c) => (typeof c.props.name === 'string' && SHOT.test(c.props.name) ? [c.props.name] : []));
  const audio = new Map((doc.assets ?? []).filter((a) => a.kind === 'audio').map((a) => [a.id, a.name || a.id]));
  const music = clips.filter((c) => c.kind === TrackKind.Audio).flatMap((c) => Object.values(c.props).flatMap((v) => (typeof v === 'string' && audio.has(v) ? [audio.get(v)!] : [])));

  return {
    style: doc.style ?? null,
    typeScale: doc.referenceLook?.typeScale ?? null,
    palette: doc.referenceLook?.palette ?? [],
    fonts: unique((doc.fonts ?? []).map((f) => f.family)),
    shots: unique(shots),
    music: unique(music)
  };
}

const LINES: readonly [keyof StudioMemory, (v: never) => string][] = [
  ['style', (v: string) => `style ${v}`],
  ['typeScale', (v: number) => `largest type ${Math.round(v * 100)}% of the frame height`],
  ['palette', (v: string[]) => `palette ${v.join(' ')}`],
  ['fonts', (v: string[]) => `fonts ${v.join(', ')}`],
  ['shots', (v: string[]) => `shots ${v.join(', ')}`],
  ['music', (v: string[]) => `music ${v.join(', ')}`]
];

const present = (v: unknown) => v !== null && (!Array.isArray(v) || v.length > 0);

export function memoryNote(memory: StudioMemory): string {
  const parts = LINES.filter(([key]) => present(memory[key])).map(([key, say]) => say(memory[key] as never));
  return parts.length ? `Studio memory, from the last video made in this project: ${parts.join('; ')}. Reuse this look, type scale, shot choices and music taste for this video unless the user asks for something different.` : '';
}
