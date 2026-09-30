<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { page } from '$app/state';
  import { openSheet } from '$lib/canvas/sheet-nav';
  import { Panel } from '$lib/components/ui/panel';
  import { Field, FieldLayout } from '$lib/components/ui/field';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();
  const SHEET_PATH = '/settings/content';
  let failure = $state<string | null>(null);
  const error = $derived(failure ?? (form as { error?: string } | null)?.error ?? null);

  const refresh: SubmitFunction = () => async ({ result, update }) => {
    failure = result.type === 'failure' ? String((result.data as { error?: string } | undefined)?.error ?? 'failed') : null;
    if (page.state.sheet) {
      await openSheet(page.params.projectId ?? '', SHEET_PATH, 'replace');
      return;
    }
    await update();
  };
  const access = $derived(data.access);
  const REASON_TEXT: Record<string, string> = {
    enabled: 'On',
    not_opted_in: 'Off',
    plan_not_entitled: 'Needs a paid plan'
  };
</script>

<Panel title="Uncensored models">
  <div class="flex flex-col gap-3 text-sm">
    <p>
      Uncensored mode — models without built-in content filters, for adults (18+). Our safety rules still apply. They are off by default. When on, every
      request is still screened: sexual content involving minors, and sexual content depicting real, identifiable
      people, is always refused. Outputs are marked, never shown on public share links, and never published without
      your confirmation — and never on platforms that forbid it.
    </p>
    <p data-testid="uncensored-status">Status: <strong>{REASON_TEXT[access.reason]}</strong>
      {#if access.optIn}· turned on {new Date(access.optIn.enabledAt).toLocaleString()}{/if}
    </p>

    {#if error}<Notice class="mb-0">{error}</Notice>{/if}

    {#if access.allowed}
      <form method="POST" action="?/disable" use:enhance={refresh}>
        <Button variant="secondary" type="submit">Turn off uncensored models</Button>
      </form>
    {:else if access.entitled}
      <form method="POST" action="?/enable" use:enhance={refresh} class="flex flex-col gap-2">
        <label class="flex items-start gap-2">
          <input type="checkbox" name="attestAdult" required />
          I confirm I am 18 or older and the owner of this workspace.
        </label>
        <label class="flex items-start gap-2">
          <input type="checkbox" name="acceptPolicy" required />
          I accept the uncensored mode policy (version {data.policyVersion}): no minors, no real people, no non-consensual
          content, and I am responsible for where outputs are used.
        </label>
        <div><Button type="submit">Allow uncensored models</Button></div>
      </form>
    {:else}
      <Notice class="mb-0">Uncensored models are available on paid plans.</Notice>
    {/if}
  </div>
</Panel>

{#if data.personas.length}
  <Panel title="Adult AI personas">
    <p class="text-sm">
      Uncensored models accept an influencer only when it was generated here, is 18 or older, and you mark it as a
      consenting adult AI persona. Catalogue talents and influencers built from photos are always refused.
    </p>
    {#each data.personas as persona (persona.id)}
      <Field label={persona.name} hint={persona.age ? `${persona.age} years` : 'Age not declared'} layout={FieldLayout.Row}>
        <form method="POST" action="?/persona" use:enhance={refresh}>
          <input type="hidden" name="influencerId" value={persona.id} />
          <input type="hidden" name="mark" value={persona.adult_persona_at ? 'off' : 'on'} />
          <Button variant="secondary" size="sm" type="submit">
            {persona.adult_persona_at ? 'Unmark' : 'Mark as adult AI persona'}
          </Button>
        </form>
      </Field>
    {/each}
  </Panel>
{/if}
