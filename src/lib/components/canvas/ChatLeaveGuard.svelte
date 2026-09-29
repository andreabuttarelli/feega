<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { anyChatRunning } from '$lib/components/brand-agent/chat-session.svelte';
  import { leaveVerdict } from '$lib/chat-leave-guard';

  let { projectId }: { projectId: string } = $props();

  let target = $state<URL | null>(null);
  let leaving = false;

  beforeNavigate((nav) => {
    if (leaving || nav.willUnload || !anyChatRunning()) {
      return;
    }
    if (leaveVerdict(projectId, page.url, nav.to?.url ?? null) === 'allow') {
      return;
    }
    nav.cancel();
    target = nav.to?.url ?? null;
  });

  $effect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!anyChatRunning()) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  });

  function stay() {
    target = null;
  }

  async function leave() {
    const url = target;
    target = null;
    if (!url) {
      return;
    }
    leaving = true;
    try {
      await goto(url);
    } finally {
      leaving = false;
    }
  }
</script>

<Dialog.Root open={target !== null} onOpenChange={(open) => { if (!open) { stay(); } }}>
  <Dialog.Content class="flex flex-col gap-5 p-6 sm:max-w-sm" showCloseButton={false}>
    <Dialog.Header>
      <Dialog.Title class="text-base">{$_('chat.leave.title')}</Dialog.Title>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="secondary" onclick={stay}>{$_('chat.leave.stay')}</Button>
      <Button onclick={leave}>{$_('chat.leave.leave')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
