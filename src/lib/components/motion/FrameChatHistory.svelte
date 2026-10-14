<script lang="ts">
  import ChatMessage from '$lib/components/brand-agent/ChatMessage.svelte';
  import type { Turn } from '$lib/server/repos/chat';

  let { historyUrl, projectId }: { historyUrl: string; projectId: string } = $props();

  let turns = $state<Turn[]>([]);

  $effect(() => {
    let stale = false;
    void fetch(historyUrl)
      .then((res) => (res.ok ? (res.json() as Promise<{ messages?: Turn[] }>) : null))
      .then((body) => {
        if (!stale) {
          turns = body?.messages ?? [];
        }
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  });
</script>

{#if turns.length}
  <details class="frame-history" data-testid="frame-chat-history">
    <summary>Earlier chat about this frame ({turns.length})</summary>
    {#each turns as turn, i (i)}
      <ChatMessage role={turn.role} content={turn.content} {projectId} tools={turn.tools as never} attachments={turn.attachments} />
    {/each}
  </details>
{/if}

<style>
  .frame-history {
    padding: 8px 12px;
    border-bottom: 1px solid var(--line, #ededef);
    font-size: 12px;
  }
  .frame-history summary {
    cursor: pointer;
    color: var(--ink-soft, #6e6e73);
  }
</style>
