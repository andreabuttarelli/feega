import { describe, expect, it } from 'vitest';
import { Bucket, buckets } from './profile-buckets.mjs';

const WASM = 'wasm://wasm/0f3a2b1c';
const GLUE = 'http://localhost:5199/gpu-core/gpu_core.js';
const APP = 'http://localhost:5199/_app/immutable/chunks/CoreFrames.js';

type Frame = { functionName: string; url: string };

const wasm = (functionName: string): Frame => ({ functionName, url: WASM });
const glue = (functionName: string): Frame => ({ functionName, url: GLUE });
const native = (functionName: string): Frame => ({ functionName, url: '' });
const app = (functionName: string): Frame => ({ functionName, url: APP });

const frameLoop = app('frame');
const planAt = wasm('<gpu_core[79cf9c977d9b0c7c]::compositor::Compositor>::plan_at');
const rasterBatch = wasm('<gpu_core[79cf9c977d9b0c7c]::web::WebCore>::raster_batch');
const engineDraw = wasm('<gpu_core[79cf9c977d9b0c7c]::engine::Engine>::draw');

function profileOf(stacks: Frame[][]) {
  const nodes = [{ id: 1, callFrame: native('(root)'), children: [] as number[] }];
  const samples: number[] = [];
  for (const stack of stacks) {
    let at = nodes[0];
    for (const frame of stack) {
      const known = at.children.map((id) => nodes[id - 1]).find((n) => n.callFrame.functionName === frame.functionName && n.callFrame.url === frame.url);
      const next = known ?? { id: nodes.length + 1, callFrame: frame, children: [] };
      if (!known) {
        nodes.push(next);
        at.children.push(next.id);
      }
      at = next;
    }
    samples.push(at.id);
  }
  return { nodes, samples, timeDeltas: samples.map(() => 1000) };
}

const bucketOf = (stack: Frame[]) => Object.keys(buckets(profileOf([stack])))[0];

describe('profile buckets', () => {
  it('files a sample under the innermost engine phase on its stack', () => {
    expect(bucketOf([frameLoop, planAt, wasm('<gpu_core[79cf9c977d9b0c7c]::groups::Laying>::lay')])).toBe(Bucket.Lay);
    expect(bucketOf([frameLoop, rasterBatch, engineDraw, wasm('gpu_core[79cf9c977d9b0c7c]::layers::prepare_items::<gpu_core[79cf9c977d9b0c7c]::engine::Gpu>')])).toBe(Bucket.PrepareItems);
    expect(bucketOf([frameLoop, rasterBatch, engineDraw, wasm('<vello[0d1e2f3a4b5c6d7e]::Renderer>::render_to_texture')])).toBe(Bucket.Encode);
    expect(bucketOf([frameLoop, planAt])).toBe(Bucket.Plan);
  });

  it('files a WebGPU call as GPU calls, not under the phase that made it', () => {
    const write = [frameLoop, rasterBatch, engineDraw, wasm('<wgpu[b5ba865982d40e36]::backend::webgpu::ContextWebGpu>::queue_write_buffer'), glue('__wbg_writeBuffer_c4f1'), native('writeBuffer')];
    const submit = [frameLoop, rasterBatch, glue('__wbg_submit_9a0e')];

    expect(bucketOf(write)).toBe(Bucket.GpuCalls);
    expect(bucketOf(submit)).toBe(Bucket.GpuCalls);
  });

  it('files the bindings between JS and wasm as glue', () => {
    expect(bucketOf([frameLoop, rasterBatch, glue('__wbg_newnoargs_105e')])).toBe(Bucket.Glue);
    expect(bucketOf([frameLoop, glue('frame')])).toBe(Bucket.Glue);
  });

  it('keeps idle, GC and native time out of main-thread JS', () => {
    expect(bucketOf([native('(idle)')])).toBe(Bucket.Idle);
    expect(bucketOf([native('(garbage collector)')])).toBe(Bucket.Gc);
    expect(bucketOf([native('(program)')])).toBe(Bucket.Native);
    expect(bucketOf([frameLoop, app('countFrame')])).toBe(Bucket.Js);
  });

  it('files engine code outside every named phase as wasm other', () => {
    expect(bucketOf([frameLoop, wasm('<hashbrown[aa11bb22cc33dd44]::raw::RawTable<u64>>::reserve_rehash')])).toBe(Bucket.WasmOther);
  });

  it('sums milliseconds per bucket', () => {
    const ms = buckets(profileOf([[native('(idle)')], [native('(idle)')], [frameLoop, planAt]]));

    expect(ms).toEqual({ [Bucket.Idle]: 2, [Bucket.Plan]: 1 });
  });
});
