<script lang="ts">
  import { onMount } from 'svelte';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { disablePush, enablePush, pushState, PushState } from '$lib/cloud/push-client';

  let current = $state<PushState | null>(null);
  let busy = $state(false);

  const HINTS: Record<PushState, string> = {
    [PushState.Unsupported]: 'This browser cannot receive push notifications.',
    [PushState.Unconfigured]: 'Push notifications are not available yet.',
    [PushState.Denied]: 'Notifications are blocked in your browser settings.',
    [PushState.Off]: 'Get notified when a teammate shares a session or comments on yours.',
    [PushState.On]: 'You will be notified when a teammate shares a session or comments on yours.'
  };

  onMount(async () => {
    current = await pushState();
  });

  async function toggle() {
    busy = true;
    current = current === PushState.On ? await disablePush() : await enablePush();
    busy = false;
  }
</script>

{#if current}
  <Panel title="Notifications" description={HINTS[current]}>
    <div class="px-5 pb-4">
      {#if current === PushState.On || current === PushState.Off}
        <Button variant="secondary" size="sm" type="button" disabled={busy} onclick={toggle} data-testid="toggle-push">
          {current === PushState.On ? 'Turn off notifications' : 'Turn on notifications'}
        </Button>
      {/if}
    </div>
  </Panel>
{/if}
