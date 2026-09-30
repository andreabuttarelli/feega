<script lang="ts">
  import { enhance } from '$app/forms';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { UNCENSORED_LOCK_TEXT, UncensoredLock } from '$lib/uncensored-lock';

  let { data, form } = $props();
  const failure = $derived((form as { error?: string } | null)?.error ?? null);
</script>

<div class="uncensored-page" data-testid="uncensored-workspace">
  <Panel title="Uncensored workspace">
    <p class="uncensored-mark" data-testid="uncensored-badge">Uncensored · 18+</p>
    <p>Uncensored mode — models without built-in content filters, for adults (18+). Our safety rules still apply.</p>
    <p>Projects here are separate from your other work. They cannot be shared, published, scheduled or promoted, and every output is labelled as AI-generated.</p>

    {#if failure}
      <Notice class="mb-0">{UNCENSORED_LOCK_TEXT[failure as UncensoredLock] ?? failure}</Notice>
    {/if}

    {#if data.lock === UncensoredLock.ComingSoon}
      <div data-testid="uncensored-coming-soon"><Notice class="mb-0">{data.text}</Notice></div>
    {:else if data.lock === UncensoredLock.AgeUnverified}
      <form method="POST" action="?/verify" use:enhance>
        <p>{data.text}</p>
        <Button type="submit" data-testid="uncensored-verify">Verify my age</Button>
      </form>
    {:else}
      <ul class="uncensored-list" data-testid="uncensored-projects">
        {#each data.projects as project (project.id)}
          <li><a href={project.href}>{project.name}</a></li>
        {/each}
      </ul>
      <form method="POST" action="?/create" class="uncensored-create">
        <input name="name" placeholder="Project name" class="uncensored-input" data-testid="uncensored-project-name" />
        <Button type="submit" data-testid="uncensored-create">New uncensored project</Button>
      </form>
    {/if}
  </Panel>
</div>

<style>
  .uncensored-page {
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }
  .uncensored-mark {
    display: inline-block;
    border: 1px solid var(--color-destructive);
    color: var(--color-destructive);
    padding: 0 0.375rem;
    font-size: 0.75rem;
  }
  .uncensored-list {
    display: grid;
    gap: 0.25rem;
    margin: 0.75rem 0;
  }
  .uncensored-create {
    display: flex;
    gap: 0.5rem;
  }
  .uncensored-input {
    flex: 1;
    border: 1px solid var(--border);
    padding: 0 0.5rem;
    background: transparent;
  }
</style>
