import type { AudioEntry, GainPoint } from '$lib/motion/audio-plan';
import { ExportFormat, GifLoop, type GifOptions } from '$lib/motion/export-formats';

const QUIET = ['-y', '-v', 'error'];
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = '192k';
const OPUS_BITRATE = '160k';
const MS_PER_S = 1000;

export type AssembleInput = { list: string; audio: string | null; out: string; format: ExportFormat; gif?: GifOptions };

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
type Finisher = Finish | ((gif: GifOptions) => Finish);

const AS_IS = (out: string) => out;
const VIDEO = ['-map', '0:v'];
const FASTSTART = ['-movflags', '+faststart'];
const PCM = ['-c:a', 'pcm_s16le'];
const GIF_PALETTE = 'split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle:alpha_threshold=128';
const GIF_LOOP_ARG: Record<GifLoop, string> = { [GifLoop.Forever]: '0', [GifLoop.Once]: '-1', [GifLoop.Boomerang]: '0' };
const DEFAULT_GIF: GifOptions = { loop: GifLoop.Forever, fps: 15, width: 640 };

function gifGraph(gif: GifOptions): string {
  const shrunk = `fps=${gif.fps},scale='min(${gif.width},iw)':-2:flags=lanczos`;
  if (gif.loop !== GifLoop.Boomerang) {
    return `[0:v]${shrunk},${GIF_PALETTE}`;
  }
  return `[0:v]${shrunk},split[f][r];[r]trim=start_frame=1,reverse,trim=start_frame=1,setpts=N/FRAME_RATE/TB[rv];[f][rv]concat=n=2:v=1:a=0,${GIF_PALETTE}`;
}

const gifFinish = (gif: GifOptions): Finish => ({ decode: ['-c:v', 'libvpx-vp9'], map: [], video: ['-filter_complex', gifGraph(gif)], audio: null, tail: ['-loop', GIF_LOOP_ARG[gif.loop]], target: AS_IS });

export const PNG_PATTERN = 'frame_%05d.png';

const FINISH: Record<ExportFormat, Finisher> = {
  [ExportFormat.Mp4H264]: { decode: [], map: VIDEO, video: ['-c:v', 'copy'], audio: ['-c:a', 'copy'], tail: FASTSTART, target: AS_IS },
  [ExportFormat.Mp4H265]: { decode: [], map: VIDEO, video: ['-c:v', 'copy', '-tag:v', 'hvc1'], audio: ['-c:a', 'copy'], tail: FASTSTART, target: AS_IS },
  [ExportFormat.ProRes4444]: { decode: [], map: VIDEO, video: ['-c:v', 'copy'], audio: PCM, tail: [], target: AS_IS },
  [ExportFormat.ProRes422]: { decode: [], map: VIDEO, video: ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le'], audio: PCM, tail: [], target: AS_IS },
  [ExportFormat.WebmAlpha]: { decode: [], map: VIDEO, video: ['-c:v', 'copy'], audio: ['-c:a', 'libopus', '-b:a', OPUS_BITRATE], tail: [], target: AS_IS },
  [ExportFormat.Gif]: gifFinish,
  [ExportFormat.Apng]: { decode: ['-c:v', 'libvpx-vp9'], map: VIDEO, video: ['-pix_fmt', 'rgba'], audio: null, tail: ['-f', 'apng', '-plays', '0'], target: AS_IS },
  [ExportFormat.PngSequence]: { decode: [], map: VIDEO, video: ['-pix_fmt', 'rgba'], audio: null, tail: [], target: (out) => `${out}/${PNG_PATTERN}` }
};

export function assembleArgs(input: AssembleInput): string[] {
  const chosen = FINISH[input.format];
  const finish = typeof chosen === 'function' ? chosen(input.gif ?? DEFAULT_GIF) : chosen;
  const audio = finish.audio && input.audio ? { in: ['-i', input.audio], map: ['-map', '1:a'], codec: finish.audio } : { in: [], map: [], codec: [] };
  return [...QUIET, ...finish.decode, '-f', 'concat', '-safe', '0', '-i', input.list, ...audio.in, ...finish.map, ...audio.map, ...finish.video, ...audio.codec, ...finish.tail, finish.target(input.out)];
}

export function zipArgs(dir: string, out: string): string[] {
  return ['-lc', `cd ${dir} && zip -q -0 -r ${out} .`];
}
