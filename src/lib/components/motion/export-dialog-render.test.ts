import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ExportDialog from './ExportDialog.svelte';
import EmbedView from './EmbedView.svelte';
import { ExportMode } from './export-mode';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { RenderQueue } from '$lib/motion/server-render';
import { Reaction } from '$lib/motion/interactive/summary';
import { DEFAULT_INTERACTIVE } from '$lib/motion/interactive/settings';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { writeComponent } from '$lib/motion/custom/ops';
import { ComponentMode } from '$lib/motion/custom/component';

const doc = newMotionDoc(MotionFormat.Landscape);

function dialog(start: ExportMode | null = null, shown = doc) {
  return render(ExportDialog, {
    props: {
      doc: shown,
      assetUrls: {},
      scope: { orgId: 'o', projectId: 'p', nodeId: 'n' },
      editorUrl: '/p/p/c/c/motion/n',
      fileName: 'video',
      render: async () => {},
      server: { configured: true, version: 1, saved: true, latest: null, queue: RenderQueue.Ticking, assetHref: (id: string) => `/a/${id}` },
      tokens: FEEGA_TOKENS,
      opening: start,
      onclose: () => {}
    }
  }).body;
}

const bundle = { html: '<html></html>', bytes: 78_000, snippet: '<iframe src="feega-interactive.html"></iframe>' };

function embed(over: Partial<Parameters<typeof EmbedView>[1]> = {}) {
  return render(EmbedView, {
    props: {
      doc,
      bundle,
      href: 'blob:x',
      hosted: { published: false, url: 'https://feega.app/e/n' },
      hostedSnippet: '',
      reactions: [],
      settings: { ...DEFAULT_INTERACTIVE },
      busy: false,
      error: '',
      onpublish: () => {},
      onunpublish: () => {},
      ...over
    }
  }).body;
}

describe('the export dialog asks what you want first', () => {
  it('opens on two plain choices, not on settings', () => {
    const body = dialog();

    expect(body).toContain('data-testid="export-mode-video"');
    expect(body).toContain('data-testid="export-mode-interactive"');
    expect(body).toContain('Video file');
    expect(body).toContain('Embed on a website');
    expect(body).not.toContain('data-testid="export-format"');
  });

  it('the video path shows format, resolution and quality as choices with one primary action', () => {
    const body = dialog(ExportMode.Video);

    expect(body).toContain('data-testid="export-format"');
    expect(body).toContain('data-testid="export-resolution"');
    expect(body).toContain('data-testid="export-quality"');
    expect(body).toContain('data-testid="export-fps"');
    expect(body).toContain('data-testid="export-background"');
    expect(body).toContain('data-testid="export-quote"');
  });

  it('the embed path mounts the interactive export', () => {
    expect(dialog(ExportMode.Interactive)).toContain('data-testid="interactive-export"');
  });
});

describe('the embed path discloses step by step', () => {
  it('before publishing: a preview and one publish button, no code', () => {
    const body = embed();

    expect(body).toContain('data-testid="interactive-preview"');
    expect(body).toContain('data-testid="interactive-publish"');
    expect(body).not.toContain('data-testid="interactive-hosted-snippet"');
    expect(body).not.toContain('data-testid="interactive-unpublish"');
  });

  it('once published: the code to paste, copy, update and unpublish', () => {
    const body = embed({ hosted: { published: true, url: 'https://feega.app/e/n' }, hostedSnippet: '<iframe src="https://feega.app/e/n"></iframe>' });

    expect(body).toContain('data-testid="interactive-hosted-snippet"');
    expect(body).toContain('data-testid="interactive-copy"');
    expect(body).toContain('Paste this where you want it on your site');
    expect(body).toContain('data-testid="interactive-republish"');
    expect(body).toContain('data-testid="interactive-unpublish"');
    expect(body).not.toContain('data-testid="interactive-publish"');
  });

  it('a scene with no input says it plays as a video and points to the agent', () => {
    const body = embed();

    expect(body).toContain('Plays as a video');
    expect(body).toContain('Ask the agent to make it interactive');
  });

  it('an interactive scene says what it reacts to in plain words', () => {
    const body = embed({ reactions: [Reaction.Cursor, Reaction.Scroll] });

    expect(body).toContain('Follows the cursor');
    expect(body).toContain('Reacts to scroll');
    expect(body).not.toContain('Plays as a video');
  });

  it('playback, loop, nested layers and the self-hosted file stay reachable under Advanced', () => {
    const body = embed();

    expect(body).toContain('data-testid="interactive-advanced"');
    expect(body).toContain('data-testid="interactive-playback"');
    expect(body).toContain('data-testid="interactive-loop"');
    expect(body).toContain('data-testid="interactive-outside"');
    expect(body).toContain('data-testid="interactive-snippet"');
    expect(body).toContain('data-testid="interactive-copy-snippet"');
    expect(body).toContain('data-testid="interactive-download"');
    expect(body).toContain('data-testid="interactive-weight"');
  });
});

describe('a live scene in the video export', () => {
  const must = (r: OpResult) => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };
  const game = { source: { html: '', css: '', js: 'requestAnimationFrame(() => {});' }, propsSchema: { type: 'object' as const, properties: {} }, mode: ComponentMode.Live };
  const played = must(addClip(must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Game', game)), { component: 'Custom', from: 0, durationInFrames: 60, props: { name: 'Game' } }, 'g1'));

  it('says the video shows a still and offers the embed', () => {
    const body = dialog(ExportMode.Video, played);

    expect(body).toContain('data-testid="export-live"');
    expect(body).toContain('export it as Embed');
    expect(dialog(ExportMode.Video)).not.toContain('data-testid="export-live"');
  });
});

