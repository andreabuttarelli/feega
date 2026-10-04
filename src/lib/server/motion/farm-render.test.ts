import { describe, expect, it } from 'vitest';
import { renderOnFarm, RenderFailure, type FarmJob } from './farm-render';
import type { FarmFile, FarmRun, FarmWorker, RenderFarm, WorkerSpec } from './render-farm';
import type { RenderEvent } from '$lib/motion/server-render';
import { ExportFormat, Quality } from '$lib/motion/export-formats';

type FakeWorker = FarmWorker & { id: number; files: FarmFile[]; runs: string[]; stopped: boolean };

function fakeFarm(fail: (w: number, cmd: string) => boolean = () => false) {
  const workers: FakeWorker[] = [];
  const specs: WorkerSpec[] = [];
  const farm: RenderFarm = {
    open: async (spec) => {
      specs.push(spec);
      const w: FakeWorker = {
        id: workers.length,
        files: [],
        runs: [],
        stopped: false,
        write: async (files) => {
          w.files.push(...files);
        },
        run: async (cmd, args): Promise<FarmRun> => {
          const line = [cmd, ...args].join(' ');
          w.runs.push(line);
          return fail(w.id, line) ? { exitCode: 1, output: 'chrome crashed\n' } : { exitCode: 0, output: '' };
        },
        read: async (path) => Buffer.from(`w${w.id}:${path}`),
        stop: async () => {
          w.stopped = true;
        }
      };
      workers.push(w);
      return w;
    }
  };
  return { farm, workers, specs };
}

const specOf = (w: FakeWorker) => JSON.parse(w.files.find((f) => f.path.endsWith('spec.json'))?.content.toString() ?? 'null');

const job: FarmJob = {
  html: '<html></html>',
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 840,
  audio: [{ clipId: 'm', url: 'https://x.supabase.co/m.mp3', at: 0, offset: 0, duration: 28, volume: 1, fadeIn: 1, fadeOut: 2 }],
  allowHosts: ['x.supabase.co'],
  format: ExportFormat.Mp4H264,
  quality: Quality.High,
  motionBlur: null
};

describe('renderOnFarm', () => {
  it('opens one worker per chunk, each rendering its own index of the same plan', async () => {
    const { farm, workers } = fakeFarm();

    await renderOnFarm(farm, job, () => {});

    expect(workers).toHaveLength(7);
    workers.forEach((w, i) => expect(specOf(w)).toMatchObject({ route: 'chunked', index: i, config: { fps: 30, width: 1920, height: 1080, chunkSize: 120 } }));
  });

  it.each([25, 50])('a %i fps video renders whole on one worker, since chunked renders take 24, 30 or 60', async (fps) => {
    const { farm, workers, specs } = fakeFarm();

    await renderOnFarm(farm, { ...job, fps }, () => {});

    expect(workers).toHaveLength(1);
    expect(specOf(workers[0])).toMatchObject({ route: 'whole', config: { fps } });
    expect(specs[0].vcpus).toBe(8);
  });

  it('only the asset origin and the runtime CDNs are reachable', async () => {
    const { farm, specs } = fakeFarm();

    await renderOnFarm(farm, job, () => {});

    expect(specs[0].allowHosts).toEqual(['x.supabase.co', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);
  });

  it('the first worker mixes the audio, collects every chunk in order and returns the joined file', async () => {
    const { farm, workers } = fakeFarm();

    const bytes = await renderOnFarm(farm, job, () => {});

    const head = workers[0];
    expect(head.runs.some((r) => r.startsWith('ffmpeg') && r.includes('amix'))).toBe(true);
    expect(head.files.filter((f) => f.path.endsWith('.mp4')).map((f) => f.content.toString())).toEqual(workers.slice(1).map((w) => `w${w.id}:/vercel/sandbox/job/c${w.id}.mp4`));
    expect(head.files.find((f) => f.path.endsWith('chunks.txt'))?.content.toString().split('\n')[0]).toBe("file '/vercel/sandbox/job/c0.mp4'");
    expect(head.runs.at(-1)).toContain('-map 1:a');
    expect(bytes.toString()).toBe('w0:/vercel/sandbox/job/out.mp4');
  });

  it('a silent doc skips the mix', async () => {
    const { farm, workers } = fakeFarm();

    await renderOnFarm(farm, { ...job, audio: [] }, () => {});

    expect(workers[0].runs.some((r) => r.includes('amix'))).toBe(false);
    expect(workers[0].runs.at(-1)).not.toContain('-map 1:a');
  });

  it('reports a chunk as it lands, then assembling', async () => {
    const { farm } = fakeFarm();
    const events: RenderEvent['kind'][] = [];

    await renderOnFarm(farm, job, (e) => events.push(e.kind));

    expect(events).toEqual([...Array(7).fill('chunk'), 'assembling']);
  });

  it('a chunk that fails fails the render with its output, and every worker is stopped', async () => {
    const { farm, workers } = fakeFarm((w, cmd) => w === 3 && cmd.includes('render-chunk.mjs'));

    await expect(renderOnFarm(farm, job, () => {})).rejects.toThrow(new RenderFailure('chunk 3 failed: chrome crashed'));
    expect(workers.every((w) => w.stopped)).toBe(true);
  });

  it('every worker is stopped after success too', async () => {
    const { farm, workers } = fakeFarm();

    await renderOnFarm(farm, job, () => {});

    expect(workers.every((w) => w.stopped)).toBe(true);
  });
});

describe('renderOnFarm with motion blur', () => {
  const blur = { shutterAngle: 180, shutterPhase: -90, samples: 8 };

  it('renders whole on one worker, since the distributed producer has no motion blur, and passes the shutter to the engine', async () => {
    const { farm, workers } = fakeFarm();

    await renderOnFarm(farm, { ...job, totalFrames: 120, motionBlur: blur }, () => {});

    expect(workers).toHaveLength(1);
    expect(specOf(workers[0])).toMatchObject({ route: 'whole', config: { motionBlur: { shutterAngle: 180, shutterPhase: -90, samplesPerFrame: 8 } } });
  });

  it('a video clip cannot blur, the engine extracts its frames once per output frame', async () => {
    const { farm, workers } = fakeFarm();

    await expect(renderOnFarm(farm, { ...job, html: '<video id="c-v" src="x">', motionBlur: blur }, () => {})).rejects.toThrow(/Video/);
    expect(workers).toHaveLength(0);
  });

  it('more blurred samples than one machine renders in time are refused, with what to lower', async () => {
    const { farm, workers } = fakeFarm();

    await expect(renderOnFarm(farm, { ...job, fps: 60, totalFrames: 600, motionBlur: blur }, () => {})).rejects.toThrow(/samples/);
    expect(workers).toHaveLength(0);
    await expect(renderOnFarm(farm, { ...job, fps: 60, totalFrames: 480, motionBlur: blur }, () => {})).resolves.toBeDefined();
  });

  it('without blur the config carries none', async () => {
    const { farm, workers } = fakeFarm();

    await renderOnFarm(farm, job, () => {});

    expect(specOf(workers[0]).config).not.toHaveProperty('motionBlur');
  });
});

describe('renderOnFarm by export format', () => {
  it.each([
    [ExportFormat.Mp4H265, { format: 'mp4', codec: 'h265' }, 'mp4', 'mp4'],
    [ExportFormat.ProRes4444, { format: 'mov' }, 'mov', 'mov'],
    [ExportFormat.ProRes422, { format: 'mov' }, 'mov', 'mov'],
    [ExportFormat.WebmAlpha, { format: 'webm' }, 'webm', 'webm'],
    [ExportFormat.Gif, { format: 'webm' }, 'webm', 'gif']
  ])('%s chunks render a %o master and the head writes the .%s → .%s file', async (format, master, chunkExt, outExt) => {
    const { farm, workers } = fakeFarm();

    const bytes = await renderOnFarm(farm, { ...job, format }, () => {});

    expect(specOf(workers[1]).config).toMatchObject(master);
    expect(specOf(workers[1]).out).toBe(`/vercel/sandbox/job/c1.${chunkExt}`);
    expect(bytes.toString()).toBe(`w0:/vercel/sandbox/job/out.${outExt}`);
  });

  it('only an mp4 master names a codec, the producer refuses one on other containers', async () => {
    const { farm, workers } = fakeFarm();

    await renderOnFarm(farm, { ...job, format: ExportFormat.WebmAlpha }, () => {});

    expect(specOf(workers[0]).config).not.toHaveProperty('codec');
  });

  it('a GIF and a PNG sequence carry no audio, so nothing is mixed', async () => {
    for (const format of [ExportFormat.Gif, ExportFormat.PngSequence]) {
      const { farm, workers } = fakeFarm();

      await renderOnFarm(farm, { ...job, format }, () => {});

      expect(workers[0].runs.some((r) => r.includes('amix'))).toBe(false);
    }
  });

  it('a PNG sequence writes frames into a folder and zips it', async () => {
    const { farm, workers } = fakeFarm();

    const bytes = await renderOnFarm(farm, { ...job, format: ExportFormat.PngSequence }, () => {});

    expect(workers[0].runs.some((r) => r.includes('/vercel/sandbox/job/frames/frame_%05d.png'))).toBe(true);
    expect(workers[0].runs.at(-1)).toContain('zip -q');
    expect(bytes.toString()).toBe('w0:/vercel/sandbox/job/out.zip');
  });

  it('H.265 is refused before any worker opens when the video must render whole', async () => {
    const { farm, workers } = fakeFarm();

    await expect(renderOnFarm(farm, { ...job, fps: 25, format: ExportFormat.Mp4H265 }, () => {})).rejects.toThrow(/H\.265/);
    expect(workers).toHaveLength(0);
  });
});
