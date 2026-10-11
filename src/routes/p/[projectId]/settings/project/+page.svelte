<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Select } from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { legalHref } from '$lib/legal-links';
  import { ProjectMode } from '$lib/project-mode';
  import { UNCENSORED_NOTICE, UncensoredLock } from '$lib/uncensored-lock';

  let { data, form } = $props();

  const AGE_NOTICE: Readonly<Record<string, string>> = {
    failed: 'We could not confirm you are 18 or over. You can try again.',
    pending: 'Your check is being reviewed. Come back in a few minutes.'
  };
  const ageNotice = $derived(AGE_NOTICE[page.url.searchParams.get('age') ?? ''] ?? null);
  const inUncensored = $derived(data.project.mode === ProjectMode.Uncensored);

  let confirmName = $state('');
  const canDelete = $derived(confirmName === data.project.name);
  const createHref = $derived(
    `/p/${data.project.id}/brands/new?returnTo=${encodeURIComponent(page.url.pathname)}`
  );
</script>

{#if form?.renamed}<Notice tone="success">Renamed.</Notice>{/if}
{#if form?.error}<Notice tone="error">{form.error}</Notice>{/if}

<Panel title="Name">
  <form method="POST" action="?/rename" use:enhance class="flex gap-2">
    <Input name="name" type="text" value={data.project.name} required aria-label="Project name" class="h-9" />
    <Button variant="secondary" type="submit">Rename</Button>
  </form>
</Panel>

<Panel
  title="Brand"
  description={data.linkedBrand
    ? `Linked to ${data.linkedBrand.name}. Posts, calendar and connected accounts use this brand.`
    : 'No brand linked. The canvas works without one; link a brand when you are ready to publish.'}
>
  {#if data.orgBrands.length}
    <form method="POST" action="?/linkBrand" use:enhance class="flex gap-2">
      <Select name="brandId" required aria-label="Brand">
        <option value="" disabled selected={!data.linkedBrand}>Choose a brand</option>
        {#each data.orgBrands as b (b.id)}
          <option value={b.id} selected={b.id === data.linkedBrand?.id}>{b.name}</option>
        {/each}
      </Select>
      <Button type="submit">{data.linkedBrand ? 'Switch brand' : 'Link brand'}</Button>
    </form>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <Button variant="secondary" href={createHref}>Create brand</Button>
    {#if data.linkedBrand}
      <form method="POST" action="?/unlinkBrand" use:enhance>
        <Button variant="ghost" type="submit">Unlink brand</Button>
      </form>
    {/if}
  </div>
</Panel>

<Panel
  title="Test app account"
  description="To show your app, the chat asks for a TEST login (url, email, password) and logs in to photograph its screens. The AI sees these credentials: never give a real account."
>
  {#if data.appAccount}
    <div class="flex flex-wrap items-center gap-2 text-sm" data-testid="app-account">
      <span>{data.appAccount.email} on {data.appAccount.loginUrl}</span>
      <form method="POST" action="?/forgetAppAccount" use:enhance>
        <Button variant="ghost" type="submit" data-testid="app-account-forget">Forget account</Button>
      </form>
    </div>
  {:else}
    <p class="text-sm">{form?.forgotten ? 'Forgotten.' : 'None saved.'}</p>
  {/if}
</Panel>

{#if data.uncensored.visible || inUncensored}
  <Panel title="Uncensored mode" description="Models without built-in content filters, for adults (18+). Outputs stay in this project: never shared, published, scheduled or promoted.">
    <div class="flex flex-col gap-3 text-sm" data-testid="uncensored-switch">
      <p>Status: <strong>{inUncensored ? 'On' : 'Off'}</strong>{#if inUncensored}&nbsp;<span class="uncensored-badge" title={UNCENSORED_NOTICE}>Uncensored</span>{/if}</p>
      <p>{UNCENSORED_NOTICE}</p>

      {#if form?.switched}<Notice tone="success">Saved.</Notice>{/if}

      {#if inUncensored}
        <form method="POST" action="?/setMode" use:enhance>
          <input type="hidden" name="mode" value={ProjectMode.Standard} />
          <Button variant="secondary" type="submit" data-testid="uncensored-off">Turn off uncensored mode</Button>
        </form>
      {:else if data.uncensored.lock === UncensoredLock.AgeUnverified}
        <form method="POST" action="?/verifyAge" use:enhance class="flex flex-col gap-2" data-testid="uncensored-age-step">
          <p>{data.uncensored.text}</p>
          <p>We check your age once with Didit, an age-verification provider, using a quick selfie. An ID document is asked only if the selfie is not conclusive.</p>
          <p>We keep only the result — over 18 or not — with the date. No photo or document reaches us, and we ask Didit to delete the check as soon as it is decided. <a href={legalHref('privacy')} target="_blank" rel="noopener">Privacy policy</a></p>
          <p>{UNCENSORED_NOTICE}</p>
          {#if ageNotice}<Notice class="mb-0">{ageNotice}</Notice>{/if}
          <div><Button type="submit" data-testid="uncensored-verify">Verify my age</Button></div>
        </form>
      {:else if data.uncensored.lock === UncensoredLock.Open}
        <form method="POST" action="?/setMode" use:enhance class="flex flex-col gap-2">
          <input type="hidden" name="mode" value={ProjectMode.Uncensored} />
          <label class="flex items-start gap-2">
            <input type="checkbox" name="acknowledge" required data-testid="uncensored-acknowledge" />
            I understand: {UNCENSORED_NOTICE}
          </label>
          <div><Button type="submit" data-testid="uncensored-on">Turn on uncensored mode</Button></div>
        </form>
      {:else}
        <Notice class="mb-0">{data.uncensored.text}</Notice>
      {/if}
    </div>
  </Panel>
{/if}

<Panel title="Delete project" description="The project and its canvases disappear from your workspace. Brands and posts stay.">
  <form method="POST" action="?/delete" class="flex flex-col items-start gap-3">
    <Field label={`Type ${data.project.name} to confirm`} for="confirm-project-name" class="w-full">
      <Input id="confirm-project-name" name="confirmName" type="text" bind:value={confirmName} autocomplete="off" class="h-9" />
    </Field>
    <Button variant="danger" type="submit" disabled={!canDelete}>Delete project</Button>
  </form>
</Panel>

<style>
  .uncensored-badge {
    border: 1px solid var(--color-destructive);
    color: var(--color-destructive);
    padding: 0 0.375rem;
    font-size: 0.75rem;
  }
</style>
