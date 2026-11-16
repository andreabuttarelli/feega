import { rasterOf, warmCore, CoreBuild, pictureSize, type Attached, type CoreRaster } from './core-web';
import { Outcome } from './core-outcome';
import { releaseOnDispose, type GpuSurface } from './gpu-release';

export enum Op {
  Camera,
  Tick,
  Put,
  PutPacked,
  Append,
  AppendPacked,
  Patch,
  Drop,
  Uses,
  Overlay,
  SelectedOverlay,
  LiveOverlay,
  Picture,
  Forget,
  Setting,
  Free,
  Attach,
  Status,
  Ready,
  Failed,
  Poster,
  Posted,
  PictureSlot
}

export enum Slot {
  Outcome,
  Pending,
  CacheBytes,
  Warming,
  Lost,
  PictureBytes,
  ScratchBytes,
  Presented,
  FrameMs,
  CameraX,
  CameraY,
  CameraZoom,
  DoneAt,
  RafGap,
  Length
}

export type Message = [Op, ...unknown[]];
export type Port = { post: (message: Message, transfer?: Transferable[]) => void; listen: (on: (message: Message) => void) => void };
export type HostPort = { post: (message: Message, transfer?: Transferable[]) => void; frame: (run: (now: number) => void) => void; soon: (run: (now: number) => void) => void };

const OUTCOMES = Object.values(Outcome);
const SETTINGS = ['set_motion', 'set_budget', 'set_tiles', 'set_direct_gesture', 'set_tile_budget', 'set_canvas_tiles', 'set_pixel_ratio'] as const;
type SettingName = (typeof SETTINGS)[number];

const utf8 = new TextEncoder();

export type FrameProbe = (x: number, y: number, zoom: number, doneAt: number, rafGap: number) => void;

export function probed(x: number, y: number, zoom: number, doneAt: number, rafGap = 0): void {
  (globalThis as { __coreProbe?: FrameProbe }).__coreProbe?.(x, y, zoom, doneAt, rafGap);
}
const bytesOf = (text: string) => utf8.encode(text);

export function attachedOverPort(port: Port): Attached {
  const known = new Set<string>();
  let slots = 0;
  let status = new Float64Array(Slot.Length);
  let counts = new Float64Array();
  let camera: [number, number, number] | null = null;
  const posters = new Map<number, { resolve: (bytes: Uint8Array<ArrayBuffer>) => void; reject: (e: Error) => void }>();
  let posterId = 0;

  port.listen(([op, ...rest]) => {
    if (op === Op.Posted) {
      const [id, bytes, why] = rest as [number, Uint8Array<ArrayBuffer> | null, string | undefined];
      const asked = posters.get(id);
      posters.delete(id);
      if (bytes) {
        asked?.resolve(bytes);
      } else {
        asked?.reject(new Error(why ?? 'poster failed'));
      }
      return;
    }
    if (op !== Op.Status) {
      return;
    }
    status = rest[0] as Float64Array;
    counts = (rest[1] as Float64Array | undefined) ?? counts;
    probed(status[Slot.CameraX], status[Slot.CameraY], status[Slot.CameraZoom], status[Slot.DoneAt] - performance.timeOrigin, status[Slot.RafGap]);
  });

  const wired = (op: Op, ...head: unknown[]) => (text: string) => {
    const bytes = bytesOf(text);
    port.post([op, ...head, bytes], [bytes.buffer]);
  };

  const packed = (op: Op) => (key: string, json: string, floats: Float32Array, ends: Uint32Array) => {
    known.add(key);
    const bytes = bytesOf(json);
    port.post([op, key, bytes, floats, ends], [bytes.buffer, floats.buffer, ends.buffer]);
  };

  const setting = (name: SettingName) => (value: unknown) => port.post([Op.Setting, name, value]);

  return {
    draw: () => {
      throw new Error('the worker core has no one-shot draw; that is the exporter');
    },
    set_camera: (x, y, zoom) => {
      if (camera && camera[0] === x && camera[1] === y && camera[2] === zoom) {
        return;
      }
      camera = [x, y, zoom];
      port.post([Op.Camera, x, y, zoom]);
    },
    patch_uses: (patch) => wired(Op.Uses)(patch),
    set_overlay: (items) => wired(Op.Overlay)(items),
    set_selected_overlay: (items) => wired(Op.SelectedOverlay)(items),
    set_live_overlay: (items) => wired(Op.LiveOverlay)(items),
    frame: () => {
      port.post([Op.Tick]);
      return OUTCOMES[status[Slot.Outcome]] ?? Outcome.Idle;
    },
    picture: (clip, source, width, height) => {
      const slot = ++slots;
      port.post([Op.PictureSlot, slot]);
      void createImageBitmap(source as ImageBitmapSource).then(
        (bitmap) => port.post([Op.Picture, slot, clip, bitmap, width, height], [bitmap]),
        () => port.post([Op.Picture, slot, clip, null, width, height])
      );
    },
    put_group: (key, list) => {
      known.add(key);
      wired(Op.Put, key)(list);
    },
    put_group_packed: packed(Op.PutPacked),
    append_group: (key, list) => {
      known.add(key);
      wired(Op.Append, key)(list);
    },
    append_group_packed: packed(Op.AppendPacked),
    patch_group: (from, to, splice) => {
      if (!known.has(from)) {
        return false;
      }
      known.add(to);
      wired(Op.Patch, from, to)(splice);
      return true;
    },
    drop_group: (key) => {
      known.delete(key);
      port.post([Op.Drop, key]);
    },
    forget_picture: (clip) => port.post([Op.Forget, clip]),
    cache_pending: () => status[Slot.Pending] === 1,
    cache_bytes: () => status[Slot.CacheBytes],
    warming: () => status[Slot.Warming] === 1,
    lost: () => status[Slot.Lost] === 1,
    picture_bytes: () => status[Slot.PictureBytes],
    scratch_bytes: () => status[Slot.ScratchBytes],
    frame_counts: () => counts,
    busy: () => false,
    poster: (group, width, height, scale) =>
      new Promise((resolve, reject) => {
        const id = ++posterId;
        posters.set(id, { resolve, reject });
        port.post([Op.Poster, id, group, width, height, scale]);
      }),
    ...Object.fromEntries(SETTINGS.map((name) => [name, setting(name)])),
    free: () => port.post([Op.Free])
  } as Attached;
}

type HostedCore = Record<string, ((...args: never[]) => unknown) | undefined>;

const call = (core: HostedCore, name: string, ...args: unknown[]) => (core[name] as ((...a: unknown[]) => unknown) | undefined)?.(...args);

const APPLIED: Partial<Record<Op, (core: HostedCore, args: unknown[]) => void>> = {
  [Op.Put]: (core, [key, bytes]) => call(core, 'put_group', key, bytes),
  [Op.PutPacked]: (core, args) => call(core, 'put_group_packed', ...args),
  [Op.Append]: (core, [key, bytes]) => call(core, 'append_group', key, bytes),
  [Op.AppendPacked]: (core, args) => call(core, 'append_group_packed', ...args),
  [Op.Patch]: (core, [from, to, bytes]) => call(core, 'patch_group', from, to, bytes),
  [Op.Drop]: (core, [key]) => call(core, 'drop_group', key),
  [Op.Uses]: (core, [bytes]) => call(core, 'patch_uses', bytes),
  [Op.Overlay]: (core, [bytes]) => call(core, 'set_overlay', bytes),
  [Op.SelectedOverlay]: (core, [bytes]) => call(core, 'set_selected_overlay', bytes),
  [Op.LiveOverlay]: (core, [bytes]) => call(core, 'set_live_overlay', bytes),
  [Op.Forget]: (core, [clip]) => call(core, 'forget_picture', clip),
  [Op.Setting]: (core, [name, value]) => call(core, name as string, value)
};

export function hostCore(core: object, port: HostPort): { receive: (message: Message) => void } {
  const hosted = core as HostedCore;
  let camera: unknown[] | null = null;
  let asked = false;
  let hurried = false;
  let presented = 0;
  let lastRaf = 0;
  let rafGap = 0;
  let broken = false;
  let applied = [0, 0, 1];
  const waiting: (Message | number)[] = [];
  const arrived = new Map<number, unknown[]>();

  function drain() {
    while (waiting.length) {
      const head = waiting[0];
      if (typeof head === 'number') {
        const picture = arrived.get(head);
        if (!picture) {
          return;
        }
        arrived.delete(head);
        const [clip, bitmap, width, height] = picture as [string, ImageBitmap | null, number, number];
        if (bitmap) {
          call(hosted, 'picture', clip, bitmap, width, height);
        }
      } else {
        APPLIED[head[0]]?.(hosted, head.slice(1));
      }
      waiting.shift();
    }
  }

  function lostNow() {
    broken = true;
    const status = new Float64Array(Slot.Length);
    status[Slot.Lost] = 1;
    port.post([Op.Status, status], [status.buffer]);
  }

  function onRaf(now: number) {
    rafGap = lastRaf ? now - lastRaf : 0;
    lastRaf = now;
    asked = false;
    if (dirty) {
      render(now);
    }
  }

  function onSoon(now: number) {
    hurried = false;
    if (dirty) {
      render(now);
    }
  }

  let dirty = false;

  function render(now: number) {
    dirty = false;
    if (broken) {
      return;
    }
    try {
      renderNow(now);
    } catch {
      lostNow();
    }
  }

  function renderNow(now: number) {
    if (call(hosted, 'busy')) {
      ask();
      return;
    }
    if (camera) {
      call(hosted, 'set_camera', ...camera);
      applied = camera as number[];
      camera = null;
    }
    const began = performance.now();
    const [outcome] = String(call(hosted, 'frame', now)).split('\n');
    presented++;
    const status = new Float64Array(Slot.Length);
    status[Slot.Outcome] = OUTCOMES.indexOf(outcome as Outcome);
    status[Slot.Pending] = call(hosted, 'cache_pending') ? 1 : 0;
    status[Slot.CacheBytes] = Number(call(hosted, 'cache_bytes') ?? 0);
    status[Slot.Warming] = call(hosted, 'warming') ? 1 : 0;
    status[Slot.Lost] = call(hosted, 'lost') ? 1 : 0;
    status[Slot.PictureBytes] = Number(call(hosted, 'picture_bytes') ?? 0);
    status[Slot.ScratchBytes] = Number(call(hosted, 'scratch_bytes') ?? 0);
    status[Slot.Presented] = presented;
    status[Slot.FrameMs] = performance.now() - began;
    status[Slot.CameraX] = applied[0];
    status[Slot.CameraY] = applied[1];
    status[Slot.CameraZoom] = applied[2];
    status[Slot.RafGap] = rafGap;
    status[Slot.DoneAt] = performance.timeOrigin + performance.now();
    const counts = call(hosted, 'frame_counts') as Float64Array | undefined;
    port.post([Op.Status, status, ...(counts ? [counts] : [])], [status.buffer, ...(counts ? [counts.buffer] : [])]);
    if (status[Slot.Pending] || status[Slot.Warming]) {
      ask();
    }
  }

  function ask() {
    dirty = true;
    if (asked) {
      return;
    }
    asked = true;
    port.frame(onRaf);
  }

  function hurry() {
    dirty = true;
    if (hurried) {
      return;
    }
    hurried = true;
    port.soon(onSoon);
  }

  return {
    receive: (message) => {
      if (broken) {
        return;
      }
      try {
        receiveNow(message);
      } catch {
        lostNow();
      }
    }
  };

  function receiveNow([op, ...args]: Message) {
    {
      if (op === Op.Camera) {
        camera = args;
        ask();
        return;
      }
      if (op === Op.Tick) {
        hurry();
        return;
      }
      if (op === Op.PictureSlot) {
        waiting.push(args[0] as number);
        return;
      }
      if (op === Op.Picture) {
        arrived.set(args[0] as number, args.slice(1));
        drain();
        ask();
        return;
      }
      if (op === Op.Poster) {
        const [id, ...asked] = args as [number, string, number, number, number];
        Promise.resolve(call(hosted, 'poster', ...asked) as Promise<Uint8Array<ArrayBuffer>> | undefined).then(
          (bytes) => (bytes ? port.post([Op.Posted, id, bytes], [bytes.buffer]) : port.post([Op.Posted, id, null, 'no poster'])),
          (e: unknown) => port.post([Op.Posted, id, null, String(e)])
        );
        return;
      }
      if (op === Op.Free) {
        call(hosted, 'free');
        return;
      }
      if (waiting.length) {
        waiting.push([op, ...args]);
        return;
      }
      APPLIED[op]?.(hosted, args);
    }
  }
}

export type Spawn = () => Worker;

const offscreenOffered = () => typeof HTMLCanvasElement !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype && typeof navigator !== 'undefined' && 'gpu' in navigator;

function portOf(worker: Worker): Port {
  const listeners: ((message: Message) => void)[] = [];
  worker.onmessage = (e: MessageEvent<Message>) => listeners.forEach((on) => on(e.data));
  return { post: (message, transfer = []) => worker.postMessage(message, transfer), listen: (on) => listeners.push(on) };
}

function attached(worker: Worker, port: Port): Promise<void> {
  return new Promise((resolve, reject) => {
    port.listen(([op, why]) => {
      if (op === Op.Ready) {
        resolve();
      }
      if (op === Op.Failed) {
        reject(new Error(String(why)));
      }
    });
    worker.onerror = (e) => reject(new Error(e.message || 'core worker failed'));
  });
}

export function coreInWorker(spawn: Spawn) {
  return async (canvas: HTMLCanvasElement, width: number, height: number, side = Infinity): Promise<CoreRaster> => {
    if (!offscreenOffered()) {
      throw new Error('offscreen webgpu unavailable');
    }
    const worker = spawn();
    const port = portOf(worker);
    const ready = attached(worker, port);
    const offscreen = canvas.transferControlToOffscreen();
    port.post([Op.Attach, offscreen, width, height], [offscreen]);
    try {
      await ready;
    } catch (e) {
      worker.terminate();
      throw e;
    }
    const raster = rasterOf(attachedOverPort(port), pictureSize(side));
    return {
      ...raster,
      dispose: () => {
        raster.dispose();
        worker.terminate();
      }
    };
  };
}

type WorkerScope = { postMessage: (message: unknown, transfer: Transferable[]) => void; onmessage: ((e: MessageEvent<Message>) => void) | null; requestAnimationFrame: (run: (now: number) => void) => number };

export function serveCore(scope: WorkerScope): void {
  const channel = new MessageChannel();
  const soonRuns: ((now: number) => void)[] = [];
  channel.port1.onmessage = () => soonRuns.splice(0).forEach((run) => run(performance.now()));
  const port: HostPort = { post: (message, transfer = []) => scope.postMessage(message, transfer), frame: (run) => scope.requestAnimationFrame(run), soon: (run) => (soonRuns.push(run), channel.port2.postMessage(0)) };
  let host: { receive: (message: Message) => void } | null = null;
  const early: Message[] = [];

  scope.onmessage = async ({ data }) => {
    if (data[0] !== Op.Attach) {
      if (host) {
        host.receive(data);
      } else {
        early.push(data);
      }
      return;
    }
    const [, canvas, width, height] = data as [Op, OffscreenCanvas, number, number];
    try {
      const module = (await warmCore(CoreBuild.WebGpu)) as unknown as { WebCore: { attach_offscreen: (c: OffscreenCanvas, w: number, h: number) => Promise<object> } };
      const core = await module.WebCore.attach_offscreen(canvas, width, height);
      const released = releaseOnDispose({ dispose: () => (core as { free: () => void }).free() }, canvas.getContext('webgpu') as GpuSurface | null);
      host = hostCore({ ...bound(core), free: released.dispose }, port);
      early.splice(0).forEach((m) => host!.receive(m));
      port.post([Op.Ready]);
    } catch (e) {
      port.post([Op.Failed, e instanceof Error ? e.message : String(e)]);
    }
  };
}

function bound(core: object): HostedCore {
  const names = Object.getOwnPropertyNames(Object.getPrototypeOf(core)).filter((n) => n !== 'constructor');
  return Object.fromEntries(names.map((n) => [n, (core as HostedCore)[n]!.bind(core)]));
}
