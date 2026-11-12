type Size = { width: number; height?: number } | number[];
type Descriptor = { size: Size; format: string };
type Proto = Record<string, unknown>;

export type GpuApi = { GPUDevice?: { prototype: Proto }; GPUTexture?: { prototype: Proto }; GPUBuffer?: { prototype: Proto }; GPUQueue?: { prototype: Proto }; WebAssembly?: typeof WebAssembly };

type Queue = { onSubmittedWorkDone: () => Promise<void> };

export enum TextureChange {
  Created = 'created',
  Destroyed = 'destroyed'
}

export type GpuCounters = { textureBytes: number; textures: number; bufferBytes: number; buffers: number; created: number; submits: number; lagMs: number; wasm: WebAssembly.Memory[]; queue: Queue | null; polling: boolean; watch?: (bytes: number, change: TextureChange) => void };

const BYTES_PER_TEXEL: [RegExp, number][] = [
  [/32float/, 16],
  [/16float/, 8]
];
const RGBA8_BYTES = 4;

const texelBytes = (format: string) => BYTES_PER_TEXEL.find(([pattern]) => pattern.test(format))?.[1] ?? RGBA8_BYTES;

const area = (size: Size) => (Array.isArray(size) ? size[0] * (size[1] ?? 1) : size.width * (size.height ?? 1));

const PROBED = Symbol.for('feega.gpu-probe');

type Probed = { [PROBED]?: GpuCounters };

function counted(device: Proto, counters: GpuCounters, sizes: WeakMap<object, number>) {
  const create = device.createTexture as (this: unknown, d: Descriptor) => object;
  device.createTexture = function (this: unknown, d: Descriptor) {
    const texture = create.call(this, d);
    const bytes = area(d.size) * texelBytes(d.format);
    sizes.set(texture, bytes);
    counters.textureBytes += bytes;
    counters.textures++;
    counters.created++;
    counters.watch?.(bytes, TextureChange.Created);
    return texture;
  };
}

function released(texture: Proto, counters: GpuCounters, sizes: WeakMap<object, number>) {
  const destroy = texture.destroy as (this: object) => void;
  texture.destroy = function (this: object) {
    const bytes = sizes.get(this);
    if (bytes !== undefined) {
      sizes.delete(this);
      counters.textureBytes -= bytes;
      counters.textures--;
      counters.watch?.(bytes, TextureChange.Destroyed);
    }
    return destroy.call(this);
  };
}

function buffered(device: Proto, buffer: Proto, counters: GpuCounters) {
  const sizes = new WeakMap<object, number>();
  const create = device.createBuffer as (this: unknown, d: { size: number }) => object;
  device.createBuffer = function (this: unknown, d: { size: number }) {
    const made = create.call(this, d);
    sizes.set(made, d.size);
    counters.bufferBytes += d.size;
    counters.buffers++;
    return made;
  };
  const destroy = buffer.destroy as (this: object) => void;
  buffer.destroy = function (this: object) {
    const bytes = sizes.get(this);
    if (bytes !== undefined) {
      sizes.delete(this);
      counters.bufferBytes -= bytes;
      counters.buffers--;
    }
    return destroy.call(this);
  };
}

function submitted(queue: Proto, counters: GpuCounters) {
  const submit = queue.submit as (this: Queue, b: unknown) => void;
  queue.submit = function (this: Queue, b: unknown) {
    counters.submits++;
    counters.queue = this;
    return submit.call(this, b);
  };
}

function memories(wasm: typeof WebAssembly | undefined, counters: GpuCounters) {
  if (!wasm?.instantiateStreaming) {
    return;
  }
  const keep = (instance: WebAssembly.Instance) => Object.values(instance.exports).forEach((v) => v instanceof wasm.Memory && counters.wasm.push(v));
  const streaming = wasm.instantiateStreaming.bind(wasm);
  wasm.instantiateStreaming = async (...args) => {
    const made = await streaming(...args);
    keep(made.instance);
    return made;
  };
  const instantiate = wasm.instantiate.bind(wasm) as (...a: unknown[]) => Promise<WebAssembly.WebAssemblyInstantiatedSource | WebAssembly.Instance>;
  wasm.instantiate = (async (...args: unknown[]) => {
    const made = await instantiate(...args);
    keep('instance' in made ? made.instance : made);
    return made;
  }) as typeof wasm.instantiate;
}

export function probeGpu(api: GpuApi): GpuCounters {
  const host = api as Probed;
  if (host[PROBED]) {
    return host[PROBED];
  }
  const counters: GpuCounters = { textureBytes: 0, textures: 0, bufferBytes: 0, buffers: 0, created: 0, submits: 0, lagMs: 0, wasm: [], queue: null, polling: false };
  host[PROBED] = counters;
  const sizes = new WeakMap<object, number>();
  if (api.GPUDevice && api.GPUTexture && api.GPUQueue) {
    counted(api.GPUDevice.prototype, counters, sizes);
    released(api.GPUTexture.prototype, counters, sizes);
    submitted(api.GPUQueue.prototype, counters);
  }
  if (api.GPUDevice && api.GPUBuffer) {
    buffered(api.GPUDevice.prototype, api.GPUBuffer.prototype, counters);
  }
  memories(api.WebAssembly, counters);
  return counters;
}

export function pollLag(counters: GpuCounters, clock: () => number): void {
  const queue = counters.queue;
  if (!queue || counters.polling) {
    return;
  }
  counters.polling = true;
  const asked = clock();
  void queue.onSubmittedWorkDone().then(() => {
    counters.lagMs = clock() - asked;
    counters.polling = false;
  });
}

export const wasmBytes =(counters: GpuCounters) => counters.wasm.reduce((sum, m) => sum + m.buffer.byteLength, 0);
