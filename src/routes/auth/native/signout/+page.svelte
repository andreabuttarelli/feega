<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { signOutHere } from '$lib/auth/bundle-session';

  const SIGN_IN = '/login';

  onMount(async () => {
    await signOutHere();
    await invalidateAll();
    await goto(SIGN_IN, { replaceState: true });
  });
</script>

<p>Signing you out…</p>
