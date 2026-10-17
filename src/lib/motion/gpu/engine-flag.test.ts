import { describe, expect, it } from 'vitest';
import { RenderEngine, engineFlag } from './engine-flag';

describe('engineFlag', () => {
  it('keeps the HTML engine unless the URL asks for the GPU one', () => {
    expect(engineFlag(new URL('https://feega.app/app/compose/x'))).toBe(RenderEngine.Html);
    expect(engineFlag(new URL('https://feega.app/app/compose/x?engine=gpu'))).toBe(RenderEngine.Gpu);
    expect(engineFlag(new URL('https://feega.app/app/compose/x?engine=other'))).toBe(RenderEngine.Html);
  });
});
