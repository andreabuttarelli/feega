import { describe, expect, it } from 'vitest';
import { assembleArgs, audioMixArgs, concatList } from './render-commands';
import type { AudioEntry } from '$lib/motion/audio-plan';

const music: AudioEntry = { clipId: 'm', url: 'https://x.supabase.co/a.mp3?token=t', at: 0, offset: 0, duration: 28, volume: 1, fadeIn: 1, fadeOut: 2 };
const vo: AudioEntry = { clipId: 'v', url: 'https://x.supabase.co/v.mp3?token=t', at: 2.5, offset: 0.5, duration: 4, volume: 0.6, fadeIn: 0, fadeOut: 0 };

function graphOf(args: string[]): string {
  return args[args.indexOf('-filter_complex') + 1];
}

describe('audioMixArgs', () => {
  it('no audible clip means no audio step at all', () => {
    expect(audioMixArgs([], 28, 'mix.m4a')).toBeNull();
  });

  it('each clip is read from its trim point for its own length', () => {
    const args = audioMixArgs([vo], 28, 'mix.m4a')!;

    expect(args.join(' ')).toContain(`-ss 0.5 -t 4 -i ${vo.url}`);
  });

  it('volume, fades and start time follow the doc', () => {
    const graph = graphOf(audioMixArgs([music, vo], 28, 'mix.m4a')!);

    expect(graph).toContain('[0:a]aresample=48000,volume=1,afade=t=in:st=0:d=1,afade=t=out:st=26:d=2,adelay=0:all=1[a0]');
    expect(graph).toContain('[1:a]aresample=48000,volume=0.6,adelay=2500:all=1[a1]');
  });

  it('the mix is exactly as long as the video, padded with silence', () => {
    const graph = graphOf(audioMixArgs([vo], 28, 'mix.m4a')!);

    expect(graph).toContain('[a0]amix=inputs=1:normalize=0:duration=longest,apad,atrim=0:28[mix]');
  });

  it('writes AAC to the requested file', () => {
    const args = audioMixArgs([music], 28, 'mix.m4a')!;

    expect(args.slice(-7)).toEqual(['-map', '[mix]', '-c:a', 'aac', '-b:a', '192k', 'mix.m4a']);
  });
});

describe('assemble', () => {
  it('lists chunks in order for the concat demuxer', () => {
    expect(concatList(['/w/c0.mp4', '/w/c1.mp4'])).toBe("file '/w/c0.mp4'\nfile '/w/c1.mp4'\n");
  });

  it('joins chunks without re-encoding and muxes the mix, web-ready', () => {
    expect(assembleArgs({ list: 'l.txt', audio: 'mix.m4a', out: 'o.mp4' })).toEqual([
      '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'l.txt', '-i', 'mix.m4a',
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', 'o.mp4'
    ]);
  });

  it('a silent video is the concat alone', () => {
    expect(assembleArgs({ list: 'l.txt', audio: null, out: 'o.mp4' })).toEqual([
      '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'l.txt', '-map', '0:v', '-c:v', 'copy', '-movflags', '+faststart', 'o.mp4'
    ]);
  });
});
