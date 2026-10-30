import { describe, expect, it } from 'vitest';
import { entryFile } from './code-files';

const files = [{ path: 'src/App.tsx', content: 'a' }, { path: 'src/pages/Home.tsx', content: 'b' }];

describe('the file shown first in an export', () => {
  it('prefers the page over other files', () => {
    expect(entryFile(files)?.path).toBe('src/pages/Home.tsx');
  });

  it('honours an explicit pick', () => {
    expect(entryFile(files, 'src/App.tsx')?.content).toBe('a');
  });
});
