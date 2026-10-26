import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { apiPathOf, pageActionPath } from './page-action';

const PAGE_ACTION = /\?\/\$?\{?[A-Za-z_]|x-sveltekit-action/;
const EDITOR_ACTION_CALLERS = [
  'src/lib/motion/poster-capture.ts',
  'src/lib/motion/export/save.ts',
  'src/lib/components/motion/StillExport.svelte',
  'src/lib/components/motion/TemplateLibrary.svelte',
  'src/lib/components/motion/SoundDialog.svelte',
  'src/lib/components/motion/TemplateDialog.svelte',
  'src/lib/components/motion/ExportDialog.svelte',
  'src/lib/components/gallery/PublishDialog.svelte',
  'src/lib/components/canvas/MotionNode.svelte',
  'src/routes/app/compose/[nodeId]/+page.svelte',
  'src/routes/app/upscale/+page.svelte'
];

describe('a page action goes to the API when the page has a bearer twin', () => {
  it('the canvas and the frame editor have one', () => {
    expect(apiPathOf('/p/p1/c/c1')).toBe('/api/v1/projects/p1/canvases/c1');
    expect(apiPathOf('/p/p1/c/c1/motion/n1')).toBe('/api/v1/projects/p1/canvases/c1/motion/n1');
  });

  it('the compose list and the composition editor have one, and keep the page query', () => {
    expect(apiPathOf('/app/compose?project=p1')).toBe('/api/v1/me/pages/compose?project=p1');
    expect(apiPathOf('/app/compose/n1?project=p1')).toBe('/api/v1/compose/n1?project=p1');
  });

  it('every dashboard page and the project pages have one', () => {
    expect(apiPathOf('/app/credits')).toBe('/api/v1/me/pages/credits');
    expect(apiPathOf('/app/upscale')).toBe('/api/v1/me/pages/upscale');
    expect(apiPathOf('/app/studio?project=p1')).toBe('/api/v1/me/pages/studio?project=p1');
    expect(apiPathOf('/app/studio/b1')).toBe('/api/v1/studio/b1');
    expect(apiPathOf('/p/p1/influencers')).toBe('/api/v1/projects/p1/pages/influencers');
    expect(apiPathOf('/p/p1/brands/new')).toBe('/api/v1/projects/p1/pages/brand-new');
    expect(apiPathOf('/p/p1/assets?tab=all')).toBe('/api/v1/projects/p1/pages/assets?tab=all');
  });

  it('any other page keeps its own action', () => {
    expect(apiPathOf('/render/t1')).toBeNull();
    expect(pageActionPath('/render/t1', 'slot')).toBe('/render/t1?/slot');
  });

  it('no editor source builds a page action by hand', () => {
    const posting = EDITOR_ACTION_CALLERS.filter((path) => PAGE_ACTION.test(readFileSync(path, 'utf8')));
    expect(posting).toEqual([]);
  });
});
