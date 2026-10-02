<script lang="ts">
  import { enhance } from '$app/forms';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { page } from '$app/state';
  import { legalHref } from '$lib/legal-links';
  import { UNCENSORED_LOCK_TEXT, UncensoredLock } from '$lib/uncensored-lock';

  const AGE_NOTICE: Readonly<Record<string, string>> = {
    failed: 'We could not confirm you are 18 or over. You can try again.',
    pending: 'Your check is being reviewed. Come back in a few minutes.'
  };

  let { data, form } = $props();
  const failure = $derived((form as { error?: string } | null)?.error ?? null);
  const ageNotice = $derived(AGE_NOTICE[page.url.searchParams.get('age') ?? ''] ?? null);
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
      <form method="POST" action="?/verify" use:enhance data-testid="uncensored-age-step">
        <p>{data.text}</p>
        <p>We check your age once with Didit, an age-verification provider, using a quick selfie. An ID document is asked only if the selfie is not conclusive.</p>
        <p>We keep only the result — over 18 or not — with the date. No photo or document reaches us, and we ask Didit to delete the check as soon as it is decided. <a href={legalHref('privacy')} target="_blank" rel="noopener">Privacy policy</a></p>
        {#if ageNotice}
          <Notice class="mb-0">{ageNotice}</Notice>
        {/if}
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
