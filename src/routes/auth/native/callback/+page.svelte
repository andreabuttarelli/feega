<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { NEXT_PARAM, nextAfterSignIn } from '$lib/auth/bundle-auth';
  import { finishOAuth } from '$lib/auth/bundle-session';

  const CODE_PARAM = 'code';
  const SIGN_IN = '/login';

  let error = $state('');

  onMount(async () => {
    const code = page.url.searchParams.get(CODE_PARAM);
    const outcome = code ? await finishOAuth(code) : { ok: false as const, error: 'missing code' };
    if (!outcome.ok) {
      error = outcome.error;
      return;
    }
    await invalidateAll();
    await goto(nextAfterSignIn(page.url.searchParams.get(NEXT_PARAM)), { replaceState: true });
  });
</script>

{#if error}
  <p role="alert">Sign-in failed: {error}. <a href={SIGN_IN}>Try again</a></p>
{:else}
  <p>Signing you in…</p>
{/if}
