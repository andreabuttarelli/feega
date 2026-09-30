import { describe, it, expect, vi, beforeEach } from 'vitest';

const M = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: M.env }));

function setEnv(vars: Record<string, string | undefined>) {
  for (const k of Object.keys(M.env)) delete M.env[k];
  Object.assign(M.env, vars);
}

describe('il registro delle rotte', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv({ OPENROUTER_API_KEY: 'o' });
  });

  it('i default di ogni slot', async () => {
    const { route } = await import('./model-routing');
    expect(route('text')).toEqual({ family: 'gemini' });
    expect(route('image')).toEqual({ family: 'gpt-image' });
    expect(route('tts')).toEqual({ family: 'gemini-tts' });
    expect(route('video')).toEqual({ family: 'grok-imagine' });
  });

  it('AI_ROUTE_* sceglie la famiglia', async () => {
    setEnv({ AI_ROUTE_IMAGE: 'nano-banana', AI_ROUTE_VIDEO: 'seedance@openrouter' });
    const { route } = await import('./model-routing');
    expect(route('image')).toEqual({ family: 'nano-banana' });
    expect(route('video')).toEqual({ family: 'seedance' });
  });

  it('una rotta verso kie non esiste più: si avvisa e decide il default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv({ AI_ROUTE_IMAGE: 'nano-banana@kie', AI_ROUTE_TEXT: 'grok' });
    const { route } = await import('./model-routing');
    expect(route('image')).toEqual({ family: 'gpt-image' });
    expect(route('text')).toEqual({ family: 'gemini' });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('le vecchie variabili kie sono ignorate, rumorosamente', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv({ GEMINI_TRANSPORT: 'kie', GTM_PROVIDER: 'kie' });
    const { route } = await import('./model-routing');
    expect(route('text')).toEqual({ family: 'gemini' });
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/GEMINI_TRANSPORT=kie[\s\S]*GTM_PROVIDER=kie|GTM_PROVIDER=kie[\s\S]*GEMINI_TRANSPORT=kie/);
    warn.mockRestore();
  });

  it('i modelli video: variabile o default, mai KIE_VIDEO_MODEL_*', async () => {
    setEnv({ AI_ROUTE_VIDEO_I2V: 'bytedance/seedance-2-5', KIE_VIDEO_MODEL_T2V: 'x' });
    const { videoModel } = await import('./model-routing');
    expect(videoModel('i2v')).toBe('bytedance/seedance-2-5');
    expect(videoModel('t2v')).toBe('grok-imagine/text-to-video');
    expect(videoModel('upscale')).toBe('grok-imagine/upscale');
  });
});
