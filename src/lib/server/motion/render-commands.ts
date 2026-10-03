import type { AudioEntry } from '$lib/motion/audio-plan';

const QUIET = ['-y', '-v', 'error'];
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = '192k';
const MS_PER_S = 1000;

export type AssembleInput = { list: string; audio: string | null; out: string };

const round = (n: number) => Math.round(n * MS_PER_S) / MS_PER_S;

function clipFilter(e: AudioEntry, i: number): string {
  const steps = [`aresample=${SAMPLE_RATE}`, `volume=${round(e.volume)}`];
  if (e.fadeIn > 0) {
    steps.push(`afade=t=in:st=0:d=${round(e.fadeIn)}`);
  }
  if (e.fadeOut > 0) {
    steps.push(`afade=t=out:st=${round(e.duration - e.fadeOut)}:d=${round(e.fadeOut)}`);
  }
  steps.push(`adelay=${Math.round(e.at * MS_PER_S)}:all=1`);
  return `[${i}:a]${steps.join(',')}[a${i}]`;
}

export function audioMixArgs(entries: AudioEntry[], seconds: number, out: string): string[] | null {
  if (!entries.length) {
    return null;
  }

  const inputs = entries.flatMap((e) => ['-ss', String(round(e.offset)), '-t', String(round(e.duration)), '-i', e.url]);
  const labels = entries.map((_, i) => `[a${i}]`).join('');
  const mix = `${labels}amix=inputs=${entries.length}:normalize=0:duration=longest,apad,atrim=0:${round(seconds)}[mix]`;
  const graph = [...entries.map(clipFilter), mix].join(';');

  return [...QUIET, ...inputs, '-filter_complex', graph, '-map', '[mix]', '-c:a', 'aac', '-b:a', AUDIO_BITRATE, out];
}

export function concatList(paths: string[]): string {
  return paths.map((p) => `file '${p}'\n`).join('');
}

export function assembleArgs(input: AssembleInput): string[] {
  const audioIn = input.audio ? ['-i', input.audio] : [];
  const audioMap = input.audio ? ['-map', '1:a'] : [];
  const audioCodec = input.audio ? ['-c:a', 'copy'] : [];
  return [...QUIET, '-f', 'concat', '-safe', '0', '-i', input.list, ...audioIn, '-map', '0:v', ...audioMap, '-c:v', 'copy', ...audioCodec, '-movflags', '+faststart', input.out];
}
