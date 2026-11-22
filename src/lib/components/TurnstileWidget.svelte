<script lang="ts">
  import { onMount } from 'svelte';
  import { loadTurnstile } from '$lib/turnstile-client';

  let { siteKey, resetSignal = 0 }: { siteKey: string; resetSignal?: number } = $props();

  let container: HTMLDivElement;
  let token = $state('');
  let widgetId: string | null = null;

  onMount(() => {
    let removed = false;

    loadTurnstile().then((turnstile) => {
      if (removed) {
        return;
      }

      widgetId = turnstile.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (value: string) => (token = value),
        'expired-callback': () => (token = ''),
        'error-callback': () => (token = '')
      });
    }).catch(() => undefined);

    return () => {
      removed = true;
      window.turnstile?.remove(widgetId ?? '');
    };
  });

  $effect(() => {
    resetSignal;
    token = '';
    if (widgetId) {
      window.turnstile?.reset(widgetId);
    }
  });
</script>

<div bind:this={container}></div>
<input type="hidden" name="cf-turnstile-response" value={token} />
