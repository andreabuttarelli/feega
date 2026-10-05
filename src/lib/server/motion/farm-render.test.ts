import { describe, expect, it } from 'vitest';
import { checkTask, FarmTask, farmChunks, farmProblem, framesOf, halves, launchAssembly, launchPiece, TaskState, type FarmJob, type Step } from './farm-render';
import type { FarmFile, FarmWorker, RenderFarm, WorkerSpec } from './render-farm';
import { ExportFormat, Quality } from '$lib/motion/export-formats';

type FakeWorker = FarmWorker & { files: Map<string, Buffer>; spawned: string[]; stopped: boolean };

function fakeFarm() {
  const workers: FakeWorker[] = [];
  const specs: WorkerSpec[] = [];
  const farm: RenderFarm = {
    open: async (spec) => {
      specs.push(spec);
      const w: FakeWorker = {
        name: `w${workers.length}`,
        files: new Map(),
        spawned: [],
        stopped: false,
        write: async (files: FarmFile[]) => {
          files.forEach((f) => w.files.set(f.path, f.content));
        },
        run: async () => ({ exitCode: 0, output: '' }),
        spawn: async (cmd, args) => {
          w.spawned.push([cmd, ...args].join(' '));
        },
        read: async (path) => w.files.get(path) ?? null,
        stop: async () => {
          w.stopped = true;
        }
      };
      workers.push(w);
      return w;
    },
    attach: async (name) => workers.find((w) => w.name === name && !w.stopped) ?? null
  };
  return { farm, workers, specs };
}

const json = (w: FakeWorker, suffix: string) => JSON.parse(String([...w.files.entries()].find(([p]) => p.endsWith(suffix))?.[1] ?? 'null'));
const steps = (w: FakeWorker, task: FarmTask): Step[] => json(w, `steps-${task}.json`);
const specOf = (w: FakeWorker) => json(w, 'spec.json');
const line = (s: Step) => [s.cmd, ...s.args].join(' ');

const job: FarmJob = {
  html: '<html></html>',
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 840,
  audio: [{ clipId: 'm', url: 'https://x.supabase.co/m.mp3', at: 0, offset: 0, duration: 28, left: [{ time: 0, value: 1 }, { time: 28, value: 1 }], right: [{ time: 0, value: 1 }, { time: 28, value: 1 }] }],
  allowHosts: ['x.supabase.co'],
  format: ExportFormat.Mp4H264,
  quality: Quality.High,
  motionBlur: null
};

const STORAGE = 's.supabase.co';
const blur = { shutterAngle: 180, shutterPhase: -90, samples: 8 };

describe('launchPiece', () => {
  it('starts the chunk detached on its own worker and returns the worker name the tick finds it by', async () => {
    const { farm, workers } = fakeFarm();

    const name = await launchPiece(farm, job, { index: 3, size: 120 }, { upload: 'https://s.supabase.co/up/c3', storageHost: STORAGE, maxBytes: 1000 });

    expect(name).toBe('w0');
    expect(specOf(workers[0])).toMatchObject({ route: 'chunked', index: 3, config: { fps: 30, width: 1920, height: 1080, chunkSize: 120 } });
    expect(workers[0].spawned).toEqual([expect.stringContaining('steps-piece.json')]);
  });

  it('a chunk other than the first uploads itself to its signed URL, the first stays on the worker that assembles', async () => {
    const { farm, workers } = fakeFarm();

    await launchPiece(farm, job, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });
    await launchPiece(farm, job, { index: 2, size: 120 }, { upload: 'https://s.supabase.co/up/c2', storageHost: STORAGE, maxBytes: 1000 });

    expect(steps(workers[0], FarmTask.Piece).map(line)).toEqual([expect.stringContaining('render-chunk.mjs')]);
    expect(line(steps(workers[1], FarmTask.Piece).at(-2)!)).toContain('-le 1000');
    expect(steps(workers[1], FarmTask.Piece).at(-1)!.args).toEqual(expect.arrayContaining(['-T', '/vercel/sandbox/job/c240.mp4', 'https://s.supabase.co/up/c2']));
  });

  it('only the asset origin, storage and the runtime CDNs are reachable', async () => {
    const { farm, specs } = fakeFarm();

    await launchPiece(farm, job, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    expect(specs[0].allowHosts).toEqual(['x.supabase.co', STORAGE, 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);
  });

  it.each([25, 50])('a %i fps video renders whole on 8 vCPUs, since chunked renders take 24, 30 or 60', async (fps) => {
    const { farm, workers, specs } = fakeFarm();

    await launchPiece(farm, { ...job, fps }, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    expect(specOf(workers[0])).toMatchObject({ route: 'whole', config: { fps } });
    expect(specs[0].vcpus).toBe(8);
    expect(farmChunks({ ...job, fps })).toEqual({ size: 840, count: 1 });
  });

  it('motion blur renders whole and passes the shutter to the engine', async () => {
    const { farm, workers } = fakeFarm();

    await launchPiece(farm, { ...job, motionBlur: blur }, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    expect(specOf(workers[0])).toMatchObject({ route: 'whole', config: { motionBlur: { shutterAngle: 180, shutterPhase: -90, samplesPerFrame: 8 } } });
  });

  it('motion blur over a video renders frames extracted on the worker, not the producer\'s injected ones', async () => {
    const { farm, workers } = fakeFarm();
    const video = '<html><body><video id="c-v" src="https://x.supabase.co/v.mp4" data-start="0" data-duration="2" data-media-start="0"></video></body></html>';

    await launchPiece(farm, { ...job, html: video, motionBlur: blur }, { index: 0, size: 840 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    const lines = steps(workers[0], FarmTask.Piece).map(line);
    expect(lines.findIndex((l) => l.includes('ffmpeg'))).toBeLessThan(lines.findIndex((l) => l.includes('render-chunk.mjs')));
    expect(String(workers[0].files.get('/vercel/sandbox/job/project/index.html'))).toContain('data-strip="0"');
  });

  it('without motion blur the producer keeps injecting video frames', async () => {
    const { farm, workers } = fakeFarm();
    const video = '<video id="c-v" src="https://x.supabase.co/v.mp4" data-start="0" data-duration="2" data-media-start="0"></video>';

    await launchPiece(farm, { ...job, html: video }, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    expect(String(workers[0].files.get('/vercel/sandbox/job/project/index.html'))).toBe(video);
  });

  it('only an mp4 master names a codec, the producer refuses one on other containers', async () => {
    const { farm, workers } = fakeFarm();

    await launchPiece(farm, { ...job, format: ExportFormat.WebmAlpha }, { index: 1, size: 120 }, { upload: 'u', storageHost: STORAGE, maxBytes: 1000 });

    expect(specOf(workers[0]).config).not.toHaveProperty('codec');
    expect(specOf(workers[0]).out).toBe('/vercel/sandbox/job/c120.webm');
  });
});

describe('halves', () => {
  it('a chunk that timed out splits into the two halves of its frames, on the grid of half the size', () => {
    expect(halves(job, { index: 3, size: 120 })).toEqual([
      { index: 6, size: 60 },
      { index: 7, size: 60 }
    ]);
  });

  it('a half past the end is dropped', () => {
    expect(halves({ ...job, totalFrames: 150 }, { index: 1, size: 120 })).toEqual([{ index: 2, size: 60 }]);
  });

  it('a chunk too small to split, or a whole render, cannot be split', () => {
    expect(halves(job, { index: 0, size: 18 })).toBeNull();
    expect(halves({ ...job, motionBlur: blur }, { index: 0, size: 840 })).toBeNull();
  });

  it('the chunks of a 3D-heavy job are smaller than those of a flat one', () => {
    const heavy = { ...job, cost: [{ from: 0, to: 840, ms: 1200 }] };

    expect(farmChunks(heavy).size).toBeLessThan(farmChunks(job).size);
  });

  it('a chunk names its frames, which is what a failure reports', () => {
    expect(framesOf(job, { index: 2, size: 120 })).toBe('frames 240–359');
  });
});

describe('farmProblem', () => {
  it('a 60 s 1080p60 video with motion blur is no longer refused for its samples', () => {
    expect(farmProblem({ ...job, fps: 60, totalFrames: 3600, motionBlur: blur })).toBeNull();
  });

  it('blur that cannot finish inside one worker lifetime is refused, with what to lower', () => {
    expect(farmProblem({ ...job, fps: 60, totalFrames: 10_800, motionBlur: { ...blur, samples: 64 } })).toMatch(/samples/);
  });

  it('a video clip blurs like any other clip, and H.265 cannot render whole', () => {
    expect(farmProblem({ ...job, html: '<video id="c-v" src="x">', motionBlur: blur })).toBeNull();
    expect(farmProblem({ ...job, fps: 25, format: ExportFormat.Mp4H265 })).toMatch(/H\.265/);
  });

  it('30 s at 1080p with a device on screen the whole time blurs with 3 samples, not with 8', () => {
    const showcase = { ...job, totalFrames: 900, cost: [{ from: 0, to: 900, ms: 1600 }] };

    expect(farmProblem({ ...showcase, motionBlur: { ...blur, samples: 3 } })).toBeNull();
    expect(farmProblem({ ...showcase, motionBlur: { ...blur, samples: 8 } })).toMatch(/samples/);
  });
});

describe('launchAssembly', () => {
  const links = { pieces: ['https://s/d1', 'https://s/d2'], output: 'https://s/up/out', maxBytes: 50 * 1024 * 1024 };

  async function assembled(j: FarmJob = job) {
    const { farm, workers } = fakeFarm();
    await launchPiece(farm, j, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });
    await launchAssembly(farm, workers[0].name, j, [0, 1, 2].map((index) => ({ index, size: 120 })), links);
    return { worker: workers[0], lines: steps(workers[0], FarmTask.Assembly).map(line) };
  }

  it('downloads the other chunks, mixes the audio, joins in order, checks the size and uploads the file', async () => {
    const { worker, lines } = await assembled();

    expect(lines[0]).toContain('https://s/d1 -o /vercel/sandbox/job/c120.mp4');
    expect(lines[1]).toContain('https://s/d2 -o /vercel/sandbox/job/c240.mp4');
    expect(lines.some((l) => l.includes('amix'))).toBe(true);
    expect(lines.find((l) => l.includes('concat'))).toContain('-map 1:a');
    expect(String(worker.files.get('/vercel/sandbox/job/chunks.txt')).split('\n').slice(0, 3)).toEqual(["file '/vercel/sandbox/job/c0.mp4'", "file '/vercel/sandbox/job/c120.mp4'", "file '/vercel/sandbox/job/c240.mp4'"]);
    expect(lines.at(-2)).toContain('52428800');
    expect(lines.at(-1)).toMatch(/-T \/vercel\/sandbox\/job\/out\.mp4 .*https:\/\/s\/up\/out$/);
    expect(worker.spawned.at(-1)).toContain('steps-assembly.json');
  });

  it('a silent doc skips the mix', async () => {
    const { lines } = await assembled({ ...job, audio: [] });

    expect(lines.some((l) => l.includes('amix'))).toBe(false);
  });

  it('a PNG sequence writes frames into a folder and zips it', async () => {
    const { lines } = await assembled({ ...job, format: ExportFormat.PngSequence });

    expect(lines.some((l) => l.includes('/vercel/sandbox/job/frames/frame_%05d.png'))).toBe(true);
    expect(lines.some((l) => l.includes('zip -q'))).toBe(true);
    expect(lines.at(-1)).toContain('out.zip');
  });
});

describe('checkTask', () => {
  it('a worker without a result is still working', async () => {
    const { farm } = fakeFarm();
    const name = await launchPiece(farm, job, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    expect(await checkTask(farm, name, FarmTask.Piece)).toEqual({ state: TaskState.Running, error: null });
  });

  it('reads the result the worker wrote, success or the failing step with its output', async () => {
    const { farm, workers } = fakeFarm();
    const name = await launchPiece(farm, job, { index: 0, size: 120 }, { upload: null, storageHost: STORAGE, maxBytes: 1000 });

    workers[0].files.set('/vercel/sandbox/job/result-piece.json', Buffer.from(JSON.stringify({ ok: false, error: 'render failed: chrome crashed' })));
    expect(await checkTask(farm, name, FarmTask.Piece)).toEqual({ state: TaskState.Failed, error: 'render failed: chrome crashed' });

    workers[0].files.set('/vercel/sandbox/job/result-piece.json', Buffer.from(JSON.stringify({ ok: true, error: null })));
    expect(await checkTask(farm, name, FarmTask.Piece)).toEqual({ state: TaskState.Done, error: null });
  });

  it('a worker that is gone before writing a result failed: it timed out or crashed', async () => {
    const { farm } = fakeFarm();

    expect(await checkTask(farm, 'gone', FarmTask.Piece)).toEqual({ state: TaskState.Failed, error: expect.stringMatching(/stopped/) });
  });
});
