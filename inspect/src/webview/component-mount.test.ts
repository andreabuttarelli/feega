import { describe, expect, it } from 'vitest';
import { mountUrlOf } from './component-mount';

describe('mountUrlOf', () => {
  it('points at the dev server mount page with the file and the name of the component', () => {
    const url = new URL(mountUrlOf('http://localhost:5173/some/page', { name: 'Button', file: 'src/lib/ui/Button.svelte', folder: 'lib/ui', uses: 0 }));

    expect(url.origin).toBe('http://localhost:5173');
    expect(url.pathname).toBe('/__feega/mount');
    expect(url.searchParams.get('file')).toBe('src/lib/ui/Button.svelte');
    expect(url.searchParams.get('name')).toBe('Button');
    expect(url.searchParams.get('props')).toBe('{}');
  });
});
