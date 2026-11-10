import { rasterOf, pictureSize, type Attached, type CoreRaster } from './core-web';
import { FromWorker, ToWorker, type Call, type Stats, type WorkerIn, type WorkerOut } from './render-wire';

const MAX_IN_FLIGHT = 2;
const IDLE_STATS: Stats = { outcome: 'reused', pending: true, cacheBytes: 0, pictureBytes: 0, scratchBytes: 0, wasmBytes: 0, lost: false, busy: false };

type Link = { worker: Worker; canvas: HTMLCanvasElement };

const links = new WeakMap<HTMLCanvasElement, Link>();

export const renderWorkerOffered = (): boolean => typeof OffscreenCanvas !== 'undefined' && 'gpu' in navigator && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function' && typeof createImageBitmap === 'function';

function linkOf(canvas: HTMLCanvasElement): { link: Link; offscreen?: OffscreenCanvas } {
  const known = links.get(canvas);
  if (known) {
    return { link: known };
  }
  const worker = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
  const link = { worker, canvas };
  links.set(canvas, link);
  return { link, offscreen: canvas.transferControlToOffscreen() };
}

function workerAttached(worker: Worker, groups: Set<string>, side: number): Attached {
  const fit = pictureSize(side);
  let calls: Call[] = [];
  let sent = 0;
  let acked = 0;
  let stats = IDLE_STATS;
  let flushing = false;
  let posterId = 0;
  const posters = new Map<number, (bytes: Uint8Array | null) => void>();
  let pictures = Promise.resolve();

  const post = (message: WorkerIn, transfer: Transferable[] = []) => worker.postMessage(message, transfer);

  function flush(frames = 0) {
    flushing = false;
    if (!calls.length && !frames) {
      return;
    }
    const transfer = calls.flatMap((c) => c.args.flatMap((a) => (ArrayBuffer.isView(a) ? [a.buffer] : [])));
    post({ kind: ToWorker.Calls, calls, frames }, transfer as Transferable[]);
    calls = [];
  }

  function call(name: string, ...args: unknown[]) {
    calls.push({ name, args });
    if (!flushing) {
      flushing = true;
      queueMicrotask(() => flushing && flush());
    }
  }

  function picture(clip: string, source: unknown, rawWidth: number, rawHeight: number) {
    const { width, height } = fit({ width: rawWidth, height: rawHeight });
    const copy = createImageBitmap(source as ImageBitmapSource, { resizeWidth: width, resizeHeight: height });
    pictures = pictures.then(() => copy).then(
      (bitmap) => post({ kind: ToWorker.Calls, calls: [{ name: 'picture', args: [clip, bitmap, width, height] }], frames: 0 }, [bitmap]),
      (e: unknown) => console.warn('[core] picture not sent to the render worker', clip, e)
    );
  }

  worker.addEventListener('message', (event: MessageEvent<WorkerOut>) => {
    const m = event.data;
    if (m.kind === FromWorker.Framed) {
      acked += m.frames;
      stats = m.stats;
      return;
    }
    if (m.kind === FromWorker.Poster) {
      posters.get(m.id)?.(m.bytes);
      posters.delete(m.id);
      return;
    }
    if (m.kind === FromWorker.Failed) {
      stats = { ...stats, lost: true };
    }
  });

  const kept = (key: string) => groups.add(key);

  return {
    draw: (list) => (call('draw', list), ''),
    set_camera: (x, y, zoom) => call('set_camera', x, y, zoom),
    patch_uses: (patch) => call('patch_uses', patch),
    set_overlay: (items) => call('set_overlay', items),
    set_live_overlay: (items) => call('set_live_overlay', items),
    frame: (now) => {
      call('frame', now);
      sent++;
      flush(1);
      return stats.outcome;
    },
    picture,
    put_group: (key, list) => (kept(key), call('put_group', key, list)),
    append_group: (key, list) => (kept(key), call('append_group', key, list)),
    put_group_packed: (key, list, floats, ends) => (kept(key), call('put_group_packed', key, list, floats, ends)),
    append_group_packed: (key, list, floats, ends) => (kept(key), call('append_group_packed', key, list, floats, ends)),
    patch_group: (from, to, splice) => {
      if (!groups.has(from)) {
        return false;
      }
      kept(to);
      call('patch_group', from, to, splice);
      return true;
    },
    drop_group: (key) => (groups.delete(key), call('drop_group', key)),
    cache_pending: () => stats.pending,
    cache_bytes: () => stats.cacheBytes,
    scratch_bytes: () => stats.scratchBytes,
    picture_bytes: () => stats.pictureBytes,
    forget_picture: (clip) => {
      pictures = pictures.then(() => post({ kind: ToWorker.Calls, calls: [{ name: 'forget_picture', args: [clip] }], frames: 0 }));
    },
    lost: () => stats.lost,
    busy: () => sent - acked >= MAX_IN_FLIGHT || stats.busy,
    set_motion: (motion) => call('set_motion', motion),
    set_budget: (bytes) => call('set_budget', bytes),
    set_tiles: (on) => call('set_tiles', on),
    set_tile_budget: (bytes) => call('set_tile_budget', bytes),
    poster: (group, width, height, scale) =>
      new Promise((resolve, reject) => {
        const id = ++posterId;
        posters.set(id, (bytes) => (bytes ? resolve(bytes) : reject(new Error('poster not drawn'))));
        flush();
        post({ kind: ToWorker.Poster, id, group, width, height, scale });
      }),
    free: () => {
      flush();
      post({ kind: ToWorker.Free });
    }
  };
}

export function createCoreWorker(canvas: HTMLCanvasElement, width: number, height: number, side = Infinity): Promise<CoreRaster> {
  if (!renderWorkerOffered()) {
    return Promise.reject(new Error('render worker unavailable'));
  }
  const { link, offscreen } = linkOf(canvas);
  const worker = link.worker;
  return new Promise((resolve, reject) => {
    const answer = (event: MessageEvent<WorkerOut>) => {
      if (event.data.kind !== FromWorker.Attached && event.data.kind !== FromWorker.Failed) {
        return;
      }
      worker.removeEventListener('message', answer);
      if (event.data.kind === FromWorker.Failed) {
        reject(new Error(event.data.why));
        return;
      }
      resolve(rasterOf(workerAttached(worker, new Set(), side), pictureSize(side)));
    };
    worker.addEventListener('message', answer);
    worker.postMessage({ kind: ToWorker.Attach, canvas: offscreen, width, height } satisfies WorkerIn, offscreen ? [offscreen] : []);
  });
}
