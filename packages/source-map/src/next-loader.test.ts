import { describe, expect, it } from 'vitest';
import feegaSourceLoader from './next-loader.ts';

const loaderOf = (resourcePath: string) => ({ resourcePath, getOptions: () => ({ root: '/app' }) });
const CARD = "export function Card({ size }: { size: 'sm' | 'lg' }) { return <p>{size}</p>; }\n";

describe('next loader', () => {
  it('registers the controls parsed from the source under the file id', () => {
    const out = feegaSourceLoader.call(loaderOf('/app/components/Card.tsx'), CARD);
    const registry: Record<string, unknown> = {};
    new Function('globalThis', out.slice(out.lastIndexOf(';globalThis')))(registry);

    const controls = [{ name: 'size', kind: 'select', required: true, options: ['sm', 'lg'] }];

    expect(registry.__feegaControls).toEqual({ 'components/Card.tsx': { Card: controls, default: controls } });
  });

  it('adds nothing to a file with no component', () => {
    expect(feegaSourceLoader.call(loaderOf('/app/lib/math.ts'), 'export const a = 1;')).not.toContain('__feegaControls');
  });
});
