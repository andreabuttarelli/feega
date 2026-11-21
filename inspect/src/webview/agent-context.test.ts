import { describe, expect, it } from 'vitest';
import { agentContext, agentContexts, type AgentView } from './agent-context';
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
