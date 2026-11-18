<script lang="ts">
  import { NAME_MAX_CHARS } from '$lib/onboarding/limits';

  let { name = $bindable(''), onsave }: { name: string; onsave: (name: string) => void } = $props();

  const ready = $derived(name.trim().length > 0);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (ready) {
      onsave(name.trim());
    }
  }
</script>

<h1 id="ob-title" class="ob-title">what's your name?</h1>
<p class="ob-sub">it sits on your cursor when you work with others.</p>

<form class="ob-form" onsubmit={submit}>
  <!-- svelte-ignore a11y_autofocus -->
  <input class="ob-input" type="text" name="name" autocomplete="name" placeholder="your name" maxlength={NAME_MAX_CHARS} aria-label="Your name" bind:value={name} autofocus data-testid="onboarding-name" />
  <button type="submit" class="ob-primary" disabled={!ready} data-testid="onboarding-continue">continue</button>
</form>
