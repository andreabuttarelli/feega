<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { finishOAuth, land } from '$lib/native/native-auth';
  import { SIGN_IN_ERROR_PARAM, SignInError } from '$lib/login/sign-in-error';
  import { LOGIN_PATH } from '$lib/native/bundle-routes';

  const FAILED = `${LOGIN_PATH}?${SIGN_IN_ERROR_PARAM}=${SignInError.OAuth}`;

  onMount(async () => {
    const code = page.url.searchParams.get('code');
    if (!code || page.url.searchParams.has(SIGN_IN_ERROR_PARAM)) {
      await goto(FAILED);
      return;
    }
    const refused = await finishOAuth(code);
    if (refused) {
      await goto(FAILED);
      return;
    }
    await land();
  });
</script>
