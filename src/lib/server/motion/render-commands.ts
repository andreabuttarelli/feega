import type { AudioEntry, GainPoint } from '$lib/motion/audio-plan';
import { ExportFormat, GIF } from '$lib/motion/export-formats';

const QUIET = ['-y', '-v', 'error'];
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = '192k';
const OPUS_BITRATE = '160k';
const MS_PER_S = 1000;

export type AssembleInput = { list: string; audio: string | null; out: string; format: ExportFormat };

const round = (n: number) => Math.round(n * MS_PER_S) / MS_PER_S;

const SPLIT_SAMPLES = 64;

function segment(a: GainPoint, b: GainPoint): string {
  const slope = round((b.value - a.value) / (b.time - a.time));
  return `gte(t,${round(a.time)})*lt(t,${round(b.time)})*(${round(a.value)}+${slope}*(t-${round(a.time)}))`;
}

function curveExpr(points: GainPoint[], at: number): string {
  const local = points.map((p) => ({ time: p.time - at, value: p.value }));
  if (local.every((p) => p.value === local[0].value)) {
    return String(round(local[0].value));
  }
  const last = local[local.length - 1];
  const ramps = local.slice(1).map((b, i) => segment(local[i], b));
  return `'${[...ramps, `gte(t,${round(last.time)})*${round(last.value)}`].join('+')}'`;
}

function clipFilter(e: AudioEntry, i: number): string {
  const head = `[${i}:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo,asetnsamples=n=${SPLIT_SAMPLES},channelsplit=channel_layout=stereo[l${i}][r${i}]`;
  const left = `[l${i}]volume=${curveExpr(e.left, e.at)}:eval=frame[gl${i}]`;
  const right = `[r${i}]volume=${curveExpr(e.right, e.at)}:eval=frame[gr${i}]`;
  const join = `[gl${i}][gr${i}]join=inputs=2:channel_layout=stereo,adelay=${Math.round(e.at * MS_PER_S)}:all=1[a${i}]`;
  return [head, left, right, join].join(';');
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

type Finish = { decode: string[]; map: string[]; video: string[]; audio: string[] | null; tail: string[]; target: (out: string) => string };

const AS_IS = (out: string) => out;
const VIDEO = ['-map', '0:v'];
const FASTSTART = ['-movflags', '+faststart'];
const PCM = ['-c:a', 'pcm_s16le'];
const GIF_GRAPH = `fps=${GIF.fps},scale='min(${GIF.maxWidth},iw)':-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle:alpha_threshold=128`;

export const PNG_PATTERN = 'frame_%05d.png';

const FINISH: Record<ExportFormat, Finish> = {
  [ExportFormat.Mp4H264]: { decode: [], map: VIDEO, video: ['-c:v', 'copy'], audio: ['-c:a', 'copy'], tail: FASTSTART, target: AS_IS },
  [ExportFormat.Mp4H265]: { decode: [], map: VIDEO, video: ['-c:v', 'copy', '-tag:v', 'hvc1'], audio: ['-c:a', 'copy'], tail: FASTSTART, target: AS_IS },
  [ExportFormat.ProRes4444]: { decode: [], map: VIDEO, video: ['-c:v', 'copy'], audio: PCM, tail: [], target: AS_IS },
  [ExportFormat.ProRes422]: { decode: [], map: VIDEO, video: ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le'], audio: PCM, tail: [], target: AS_IS },
  [ExportFormat.WebmAlpha]: { decode: [], map: VIDEO, video: ['-c:v', 'copy'], audio: ['-c:a', 'libopus', '-b:a', OPUS_BITRATE], tail: [], target: AS_IS },
  [ExportFormat.Gif]: { decode: ['-c:v', 'libvpx-vp9'], map: [], video: ['-filter_complex', `[0:v]${GIF_GRAPH}`], audio: null, tail: ['-loop', '0'], target: AS_IS },
  [ExportFormat.PngSequence]: { decode: [], map: VIDEO, video: ['-pix_fmt', 'rgba'], audio: null, tail: [], target: (out) => `${out}/${PNG_PATTERN}` }
};

export function assembleArgs(input: AssembleInput): string[] {
  const finish = FINISH[input.format];
  const audio = finish.audio && input.audio ? { in: ['-i', input.audio], map: ['-map', '1:a'], codec: finish.audio } : { in: [], map: [], codec: [] };
  return [...QUIET, ...finish.decode, '-f', 'concat', '-safe', '0', '-i', input.list, ...audio.in, ...finish.map, ...audio.map, ...finish.video, ...audio.codec, ...finish.tail, finish.target(input.out)];
}

export function zipArgs(dir: string, out: string): string[] {
  return ['-lc', `cd ${dir} && zip -q -0 -r ${out} .`];
}
