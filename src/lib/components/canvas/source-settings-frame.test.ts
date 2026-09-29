import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import SourceSettingsFrame from './SourceSettingsFrame.svelte';
import { inspectorOf } from '$lib/canvas/node-inspector';

const noop = () => {};
const preview = createRawSnippet(() => ({ render: () => '<p>preview</p>' }));
const view = inspectorOf({ id: 'n', type: 'social_account_feed', data: { platform: 'instagram', handle: 'nike' } });

function html(selected: boolean): string {
  return render(SourceSettingsFrame, { props: { selected, view, shown: 0, onfield: noop, onsync: noop, children: preview } }).body;
}

describe('le impostazioni di un nodo sorgente vivono dentro il nodo', () => {
  it('la colonna compare solo quando il nodo è selezionato', () => {
    expect(html(false)).not.toContain('data-testid="source-settings"');
    expect(html(true)).toContain('data-testid="source-settings"');
    expect(html(true)).toContain('name="handle"');
  });

  it("l'anteprima resta in entrambi i casi", () => {
    expect(html(false)).toContain('preview');
  });

  it('la zona che scorre non muove né ingrandisce la tela', () => {
    const fields = readFileSync(new URL('./InspectorFields.svelte', import.meta.url), 'utf8');
    const frame = readFileSync(new URL('./SourceSettingsFrame.svelte', import.meta.url), 'utf8');
    expect(fields).toMatch(/class="inspector-body nowheel nodrag nopan"/);
    expect(frame).toMatch(/class="source-settings nowheel nodrag nopan"/);
  });
});
