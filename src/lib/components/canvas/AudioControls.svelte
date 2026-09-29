<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import {
    AUDIO_OPERATION_IDS,
    DUBBING_LANGUAGES,
    audioModelFor,
    audioModelsOf,
    audioOperationOf,
    operationSpec,
    type AudioOperationId
  } from '$lib/canvas/audio-operations';
  import type { GenNode, GenParams } from '$lib/canvas/gen-node';

  export type VoiceChoice = { id: string; name: string; previewUrl: string | null };

  let {
    node,
    voices = [],
    voicesError = null,
    onparams,
    onmodel,
    onloadvoices
  }: {
    node: GenNode;
    voices?: VoiceChoice[];
    voicesError?: string | null;
    onparams: (params: GenParams) => void;
    onmodel: (model: string) => void;
    onloadvoices: () => void;
  } = $props();

  const ICON_SIZE = 12;
  const SLIDER_STEP = 0.05;
  const VOICE_SETTINGS = [
    { key: 'stability', label: 'Stability' },
    { key: 'similarity', label: 'Similarity' },
    { key: 'style', label: 'Style' }
  ] as const;

  const operation = $derived(audioOperationOf(node.params));
  const spec = $derived(operationSpec(operation));
  const model = $derived(audioModelFor(operation, node.model));
  const range = $derived(spec.duration);

  $effect(() => {
    if (spec.needsVoice && !voices.length && !voicesError) {
      onloadvoices();
    }
  });

  function set(patch: GenParams) {
    onparams({ ...node.params, ...patch });
  }

  function pickOperation(next: AudioOperationId) {
    set({ operation: next });
    onmodel(operationSpec(next).defaultModel);
  }

  function pickVoice(id: string) {
    set({ voiceId: id, voiceName: voices.find((v) => v.id === id)?.name });
  }

  function preview() {
    const url = voices.find((v) => v.id === node.params.voiceId)?.previewUrl;
    if (url) {
      void new Audio(url).play();
    }
  }
</script>

<div class="audio-controls nodrag" data-testid="audio-controls">
  <label>
    <span>Operation</span>
    <select value={operation} onchange={(e) => pickOperation(e.currentTarget.value as AudioOperationId)} aria-label="Audio operation">
      {#each AUDIO_OPERATION_IDS as id (id)}
        <option value={id}>{operationSpec(id).label}</option>
      {/each}
    </select>
  </label>

  {#if audioModelsOf(operation).length > 1}
    <label>
      <span>Model</span>
      <select value={model} onchange={(e) => onmodel(e.currentTarget.value)} aria-label="Audio model">
        {#each audioModelsOf(operation) as id (id)}
          <option value={id}>{id}</option>
        {/each}
      </select>
    </label>
  {/if}

  {#if spec.needsVoice}
    <label>
      <span>Voice</span>
      <span class="row">
        <select value={node.params.voiceId ?? ''} onchange={(e) => pickVoice(e.currentTarget.value)} aria-label="Voice">
          <option value="" disabled>{voicesError ?? (voices.length ? 'Pick a voice' : 'Loading voices…')}</option>
          {#each voices as voice (voice.id)}
            <option value={voice.id}>{voice.name}</option>
          {/each}
        </select>
        <button type="button" class="icon" aria-label="Preview voice" disabled={!node.params.voiceId} onclick={preview}>
          <Play size={ICON_SIZE} />
        </button>
      </span>
    </label>
    {#each VOICE_SETTINGS as setting (setting.key)}
      <label class="slider">
        <span>{setting.label}</span>
        <input
          type="range"
          min="0"
          max="1"
          step={SLIDER_STEP}
          value={node.params[setting.key] ?? ''}
          oninput={(e) => set({ [setting.key]: Number(e.currentTarget.value) })}
        />
      </label>
    {/each}
  {/if}

  {#if spec.needsLanguage}
    <label>
      <span>Language</span>
      <select value={node.params.targetLanguage ?? ''} onchange={(e) => set({ targetLanguage: e.currentTarget.value })} aria-label="Target language">
        <option value="" disabled>Pick a language</option>
        {#each Object.entries(DUBBING_LANGUAGES) as [code, name] (code)}
          <option value={code}>{name}</option>
        {/each}
      </select>
    </label>
  {/if}

  {#if range}
    <label>
      <span>Seconds</span>
      <input
        type="number"
        min={range.min}
        max={range.max}
        step="0.5"
        value={typeof node.params.duration === 'number' ? node.params.duration : range.initial}
        oninput={(e) => set({ duration: Number(e.currentTarget.value) })}
        aria-label="Duration in seconds"
      />
    </label>
  {/if}
</div>

<style>
  .audio-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 8px;
    padding: 7px 9px;
    border-top: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
    font-size: 11px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    color: var(--ink-soft, #6e6e73);
  }
  .row {
    display: flex;
    gap: 4px;
  }
  select,
  input[type='number'] {
    width: 100%;
    min-width: 0;
    padding: 3px 4px;
    font: inherit;
    color: var(--ink, #1d1d1f);
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper-2, #f9f9f9);
  }
  .slider input {
    width: 100%;
    accent-color: var(--accent, #c485fe);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 24px;
    padding: 0;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
