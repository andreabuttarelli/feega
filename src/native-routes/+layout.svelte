<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import WebRoot from '$web/+layout.svelte';
  import { inBundle } from '$lib/native/bundle-routes';
  import { openHosted } from '$lib/login/client-auth';

  let { data, children } = $props();

  beforeNavigate(({ to, cancel }) => {
    if (!to || to.url.origin !== location.origin || inBundle(to.url.pathname)) {
      return;
    }
    cancel();
    void openHosted(to.url.pathname + to.url.search);
  });
</script>

<WebRoot {data}>
  {@render children()}
</WebRoot>
