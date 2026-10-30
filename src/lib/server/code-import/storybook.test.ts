import { describe, expect, it, vi } from 'vitest';
import { storybookBase, storybookPages } from './storybook';

const INDEX = {
  v: 5,
  entries: {
    'button--docs': { id: 'button--docs', title: 'Components/Button', name: 'Docs', type: 'docs' },
    'button--primary': { id: 'button--primary', title: 'Components/Button', name: 'Primary', type: 'story' },
    'button--outline': { id: 'button--outline', title: 'Components/Button', name: 'Outline', type: 'story' },
    'button--ghost': { id: 'button--ghost', title: 'Components/Button', name: 'Ghost', type: 'story' },
    'card--default': { id: 'card--default', title: 'Components/Card', name: 'Default', type: 'story' }
  }
};

const answering = (byUrl: Record<string, unknown>) => vi.fn(async (url: string) => (url in byUrl ? new Response(JSON.stringify(byUrl[url])) : new Response('no', { status: 404 }))) as unknown as typeof fetch;

describe('storybookBase', () => {
  it('toglie iframe.html, index.html e il percorso della storia', () => {
    expect(storybookBase('https://sb.example.com/?path=/story/button--primary')).toBe('https://sb.example.com/');
    expect(storybookBase('https://sb.example.com/ui/iframe.html?id=x')).toBe('https://sb.example.com/ui/');
    expect(storybookBase('https://sb.example.com/ui/index.html')).toBe('https://sb.example.com/ui/');
    expect(storybookBase('https://sb.example.com/ui')).toBe('https://sb.example.com/ui/');
  });

  it('rifiuta ciò che non è un link http(s)', () => {
    expect(storybookBase('ftp://x/')).toBeNull();
    expect(storybookBase('not a url')).toBeNull();
  });
});

describe('storybookPages', () => {
  it('legge index.json: una pagina iframe per storia, le docs no, alternando i componenti', async () => {
    const stories = await storybookPages('https://sb.example.com/', answering({ 'https://sb.example.com/index.json': INDEX }), 3);

    expect(stories?.names).toEqual(['Button', 'Card']);
    expect(stories?.pages).toEqual([
      { label: 'Button / Primary', url: 'https://sb.example.com/iframe.html?id=button--primary&viewMode=story' },
      { label: 'Card / Default', url: 'https://sb.example.com/iframe.html?id=card--default&viewMode=story' },
      { label: 'Button / Outline', url: 'https://sb.example.com/iframe.html?id=button--outline&viewMode=story' }
    ]);
  });

  it('le storie scelte per id vincono sull\'ordine', async () => {
    const stories = await storybookPages('https://sb.example.com/', answering({ 'https://sb.example.com/index.json': INDEX }), 10, ['card--default']);

    expect(stories?.pages.map((p) => p.label)).toEqual(['Card / Default']);
  });

  it('una Storybook 6 risponde da stories.json', async () => {
    const v6 = { v: 3, stories: { 'card--default': { id: 'card--default', title: 'Card', name: 'Default' } } };
    const stories = await storybookPages('https://sb.example.com/', answering({ 'https://sb.example.com/stories.json': v6 }), 10);

    expect(stories?.pages).toEqual([{ label: 'Card / Default', url: 'https://sb.example.com/iframe.html?id=card--default&viewMode=story' }]);
  });

  it('senza indice non è una Storybook', async () => {
    expect(await storybookPages('https://sb.example.com/', answering({}), 10)).toBeNull();
  });
});
