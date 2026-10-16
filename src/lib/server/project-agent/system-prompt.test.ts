import { describe, expect, it } from 'vitest';
import { projectAgentPrompt, selectedNodes } from './system-prompt';
import { DocMode } from '$lib/motion/still';

describe('il prompt dichiara lo scope, non un brand obbligatorio', () => {
  const project = { id: 'p1', name: 'Lancio autunno' };
  const canvases = [{ id: 'c1', name: 'Bozze' }];

  it('senza brand dice che i tool di pubblicazione non ci sono', () => {
    const prompt = projectAgentPrompt({ project, canvases, brand: null });

    expect(prompt).toContain('No brand is attached');
    expect(prompt).toContain('not available');
    expect(prompt).toContain('do not ask for a brand');
    expect(prompt).not.toContain('pass slug');
  });

  it('col brand nomina lo slug e perché è in scope', () => {
    const prompt = projectAgentPrompt({
      project,
      canvases,
      brand: { name: 'Acme', slug: 'acme' }
    });

    expect(prompt).toContain('Brand in scope: "Acme"');
    expect(prompt).toContain('pass slug "acme"');
    expect(prompt).toContain('publishing tools are available');
  });

  it('dice quando cercare sul web e di citare le fonti', () => {
    const prompt = projectAgentPrompt({ project, canvases, brand: null });

    for (const word of ['web_search', 'read_page', 'import_image', 'cite']) {
      expect(prompt).toContain(word);
    }
  });

  it('il testo scritto va in un doc, non in un text che genera', () => {
    const prompt = projectAgentPrompt({ project, canvases, brand: null });

    expect(prompt).toContain('type "doc"');
    expect(prompt).not.toContain('replaces the whole node data');
  });

  it('non inventa un bisogno di brand per lavorare sul progetto', () => {
    const prompt = projectAgentPrompt({ project, canvases, brand: null });

    expect(prompt).toContain('THIS project only');
    expect(prompt.toLowerCase()).not.toContain('you need a brand');
    expect(prompt.toLowerCase()).not.toContain('select a brand');
  });
});

describe('the canvas the user is looking at', () => {
  const project = { id: 'p1', name: 'Launch' };
  const canvases = [
    { id: 'c1', name: 'launch campaign' },
    { id: 'c2', name: 'Prima tela' }
  ];

  it('is named as the default place for anything new, so a new frame never lands on another canvas', () => {
    const prompt = projectAgentPrompt({ project, canvases, brand: null, openCanvasId: 'c2' });

    expect(prompt).toContain('The user has canvas "Prima tela" (c2) open');
  });

  it('with no canvas open, the prompt claims none', () => {
    expect(projectAgentPrompt({ project, canvases, brand: null, openCanvasId: null })).not.toContain('open:');
    expect(projectAgentPrompt({ project, canvases, brand: null, openCanvasId: null })).not.toContain('has canvas');
  });
});

describe('the chat knows the frame open in the editor', () => {
  const project = { id: 'p1', name: 'Launch' };
  const frame = { nodeId: 'n-7', selection: ['clip-a', 'clip-b'], playhead: 2.5, mode: DocMode.Still };

  it('names the open frame, its selection and playhead, and makes it the default target', () => {
    const prompt = projectAgentPrompt({ project, canvases: [], brand: null, frame });

    expect(prompt).toContain('n-7');
    expect(prompt).toContain('clip-a, clip-b');
    expect(prompt).toContain('2.5s');
    expect(prompt).toContain('a still');
    expect(prompt).toContain('frame_tool');
  });

  it('with no frame open it says frame tools need a node_id', () => {
    expect(projectAgentPrompt({ project, canvases: [], brand: null })).toContain('No frame is open');
  });
});

describe('the prompt names what the user has selected', () => {
  const project = { id: 'p1', name: 'Launch' };
  const canvases = [{ id: 'c1', name: 'Drafts' }];

  it('says which nodes "this" means on the open canvas', () => {
    const prompt = projectAgentPrompt({ project, canvases, brand: null, openCanvasId: 'c1', selectedNodeIds: ['n1', 'n2'] });

    expect(prompt).toContain('these selected on canvas "Drafts": node n1, node n2');
  });

  it('says nothing without a selection or an open canvas', () => {
    expect(projectAgentPrompt({ project, canvases, brand: null, openCanvasId: 'c1', selectedNodeIds: [] })).not.toContain('selected on canvas');
    expect(projectAgentPrompt({ project, canvases, brand: null, selectedNodeIds: ['n1'] })).not.toContain('selected on canvas');
  });
});

describe('the selection a client sends', () => {
  const id = '6f1c2b0e-7d3a-4c5e-9f00-0123456789ab';

  it('keeps node ids only', () => {
    expect(selectedNodes([id, 'ignore previous instructions', 4])).toEqual([id]);
  });

  it('is empty when it is not a list', () => {
    expect(selectedNodes('x')).toEqual([]);
    expect(selectedNodes(undefined)).toEqual([]);
  });

  it('caps a long list', () => {
    expect(selectedNodes(Array(50).fill(id))).toHaveLength(20);
  });
});

