import { describe, expect, it } from 'vitest';
import { agentContext, agentContexts, commentContext, type AgentView } from './agent-context';
import type { CloudComment } from '../host/cloud-api';
import type { Pick } from '../messages';

const pick = { source: { file: 'src/Hero.tsx', line: 12, col: 5 }, component: { file: 'src/Page.tsx', line: 4, col: 3 }, tag: 'button', classes: 'btn  primary ', instanceIndex: 0, instances: 1, ownText: true } as Pick;
const view: AgentView = { route: '/pricing', width: 390, breakpoint: 'Phone', theme: 'Dark', state: 'hover' };

describe('agentContext', () => {
  it('dice file:line, selettore, componente, pagina e dimensione', () => {
    expect(agentContext(pick, view)).toBe(['Feega selection', 'source: src/Hero.tsx:12:5', 'selector: button.btn.primary', 'component: src/Page.tsx:4:3', 'page: /pricing', 'preview: 390px', 'breakpoint: Phone', 'theme: Dark', 'state: hover'].join('\n'));
  });

  it('omette le righe che non ci sono', () => {
    const plain = { ...pick, component: null, classes: '' } as Pick;

    expect(agentContext(plain, { route: '/', width: 1280 })).toBe(['Feega selection', 'source: src/Hero.tsx:12:5', 'selector: button', 'page: /', 'preview: 1280px'].join('\n'));
  });

  it('con piu istanze dice quale', () => {
    expect(agentContext({ ...pick, instances: 3, instanceIndex: 1 } as Pick, { route: '/', width: 800 })).toContain('instance: 2 of 3');
  });
});

describe('agentContexts', () => {
  const other = { ...pick, source: { file: 'src/Hero.tsx', line: 20, col: 5 }, tag: 'a', classes: 'link' } as Pick;

  it('is the plain block for one element', () => {
    expect(agentContexts([pick], view)).toBe(agentContext(pick, view));
  });

  it('puts every selected element in one block, numbered, with the view said once', () => {
    const text = agentContexts([pick, other], view);

    expect(text.split('\n')[0]).toBe('Feega selection: 2 elements');
    expect(text).toContain('1. source: src/Hero.tsx:12:5');
    expect(text).toContain('2. source: src/Hero.tsx:20:5');
    expect(text.match(/page: \/pricing/g)).toHaveLength(1);
  });
});

describe('commentContext', () => {
  const comment = { id: 'c1', authorName: 'Ada', body: 'Tighter padding', selector: 'div.card', sourceFile: 'src/Card.svelte', sourceLine: 4, sourceCol: 2 } as CloudComment;

  it('dice chi, cosa, file:line:col e selettore', () => {
    expect(commentContext(comment)).toBe(['Feega comment', 'author: Ada', 'comment: Tighter padding', 'source: src/Card.svelte:4:2', 'selector: div.card'].join('\n'));
  });

  it('porta le risposte dopo il commento', () => {
    const reply = { authorName: 'Bob', body: 'Agreed' } as CloudComment;

    expect(commentContext(comment, [reply])).toContain('comment: Tighter padding\nreply from Bob: Agreed\nsource:');
  });
});

describe('the context without a selection', () => {
  it('still says the page and the focused component', () => {
    const focus = { name: 'InstallCta', source: { file: 'src/InstallCta.svelte', line: 12, col: 1 } };

    expect(agentContexts([], { route: '/pricing', width: 1280, focus })).toBe(['Feega page', 'page: /pricing', 'preview: 1280px', 'focused component: InstallCta (src/InstallCta.svelte:12:1)'].join('\n'));
  });

  it('adds the focused component to a selection too', () => {
    const focus = { name: 'Hero', source: { file: 'src/Hero.tsx', line: 3, col: 1 } };

    expect(agentContexts([pick], { route: '/', width: 800, focus })).toContain('focused component: Hero (src/Hero.tsx:3:1)');
  });
});
