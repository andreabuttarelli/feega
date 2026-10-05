import { describe, expect, it } from 'vitest';
import { assembleArgs, audioMixArgs, concatList } from './render-commands';
import type { AudioEntry } from '$lib/motion/audio-plan';
import { ExportFormat } from '$lib/motion/export-formats';

const flat = (at: number, end: number, value: number) => [
  { time: at, value },
  { time: end, value }
];
const music: AudioEntry = { clipId: 'm', url: 'https://x.supabase.co/a.mp3?token=t', at: 0, offset: 0, duration: 28, left: flat(0, 28, 1), right: flat(0, 28, 1) };
const vo: AudioEntry = { clipId: 'v', url: 'https://x.supabase.co/v.mp3?token=t', at: 2.5, offset: 0.5, duration: 4, left: flat(2.5, 6.5, 0.6), right: flat(2.5, 6.5, 0.3) };
const ducked: AudioEntry = {
  ...music,
  left: [
    { time: 0, value: 0 },
    { time: 1, value: 1 },
    { time: 2, value: 1 },
    { time: 2.5, value: 0.25 }
  ]
};

function evaluate(expr: string, t: number): number {
  const js = expr
    .replace(/gte\(t,([\d.]+)\)/g, (_m, a) => `(${t}>=${a}?1:0)`)
    .replace(/lt\(t,([\d.]+)\)/g, (_m, b) => `(${t}<${b}?1:0)`)
    .replace(/\bt\b/g, String(t));
  return Number(new Function(`return ${js}`)());
}

function volumeOf(graph: string, label: string): string {
  const match = new RegExp(`\\[${label}\\]volume='([^']*)'`).exec(graph) ?? new RegExp(`\\[${label}\\]volume=([^:,\\[]*)`).exec(graph);
  return match ? match[1] : '';
}

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

  it('each clip is split into left and right, each at its own level, then delayed to its start', () => {
    const graph = graphOf(audioMixArgs([music, vo], 28, 'mix.m4a')!);

    expect(graph).toContain('[1:a]aresample=48000,aformat=channel_layouts=stereo,asetnsamples=n=64,channelsplit=channel_layout=stereo[l1][r1]');
    expect([volumeOf(graph, 'l1'), volumeOf(graph, 'r1')]).toEqual(['0.6', '0.3']);
    expect(graph).toContain('[gl1][gr1]join=inputs=2:channel_layout=stereo,adelay=2500:all=1[a1]');
  });

  it('a gain curve becomes a time expression measured from the clip start', () => {
    const graph = graphOf(audioMixArgs([{ ...ducked, at: 3, left: ducked.left.map((p) => ({ ...p, time: p.time + 3 })) }], 28, 'mix.m4a')!);
    const expr = volumeOf(graph, 'l0');

    expect(graph).toContain(`[l0]volume='${expr}':eval=frame[gl0]`);
    expect([0, 0.5, 1, 2, 2.25, 2.5, 9].map((t) => evaluate(expr, t))).toEqual([0, 0.5, 1, 1, 0.625, 0.25, 0.25]);
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
    expect(assembleArgs({ list: 'l.txt', audio: 'mix.m4a', out: 'o.mp4', format: ExportFormat.Mp4H264 })).toEqual([
      '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'l.txt', '-i', 'mix.m4a',
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', 'o.mp4'
    ]);
  });

  it('a silent video is the concat alone', () => {
    expect(assembleArgs({ list: 'l.txt', audio: null, out: 'o.mp4', format: ExportFormat.Mp4H264 })).toEqual([
      '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'l.txt', '-map', '0:v', '-c:v', 'copy', '-movflags', '+faststart', 'o.mp4'
    ]);
  });
});

describe('finishing each format', () => {
  const args = (format: ExportFormat, audio: string | null = 'mix.m4a') => assembleArgs({ list: 'l.txt', audio, out: 'o', format }).join(' ');

  it('HEVC is copied and tagged so Apple players open it', () => {
    expect(args(ExportFormat.Mp4H265)).toContain('-c:v copy -tag:v hvc1');
  });

  it('ProRes 4444 keeps the master and its alpha, with PCM audio', () => {
    expect(args(ExportFormat.ProRes4444)).toContain('-c:v copy -c:a pcm_s16le');
    expect(args(ExportFormat.ProRes4444)).not.toContain('faststart');
  });

  it('ProRes 422 HQ is re-encoded from the master at profile 3, 10-bit 4:2:2', () => {
    expect(args(ExportFormat.ProRes422)).toContain('-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le');
  });

  it('WebM keeps VP9 alpha and carries Opus audio', () => {
    expect(args(ExportFormat.WebmAlpha)).toContain('-c:v copy -c:a libopus');
  });

  it('a GIF is decoded with its alpha, palette-optimised, capped, silent and looping', () => {
    const gif = args(ExportFormat.Gif);

    expect(gif).toContain('-c:v libvpx-vp9 -f concat');
    expect(gif).toMatch(/fps=15,scale='min\(640,iw\)':-2.*palettegen.*paletteuse/);
    expect(gif).not.toContain('mix.m4a');
    expect(gif).toContain('-loop 0');
  });

  it('a PNG sequence writes numbered frames, silent', () => {
    const png = args(ExportFormat.PngSequence);

    expect(png).toContain('frame_%05d.png');
    expect(png).not.toContain('mix.m4a');
  });
});
