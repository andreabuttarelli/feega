import { describe, expect, it } from 'vitest';
import { mountUrlOf } from './component-mount';

describe('mountUrlOf', () => {
  it('points at the dev server mount page with the file and the name of the component', () => {
    const url = new URL(mountUrlOf('http://localhost:5173/some/page', { name: 'Button', file: 'src/lib/ui/Button.svelte', folder: 'lib/ui', uses: 0, examples: [] }));

    expect(url.origin).toBe('http://localhost:5173');
    expect(url.pathname).toBe('/__feega/mount');
    expect(url.searchParams.get('file')).toBe('src/lib/ui/Button.svelte');
    expect(url.searchParams.get('name')).toBe('Button');
    expect(url.searchParams.get('props')).toBe('{}');
  });

  it('asks the page to fit the component', () => {
    expect(new URL(mountUrlOf('http://localhost:5173', { name: 'B', file: 'src/B.svelte', folder: '', uses: 0, examples: [] })).searchParams.has('fit')).toBe(true);
  });

  it('carries the props it is asked to mount with', () => {
    const row = { name: 'Card', file: 'src/Card.svelte', folder: '', uses: 1, examples: [] };

    expect(JSON.parse(new URL(mountUrlOf('http://localhost:5173', row, { title: 'Domanda 1', n: 3 })).searchParams.get('props')!)).toEqual({ title: 'Domanda 1', n: 3 });
  });
});
