import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ExportDialog from './ExportDialog.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { RenderQueue, RenderStage, type RenderView } from '$lib/motion/server-render';

const running: RenderView = { id: 'r', status: 'running', progress: { stage: RenderStage.Rendering, chunksDone: 0, chunks: 1, totalFrames: 450 }, error: null, assetId: null, credits: 10 };

function dialog(queue: RenderQueue) {
  return render(ExportDialog, {
    props: {
      doc: newMotionDoc(MotionFormat.Landscape),
      assetUrls: {},
      scope: { orgId: 'o', projectId: 'p', nodeId: 'n' },
      editorUrl: '/p/p/c/c/motion/n',
      fileName: 'video',
      render: async () => {},
      server: { configured: true, version: 1, saved: true, latest: running, queue, assetHref: (id: string) => `/a/${id}` },
      tokens: FEEGA_TOKENS,
      onclose: () => {}
    }
  }).body;
}

describe('a server render that cannot advance says so', () => {
  it('on a dev server with no tick, the running render offers cancel and the browser export at once', () => {
    const body = dialog(RenderQueue.Stopped);

    expect(body).toContain('data-testid="export-stalled"');
    expect(body).toContain('DEV_CRONS');
    expect(body).toContain('data-testid="export-switch-browser"');
  });

  it('a ticking queue shows plain progress until it stops moving', () => {
    expect(dialog(RenderQueue.Ticking)).not.toContain('data-testid="export-stalled"');
  });
});
