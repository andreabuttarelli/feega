import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

const canvas = { id: 'c1', name: 'Spring teaser', projectName: 'Launch', updatedAt: '2026-10-03', href: '/p/p1/c/c1', thumbs: ['https://signed/poster.jpg'] };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [], videoCount: 1, posters: ['https://signed/poster.jpg'] };
const PLACEHOLDER = 'Describe a launch video, or paste your website…';

function page(canvases: (typeof canvas)[] = [canvas], projects: { id: string; name: string }[] = []) {
  const data = { projects, dashboard: { canvases, projects: [project], batches: [], motions: [], moreVideos: null }, templates: [{ id: 't', name: 'A poster series', brief: 'A poster series' }], tools: [], attachProjectId: 'p1' };
  return render(Page, { props: { data, form: null } as never }).body;
}

describe('the /app home: the recents, one prompt', () => {
  it('a new canvas can be started in one of the existing projects', () => {
    const body = page([canvas], [{ id: 'p1', name: 'Launch' }]);

    expect(body).toContain('data-testid="new-canvas-project"');
    expect(body).toContain('name="projectId"');
  });

  it('reads create actions, the prompt, then the recents', () => {
    const body = page();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('data-testid="home-create"')).toBeGreaterThan(-1);
    expect(at('data-testid="home-create"')).toBeLessThan(at('data-testid="video-brief"'));
    expect(at('data-testid="video-brief"')).toBeLessThan(at('data-testid="home-recents"'));
  });

  it('the prompt leads under one lowercase title', () => {
    const body = page();

    expect(body).toMatch(/<h1[^>]*>what do you want to make\?<\/h1>/);
    expect(body.indexOf('<h1')).toBeLessThan(body.indexOf('data-testid="video-brief"'));
  });

  it('one tab per kind at the top of the composer card, motion picked, the pick sent with the form', () => {
    const body = page();
    const kinds = body.slice(body.indexOf('data-testid="prompt-kinds"'), body.indexOf('data-testid="video-brief"'));

    expect(body.indexOf('action="?/video"')).toBeLessThan(body.indexOf('data-testid="prompt-kinds"'));
    expect(kinds.match(/<svg/g)?.length).toBe(2);

    expect(kinds).toMatch(/data-kind="motion"[^>]*aria-pressed="true"/);
    expect(kinds).toMatch(/data-kind="website"[^>]*aria-pressed="false"/);
    expect(kinds).toContain('motion video');
    expect(kinds).toContain('website design');
    expect(body).toMatch(/<input type="hidden" name="kind" value="motion"/);
  });

  it('creates only a new canvas and imports: no catalogue rows on the home', () => {
    const body = page();
    const create = body.slice(body.indexOf('data-testid="home-create"'), body.indexOf('data-testid="home-scroll"'));

    expect(create).toContain('action="?/project"');
    expect(create).toContain('data-testid="new-canvas"');
    expect(create).toContain('data-testid="home-import"');
    expect(body).not.toContain('home-components');
    expect(body).not.toContain('home-posters');
    expect(body).not.toContain('home-gallery');
  });

  it('a recent is a canvas: a sized lazy thumbnail, its name, its project, and it opens the canvas', () => {
    const body = page();
    const recents = body.slice(body.indexOf('data-testid="home-recents"'));

    expect(recents).toContain('href="/p/p1/c/c1"');
    expect(recents).toMatch(/<img src="https:\/\/signed\/poster.jpg"[^>]*loading="lazy"[^>]*width="\d+" height="\d+"/);
    expect(recents).toContain('Spring teaser');
    expect(recents).toContain('Launch');
  });

  it('a canvas with several frames shows them side by side; one with none shows its initial', () => {
    const many = page([{ ...canvas, thumbs: ['https://signed/a.jpg', 'https://signed/b.jpg'] }]);
    const none = page([{ ...canvas, thumbs: [] }]);

    expect(many).toContain('https://signed/b.jpg');
    expect(none).toMatch(/class="initial[^"]*"[^>]*>s</);
  });

  it('a new user sees an empty state that points at the prompt and the new canvas', () => {
    const body = page([]);

    expect(body).toContain('data-testid="home-empty"');
    expect(body).not.toContain('data-testid="home-recents"');
    expect(body).toContain('href="#video-brief"');
  });

  it('the prompt sends to the video action, with suggestions under it', () => {
    const body = page();
    const chips = body.slice(body.indexOf('data-testid="brief-examples"'));

    expect(body).toMatch(/<form[^>]*action="\?\/video"/);
    expect(body).toMatch(/<textarea[^>]*data-testid="video-brief"/);
    expect(body).toContain(`placeholder="${PLACEHOLDER}"`);
    expect(chips).toMatch(/<button type="button"[^>]*data-brief="A poster series"/);
    expect(body.indexOf('data-testid="video-brief"')).toBeLessThan(body.indexOf('data-testid="brief-send"'));
  });

  it('shows a connect-your-agent card with a copy button per command and a docs link', () => {
    const body = page();

    expect(body).toContain('data-testid="home-agent"');
    expect(body).toContain('claude mcp add --transport http feega https://mcp.feega.app/mcp');
    expect(body).not.toContain('feega-cli');
    expect(body).toContain('data-testid="agent-copy"');
    expect(body).toContain('href="https://docs.feega.app/integrations/mcp/"');
  });

  it('the composer offers GitHub, a local folder and Figma next to attach', () => {
    const body = page();
    const sources = body.slice(body.indexOf('data-testid="prompt-sources"'));

    expect(sources).toMatch(/data-source="github"[^>]*>[\s\S]*?<svg[\s\S]*?GitHub<\/span>/);
    expect(sources).toMatch(/data-source="upload"[^>]*>[\s\S]*?<svg[\s\S]*?Local folder<\/span>/);
    expect(sources).toMatch(/data-source="figma"[^>]*>[\s\S]*?<svg[\s\S]*?Import from Figma<\/span>/);
    expect(sources).toContain('webkitdirectory');
  });

  it('small screens get one Import menu instead of three source buttons', () => {
    const body = page();

    expect(body).toMatch(/data-testid="source-menu"[^>]*aria-haspopup="menu"[\s\S]*?Import/);
  });

  it('the bottom row names the model next to the round send button', () => {
    const body = page();
    const row = body.slice(body.indexOf('data-testid="chat-attach"'), body.indexOf('data-testid="brief-send"'));

    expect(row).toContain('data-testid="composer-model"');
    expect(row).toContain('Opus 5.5');
  });
});
