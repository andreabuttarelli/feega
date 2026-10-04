<script lang="ts">
  import { deserialize } from '$app/forms';
  import X from '@lucide/svelte/icons/x';

  export type SoundKind = 'voice' | 'music';
  export type Made = { assetId: string; seconds: number; url: string | null };

  const COPY: Record<SoundKind, { title: string; label: string; placeholder: string; fallback: string }> = {
    voice: { title: 'Generate a voice-over', label: 'Script', placeholder: 'Meet the new runner. Lighter, faster, made to move.', fallback: 'Voice-over not generated' },
    music: { title: 'Generate music', label: 'Describe the music', placeholder: 'Upbeat electronic bed, 120 bpm, confident, no vocals', fallback: 'Music not generated' }
  };

  const ERRORS: Record<string, string> = {
    elevenlabs_not_configured: 'Audio generation is not set up on this server.',
    blocked_by_moderation: 'This text was blocked by the safety review.',
    insufficient_credits: 'Not enough credits.'
  };

  let { kind, editorUrl, seconds: initial, onclose, onmade }: { kind: SoundKind; editorUrl: string; seconds: number; onclose: () => void; onmade: (made: Made) => void } = $props();

  let text = $state('');
  let seconds = $state(Math.max(3, Math.round(initial)));
  let working = $state(false);
  let error = $state('');
  const copy = $derived(COPY[kind]);

  async function generate() {
    working = true;
    error = '';
    const form = new FormData();
    form.set('sound', kind);
    form.set('text', text);
    form.set('seconds', String(seconds));
    const res = await fetch(`${editorUrl}?/sound`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    working = false;
    if (result.type === 'success' && result.data) {
      onmade(result.data as Made);
      return;
    }
    const code = result.type === 'failure' ? String(result.data?.error ?? '') : '';
    error = ERRORS[code] ?? `${copy.fallback}${code ? ` (${code})` : ''}.`;
  }
</script>

<div class="scrim" role="presentation" onclick={() => !working && onclose()}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label={copy.title}>
  <header>
    <span>{copy.title}</span>
    <button type="button" aria-label="Close" disabled={working} onclick={onclose}><X size={16} /></button>
  </header>
  <label>
    {copy.label}
    <textarea rows="4" maxlength="2000" placeholder={copy.placeholder} bind:value={text} disabled={working}></textarea>
  </label>
  {#if kind === 'music'}
    <label class="inline">Length (s) <input type="number" min="3" max="60" bind:value={seconds} disabled={working} /></label>
  {/if}
  {#if error}<p class="warn" role="alert">{error}</p>{/if}
  <button type="button" class="primary" disabled={working || !text.trim()} onclick={generate}>{working ? 'Generating…' : 'Generate · uses credits'}</button>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
    font-size: 13px;
  }

  header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--ui-ink-2);
  }

  .inline {
    flex-direction: row;
    align-items: center;
  }

  textarea,
  input {
    padding: 6px 8px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  input {
    width: 72px;
  }

  .warn {
    color: #b45309;
    margin: 0;
  }

  .primary {
    padding: 8px 12px;
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: 12px;
  }

  .primary:disabled {
    opacity: 0.5;
  }
</style>
