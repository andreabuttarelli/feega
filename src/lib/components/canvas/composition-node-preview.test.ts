import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const node = readFileSync(join(dir, 'CompositionNode.svelte'), 'utf8');
const page = readFileSync(join(dir, '../../../routes/p/[projectId]/c/[canvasId]/+page.svelte'), 'utf8');
const lib = join(dir, '../../canvas/composition');

describe('the composition node runs on the motion engine', () => {
  it('previews with the motion player, from the node read as a motion video', () => {
    expect(node).toMatch(/<CompositionPlayer[^>]*doc=\{nodeDoc\(node, cards, motions\)\}/);
  });

  it('keeps loaded motion docs out of deep state: nodeDoc structured-clones them, and a state proxy cannot be cloned', () => {
    expect(node).toMatch(/let sources = \$state\.raw</);
  });

  it('a bento node shows its grid and span panel, and the canvas saves what it changes', () => {
    expect(node).toMatch(/node\.layout === 'bento' && onpatch/);
    expect(node).toMatch(/<BentoPanel \{node\} \{cards\} \{onpatch\}/);
    expect(page).toMatch(/onpatch=\{\(patch\) => write\(id, patch, SaveTiming\.Now\)\}/);
  });

  it('opens and exports in Compositions, the motion editor with its export dialog', () => {
    expect(node).toMatch(/ondblclick=\{openInCompositions\}/);
    expect(node).toMatch(/action="\/app\/compose\?\/fromNode"/);
    expect(page).not.toMatch(/CompositionEditor/);
  });

  it('leaves no second renderer or encoder behind', () => {
    for (const file of ['scene.ts', 'encode.ts', 'export.ts']) {
      expect(existsSync(join(lib, file))).toBe(false);
    }
    expect(existsSync(join(dir, 'CompositionPreview.svelte'))).toBe(false);
    expect(existsSync(join(dir, 'CompositionEditor.svelte'))).toBe(false);
  });
});
