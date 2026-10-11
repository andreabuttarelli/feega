import { describe, expect, it } from 'vitest';
import { mountShader, type Core, type Library } from './adapter';
import { shaderTree } from './preset';
import { ShaderEffectId } from './catalogue';

type Call = [string, ...unknown[]];

function fakeCore(calls: Call[]): Core {
  let locked = false;
  let elapsed = 0;
  return {
    initialize: async (o) => void calls.push(['initialize', o.observeElement]),
    registerNode: (id, _f, parent) => void calls.push(['register', id, parent]),
    updateUniformValue: (id, key, value) => void calls.push(['uniform', id, key, value]),
    setFrameLocked: (on) => {
      if (on && !locked) {
        elapsed = 0;
      }
      locked = on;
    },
    renderSyntheticFrame: async (delta, o) => {
      elapsed += delta;
      calls.push(['render', elapsed, o?.waitForGpu]);
    },
    stopAnimation: () => void calls.push(['stop']),
    startAnimation: () => void calls.push(['start']),
    beginRecordingResolution: (w, h, r) => {
      calls.push(['resolution', w, h, r]);
      return () => {};
    },
    getFailureReason: () => null,
    cleanup: () => void calls.push(['cleanup'])
  };
}

function fakeLibrary(calls: Call[]): Library {
  return {
    renderer: () => fakeCore(calls),
    definition: (type) => ({ name: type, fragment: type, props: {} }),
    uniforms: (_def, values) => values,
    root: { name: 'root', fragment: 'root', props: {} }
  };
}

const rendered = (calls: Call[]) => calls.filter((c) => c[0] === 'render').map((c) => c[1]);

describe('the shader clock adapter', () => {
  it('renders the time it is asked for, in any seek order', async () => {
    const calls: Call[] = [];
    const shader = await mountShader(fakeLibrary(calls), {} as HTMLCanvasElement, shaderTree(ShaderEffectId.Plasma, {}, null), { width: 320, height: 180 });

    for (const t of [1, 3, 0.5, 1, 3, 2.25, 0.5]) {
      shader.seek(t, {});
    }

    expect(rendered(calls)).toEqual([1, 3, 0.5, 1, 3, 2.25, 0.5]);
  });

  it('never waits for the GPU inside a seek, so the frame is copied in the same task', async () => {
    const calls: Call[] = [];
    const shader = await mountShader(fakeLibrary(calls), {} as HTMLCanvasElement, shaderTree(ShaderEffectId.Plasma, {}, null), { width: 320, height: 180 });

    shader.seek(2, {});

    expect(calls.find((c) => c[0] === 'render')?.[2]).toBe(false);
  });

  it('pins the resolution and stops the library loop and observers', async () => {
    const calls: Call[] = [];
    await mountShader(fakeLibrary(calls), {} as HTMLCanvasElement, shaderTree(ShaderEffectId.Plasma, {}, null), { width: 320, height: 180 });

    expect(calls).toContainEqual(['initialize', false]);
    expect(calls).toContainEqual(['stop']);
    expect(calls).toContainEqual(['resolution', 320, 180, 1]);
    expect(calls).not.toContainEqual(['start']);
  });

  it('writes keyed values before rendering the frame', async () => {
    const calls: Call[] = [];
    const shader = await mountShader(fakeLibrary(calls), {} as HTMLCanvasElement, shaderTree(ShaderEffectId.IrisWipe, {}, null), { width: 320, height: 180 });
    calls.length = 0;

    shader.seek(1, { progress: 0.75 });

    expect(calls[0]).toEqual(['uniform', 'fx', 'progress', 0.75]);
    expect(calls.at(-1)?.[0]).toBe('render');
  });

  it('registers a filter over its source', async () => {
    const calls: Call[] = [];
    await mountShader(fakeLibrary(calls), {} as HTMLCanvasElement, shaderTree(ShaderEffectId.ZoomBlur, {}, 'https://x/a.png'), { width: 320, height: 180 });

    expect(calls.filter((c) => c[0] === 'register').map((c) => c.slice(1))).toEqual([
      ['preset-root', null],
      ['fx', 'preset-root'],
      ['src', 'fx']
    ]);
  });

  it('runs on the library loop when live', async () => {
    const calls: Call[] = [];
    const shader = await mountShader(fakeLibrary(calls), {} as HTMLCanvasElement, shaderTree(ShaderEffectId.ChromaFlow, {}, null), { width: 320, height: 180 });

    shader.play();

    expect(calls.at(-1)).toEqual(['start']);
  });
});
