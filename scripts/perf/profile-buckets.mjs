import { readFileSync } from 'node:fs';

const US_PER_MS = 1000;

export const Bucket = {
  Plan: 'wasm plan',
  Lay: 'wasm lay out',
  PrepareItems: 'wasm prepare_items',
  Encode: 'wasm encode (vello)',
  Present: 'wasm present / composite',
  Tiles: 'wasm tiles bookkeeping',
  WasmOther: 'wasm other',
  GpuCalls: 'WebGPU calls',
  Glue: 'wasm-bindgen glue',
  Gc: 'GC',
  Native: 'native (browser, style, layout)',
  Idle: 'idle',
  Js: 'main-thread JS / Svelte'
};

const INNERMOST_PHASE_FIRST = [
  { name: Bucket.PrepareItems, match: /prepare_items|layers::prepare\b/ },
  { name: Bucket.Lay, match: /Laying>?::lay|fragments::compose/ },
  { name: Bucket.Encode, match: /^vello|^<vello|build_into|scene::build_items|fill_coarse|fill_reserve|fill_canvas/ },
  { name: Bucket.Present, match: /present_tiles|Reprojector|draw_tiles|Compositor>::frame|reproject/ },
  { name: Bucket.Plan, match: /plan_at|Library>::plan|World>::(scene|screen|overlay)|groups::|uses::|overlay_at/ },
  { name: Bucket.Tiles, match: /tiles::|Tiles>::/ }
];

const GPU_CALL = /^(__wbg_)?(writeBuffer|writeTexture|submit|copyExternalImageToTexture|copyBufferToBuffer|copyTextureToTexture|createTexture|createBuffer|createBindGroup|createView|createCommandEncoder|beginRenderPass|beginComputePass|dispatchWorkgroups|draw|drawIndexed|setPipeline|setBindGroup|end|finish|getCurrentTexture|mapAsync|getMappedRange|unmap|destroy)(_[0-9a-f]+)?$/;

const VM_LEAVES = {
  '(idle)': Bucket.Idle,
  '(garbage collector)': Bucket.Gc,
  '(program)': Bucket.Native
};

const path = (frame) => frame.url.split('?')[0];
const isWasm = (frame) => frame.url.startsWith('wasm://') || /\.wasm$/.test(path(frame));
const isGlue = (frame) => /gpu_core(_gl)?\.js$/.test(path(frame));

function jsAboveWasm(stack) {
  const wasmAt = stack.findIndex(isWasm);
  return wasmAt === -1 ? stack : stack.slice(0, wasmAt);
}

function classifyJs(segment) {
  if (segment.some((frame) => GPU_CALL.test(frame.functionName) && (isGlue(frame) || frame.url === ''))) {
    return Bucket.GpuCalls;
  }
  const appAt = segment.findIndex((frame) => !isGlue(frame) && frame.url !== '');
  const leafRun = appAt === -1 ? segment : segment.slice(0, appAt);
  if (leafRun.some(isGlue)) {
    return Bucket.Glue;
  }
  return Bucket.Js;
}

function classifyWasm(stack) {
  for (const frame of stack.filter(isWasm)) {
    const phase = INNERMOST_PHASE_FIRST.find((p) => p.match.test(frame.functionName));
    if (phase) {
      return phase.name;
    }
  }
  return Bucket.WasmOther;
}

function classify(stack) {
  const vm = VM_LEAVES[stack[0].functionName];
  if (vm) {
    return vm;
  }

  const segment = jsAboveWasm(stack);
  if (segment.length) {
    return classifyJs(segment);
  }
  return classifyWasm(stack);
}

export function buckets(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) {
    for (const c of n.children ?? []) {
      parent.set(c, n.id);
    }
  }

  const leafFirstStack = (id) => {
    const stack = [];
    for (let at = id; at !== undefined; at = parent.get(at)) {
      stack.push(byId.get(at).callFrame);
    }
    return stack;
  };

  const ms = {};
  profile.samples.forEach((id, i) => {
    const name = classify(leafFirstStack(id));
    ms[name] = (ms[name] ?? 0) + (profile.timeDeltas[i] ?? 0) / US_PER_MS;
  });
  return ms;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , file, frames = '1'] = process.argv;
  const ms = buckets(JSON.parse(readFileSync(file, 'utf8')));
  for (const [name, total] of Object.entries(ms).sort((a, b) => b[1] - a[1])) {
    console.log(`${(total / Number(frames)).toFixed(2).padStart(8)} ms/frame  ${Math.round(total).toString().padStart(6)} ms  ${name}`);
  }
}
