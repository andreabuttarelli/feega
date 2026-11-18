import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { insertRequest } from './insert-request.svelte';
import { AI_PANEL_NODES } from './ai-panel';
import { AI_ADDABLE } from './addable';
import { barSlots, BarWidth } from './bottom-bar';
import { EditorMode } from './editor-mode.svelte';
import { NAV_ENTRIES } from '$lib/shell-nav';

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

describe('inserire un nodo AI dal pannello a sinistra', () => {
  it('ogni richiesta porta il nodo voluto e conta come nuova, anche se uguale', () => {
    const before = insertRequest.asked;
    insertRequest.ask('image');
    insertRequest.ask('image');

    expect(insertRequest.what).toBe('image');
    expect(insertRequest.asked).toBe(before + 2);
  });

  it('il pannello offre tutti i nodi AI, presi dal modello', () => {
    expect(new Set(AI_PANEL_NODES)).toEqual(AI_ADDABLE);
  });

  it('la barra in basso non ha piu la parte AI', () => {
    expect(barSlots(EditorMode.Design, BarWidth.Wide)).not.toContain('generate');
    expect(read('../components/canvas/CanvasAddBar.svelte')).not.toContain('pinned-generate');
  });

  it('il pannello AI e una riga della rail, nello stesso registro degli altri', () => {
    expect(NAV_ENTRIES.find((e) => e.id === 'ai')?.family).toBe('panel');
  });

  it('clic nel pannello arriva alla stessa azione di creazione della barra', () => {
    expect(read('../components/canvas/AiNodesPanel.svelte')).toContain('insertRequest.ask');
    expect(read('../components/canvas/gpu/GpuFlow.svelte')).toContain('insertRequest.asked');
    expect(read('../components/canvas/gpu/GpuFlow.svelte')).toMatch(/addAtCentre\(insertRequest\.what/);
  });
});
