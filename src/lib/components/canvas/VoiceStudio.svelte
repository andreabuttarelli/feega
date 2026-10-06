<script lang="ts" module>
  export type VoiceSlots = { used: number; quota: number; left: number };
  export type CustomVoiceChoice = { id: string; providerVoiceId: string; name: string; method: string };
  export type VoiceAnswer = { ok: true; data: Record<string, unknown> } | { ok: false; message: string };
  export type VoiceAction = (action: string, fields: Record<string, string | File>) => Promise<VoiceAnswer>;
</script>

<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import X from '@lucide/svelte/icons/x';
  import VoiceRecorder from './VoiceRecorder.svelte';
  import { CONSENT_BASES, MIN_VOICE_DESCRIPTION, VOICE_GENDERS, VOICE_USE_CASES, type ConsentBasis } from '$lib/canvas/voices';
  import { DUBBING_LANGUAGES } from '$lib/canvas/audio-operations';

  let {
    slots,
    custom,
    cloningAllowed,
    onaction,
    onpick,
    onchanged,
    onclose
  }: {
    slots: VoiceSlots | null;
    custom: CustomVoiceChoice[];
    cloningAllowed: boolean;
    onaction: VoiceAction;
    onpick: (voice: { id: string; name: string }) => void;
    onchanged: () => void;
    onclose: () => void;
  } = $props();

  const ICON_SIZE = 12;
  const TABS = { library: 'Library', design: 'Design', clone: 'Clone', mine: 'My voices' } as const;
  type Tab = keyof typeof TABS;
  type LibraryVoice = { id: string; ownerId: string; name: string; previewUrl: string | null; gender: string | null; accent: string | null; language: string | null; useCase: string | null };
  type Preview = { generatedVoiceId: string; audioBase64: string; mime: string };

  let tab = $state<Tab>('library');
  let busy = $state(false);
  let message = $state<string | null>(null);

  let filters = $state({ search: '', language: '', gender: '', accent: '', useCase: '' });
  let library = $state<LibraryVoice[]>([]);
  let page = $state(0);
  let hasMore = $state(false);

  let description = $state('');
  let previews = $state<Preview[]>([]);
  let designName = $state('');

  let cloneName = $state('');
  let consentBasis = $state<ConsentBasis>('own_voice');
  let speaker = $state('');
  let attested = $state(false);
  let take = $state<{ file: File; seconds: number } | null>(null);

  const slotsFull = $derived(slots !== null && slots.left <= 0);

  async function act(action: string, fields: Record<string, string | File>): Promise<Record<string, unknown> | null> {
    busy = true;
    message = null;
    const answer = await onaction(action, fields);
    busy = false;
    if (!answer.ok) {
      message = answer.message;
      return null;
    }
    return answer.data;
  }

  async function search(next = 0) {
    const data = await act('voice_library', { ...filters, page: String(next) });
    if (!data) {
      return;
    }
    page = next;
    library = (data.voices as LibraryVoice[]) ?? [];
    hasMore = Boolean(data.hasMore);
  }

  function play(url: string | null) {
    if (url) {
      void new Audio(url).play();
    }
  }

  async function useLibrary(voice: LibraryVoice) {
    const data = await act('voice_use_library', { owner_id: voice.ownerId, voice_id: voice.id, name: voice.name });
    if (data) {
      onpick({ id: String(data.voiceId), name: voice.name });
    }
  }

  async function design() {
    const data = await act('voice_design', { description });
    previews = (data?.previews as Preview[] | undefined) ?? [];
  }

  async function saveDesign(preview: Preview) {
    const data = await act('voice_save', { generated_voice_id: preview.generatedVoiceId, name: designName, description });
    pickSaved(data);
  }

  async function clone() {
    if (!take) {
      return;
    }
    const data = await act('voice_clone', {
      name: cloneName,
      consent_basis: consentBasis,
      speaker,
      attested: attested ? 'on' : '',
      seconds: String(take.seconds),
      sample: take.file
    });
    pickSaved(data);
  }

  function pickSaved(data: Record<string, unknown> | null) {
    const voice = data?.voice as CustomVoiceChoice | undefined;
    if (!voice) {
      return;
    }
    onchanged();
    onpick({ id: voice.providerVoiceId, name: voice.name });
  }

  async function remove(voice: CustomVoiceChoice) {
    if (!confirm(`Delete "${voice.name}"? Nodes using it will stop speaking with it.`)) {
      return;
    }
    if (await act('voice_delete', { id: voice.id })) {
      onchanged();
    }
  }

  const cloneReady = $derived(Boolean(take && cloneName.trim() && attested && (consentBasis === 'own_voice' || speaker.trim())));
</script>

<div class="backdrop nodrag" role="presentation" onclick={onclose}>
  <div class="studio" role="dialog" aria-modal="true" aria-label="Voices" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
    <header>
      <nav>
        {#each Object.entries(TABS) as [id, label] (id)}
          {#if id !== 'clone' || cloningAllowed}
            <button type="button" class:active={tab === id} onclick={() => (tab = id as Tab)}>{label}</button>
          {/if}
        {/each}
      </nav>
      {#if slots}
        <span class="slots" data-testid="voice-slots">{slots.left} of {slots.quota} custom voice slots left</span>
      {/if}
      <button type="button" class="icon" aria-label="Close" onclick={onclose}><X size={ICON_SIZE} /></button>
    </header>

    {#if tab === 'library'}
      <form class="filters" onsubmit={(e) => { e.preventDefault(); void search(0); }}>
        <input placeholder="Search voices" bind:value={filters.search} aria-label="Search voices" />
        <select bind:value={filters.language} aria-label="Language">
          <option value="">Any language</option>
          {#each Object.entries(DUBBING_LANGUAGES) as [code, name] (code)}
            <option value={code}>{name}</option>
          {/each}
        </select>
        <select bind:value={filters.gender} aria-label="Gender">
          <option value="">Any gender</option>
          {#each VOICE_GENDERS as gender (gender)}
            <option value={gender}>{gender}</option>
          {/each}
        </select>
        <input placeholder="Accent" bind:value={filters.accent} aria-label="Accent" />
        <select bind:value={filters.useCase} aria-label="Use case">
          <option value="">Any use</option>
          {#each VOICE_USE_CASES as useCase (useCase)}
            <option value={useCase}>{useCase.replaceAll('_', ' ')}</option>
          {/each}
        </select>
        <button type="submit" class="primary" disabled={busy}>Search</button>
      </form>
      <ul class="list">
        {#each library as voice (voice.id)}
          <li>
            <button type="button" class="icon" aria-label="Preview {voice.name}" disabled={!voice.previewUrl} onclick={() => play(voice.previewUrl)}><Play size={ICON_SIZE} /></button>
            <span class="name">{voice.name}</span>
            <span class="meta">{[voice.gender, voice.accent, voice.language, voice.useCase?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</span>
            <button type="button" disabled={busy} onclick={() => useLibrary(voice)}>Use</button>
          </li>
        {/each}
      </ul>
      {#if page > 0 || hasMore}
        <div class="pager">
          <button type="button" disabled={busy || page === 0} onclick={() => search(page - 1)}>Previous</button>
          <button type="button" disabled={busy || !hasMore} onclick={() => search(page + 1)}>Next</button>
        </div>
      {/if}
    {:else if tab === 'design'}
      <label>
        <span>Describe the voice (age, accent, tone, pace)</span>
        <textarea rows="3" bind:value={description} placeholder="A warm, calm woman in her forties with a light Italian accent"></textarea>
      </label>
      <button type="button" class="primary" disabled={busy || slotsFull || description.trim().length < MIN_VOICE_DESCRIPTION} onclick={design}>Generate previews</button>
      {#if previews.length}
        <label><span>Name</span><input bind:value={designName} aria-label="Voice name" /></label>
        <ul class="list">
          {#each previews as preview, index (preview.generatedVoiceId)}
            <li>
              <button type="button" class="icon" aria-label="Play preview {index + 1}" onclick={() => play(`data:${preview.mime};base64,${preview.audioBase64}`)}><Play size={ICON_SIZE} /></button>
              <span class="name">Preview {index + 1}</span>
              <button type="button" disabled={busy || !designName.trim()} onclick={() => saveDesign(preview)}>Save</button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if tab === 'clone'}
      <p class="hint">Clone only your own voice, or a voice whose speaker explicitly agreed. Never use a voice to impersonate someone. The recording is deleted once the voice is created.</p>
      <label><span>Name</span><input bind:value={cloneName} aria-label="Voice name" /></label>
      <fieldset>
        {#each Object.entries(CONSENT_BASES) as [basis, label] (basis)}
          <label class="inline"><input type="radio" name="consent" value={basis} bind:group={consentBasis} /> {label}</label>
        {/each}
      </fieldset>
      {#if consentBasis === 'consented_speaker'}
        <label><span>Speaker's full name</span><input bind:value={speaker} aria-label="Speaker name" /></label>
      {/if}
      <VoiceRecorder onrecorded={(next) => (take = next)} />
      <label class="inline">
        <input type="checkbox" bind:checked={attested} />
        I confirm I have the right to clone this voice and will not use it to impersonate anyone.
      </label>
      <button type="button" class="primary" disabled={busy || slotsFull || !cloneReady} onclick={clone}>Create voice</button>
    {:else}
      <ul class="list">
        {#each custom as voice (voice.id)}
          <li>
            <span class="name">{voice.name}</span>
            <span class="meta">{voice.method === 'instant_clone' ? 'cloned' : 'designed'}</span>
            <button type="button" disabled={busy} onclick={() => onpick({ id: voice.providerVoiceId, name: voice.name })}>Use</button>
            <button type="button" disabled={busy} onclick={() => remove(voice)}>Delete</button>
          </li>
        {:else}
          <li class="meta">No custom voices yet.</li>
        {/each}
      </ul>
    {/if}

    {#if slotsFull && (tab === 'design' || tab === 'clone')}
      <p class="problem">All your voice slots are in use. Delete a custom voice to make room.</p>
    {/if}
    {#if message}
      <p class="problem" role="alert">{message}</p>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgb(0 0 0 / 0.35);
  }
  .studio {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(560px, 100%);
    max-height: calc(100vh - 32px);
    overflow: auto;
    padding: 12px;
    font-size: 12px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  nav {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;
  }
  nav .active {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }
  .slots,
  .meta,
  .hint {
    color: var(--ink-soft, #6e6e73);
  }
  .hint,
  .problem {
    margin: 0;
  }
  .problem {
    color: var(--danger, #c0392b);
  }
  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 6px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .name {
    font-weight: 500;
  }
  .meta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pager {
    display: flex;
    justify-content: space-between;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  label.inline {
    flex-direction: row;
    align-items: flex-start;
    gap: 6px;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  input:not([type='radio'], [type='checkbox']),
  select,
  textarea {
    padding: 4px;
    font: inherit;
    color: var(--ink, #1d1d1f);
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper-2, #f9f9f9);
  }
  button {
    padding: 4px 10px;
    font: inherit;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .primary {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
  }
</style>
