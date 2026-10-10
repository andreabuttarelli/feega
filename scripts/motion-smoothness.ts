import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { frameDiffs, motionJolts } from '$lib/motion/smoothness';

const [video, docPath] = process.argv.slice(2);
const SIZE = { width: 108, height: 192 };
const FRAME_BYTES = SIZE.width * SIZE.height;

const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `scale=${SIZE.width}:${SIZE.height},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
const frames = Array.from({ length: raw.length / FRAME_BYTES }, (_, i) => raw.subarray(i * FRAME_BYTES, (i + 1) * FRAME_BYTES));
const doc = docPath ? JSON.parse(readFileSync(docPath, 'utf8')) : null;
const fps = doc?.fps ?? 30;
type Clip = { from: number; durationInFrames: number; junction?: unknown };
const clips: Clip[] = doc ? doc.tracks.flatMap((t: { clips: Clip[] }) => t.clips) : [];
const joined = new Set(clips.filter((c) => c.junction).map((c) => c.from));
const edges = clips.flatMap((c) => [c.from, c.from + c.durationInFrames]).filter((f) => !joined.has(f));
const cuts = edges.flatMap((f) => [f - 1, f]);

const jolts = motionJolts(frameDiffs(frames), { cuts });
console.log(`frames ${frames.length}, jolts ${jolts.length}`);
for (const j of jolts) {
  console.log(`${((j.frame + 1) / fps).toFixed(2)}s frame ${j.frame + 1} ${j.kind} ${j.value.toFixed(2)} (around ${j.around.toFixed(2)})`);
}
process.exit(0);
