<script lang="ts">
  import { enhance } from '$app/forms';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { NSFW_LOCK_TEXT, NsfwLock } from '$lib/nsfw-access';

  let { data, form } = $props();
  const failure = $derived((form as { error?: string } | null)?.error ?? null);
</script>

<div class="nsfw-page" data-testid="nsfw-workspace">
  <Panel title="NSFW workspace">
    <p class="nsfw-mark" data-testid="nsfw-badge">NSFW · 18+</p>
    <p>Projects here are separate from your other work. They cannot be shared, published, scheduled or promoted, and every output is labelled as AI-generated.</p>

    {#if failure}
      <Notice class="mb-0">{NSFW_LOCK_TEXT[failure as NsfwLock] ?? failure}</Notice>
    {/if}

    {#if data.lock === NsfwLock.ComingSoon}
      <div data-testid="nsfw-coming-soon"><Notice class="mb-0">{data.text}</Notice></div>
    {:else if data.lock === NsfwLock.AgeUnverified}
      <form method="POST" action="?/verify" use:enhance>
        <p>{data.text}</p>
        <Button type="submit" data-testid="nsfw-verify">Verify my age</Button>
      </form>
    {:else}
      <ul class="nsfw-list" data-testid="nsfw-projects">
        {#each data.projects as project (project.id)}
          <li><a href={project.href}>{project.name}</a></li>
        {/each}
      </ul>
      <form method="POST" action="?/create" class="nsfw-create">
        <input name="name" placeholder="Project name" class="nsfw-input" data-testid="nsfw-project-name" />
        <Button type="submit" data-testid="nsfw-create">New NSFW project</Button>
      </form>
    {/if}
  </Panel>
</div>

<style>
  .nsfw-page {
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }
  .nsfw-mark {
    display: inline-block;
    border: 1px solid var(--destructive);
    color: var(--destructive);
    padding: 0 0.375rem;
    font-size: 0.75rem;
  }
  .nsfw-list {
    display: grid;
    gap: 0.25rem;
    margin: 0.75rem 0;
  }
  .nsfw-create {
    display: flex;
    gap: 0.5rem;
  }
  .nsfw-input {
    flex: 1;
    border: 1px solid var(--border);
    padding: 0 0.5rem;
    background: transparent;
  }
</style>
