import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { leftPanelRequest } from './left-panel-request.svelte';

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

describe('chiedere un pannello a sinistra da fuori del layout', () => {
  it('ogni richiesta porta il pannello voluto e conta come nuova, anche se uguale alla precedente', () => {
    const before = leftPanelRequest.asked;
    leftPanelRequest.ask('styles');
    leftPanelRequest.ask('styles');

    expect(leftPanelRequest.kind).toBe('styles');
    expect(leftPanelRequest.asked).toBe(before + 2);
  });

  it('il menu del logo apre il pannello, non un link alla radice del progetto', () => {
    const menu = read('../components/canvas/CanvasMenu.svelte');

    expect(menu).toContain('leftPanelRequest.ask(entry.id');
    expect(menu).toContain("entry.family === 'panel'");
  });

  it('il layout apre il pannello richiesto', () => {
    expect(read('../../routes/p/[projectId]/+layout.svelte')).toContain('leftPanelRequest.asked');
  });

  it('sul telefono il pannello si apre in un foglio, perche il layout mobile non ha il riquadro a sinistra', () => {
    const layout = read('../../routes/p/[projectId]/+layout.svelte');

    expect(layout).toContain('name="canvas-panel"');
    expect(read('../components/canvas/CanvasLeftPanel.svelte')).toContain('docked');
  });
});
