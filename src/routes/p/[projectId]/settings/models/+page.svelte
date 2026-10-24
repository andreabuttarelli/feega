<script lang="ts">
  import { enhance } from '$lib/settings/enhance';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();

  const MEDIA = ['image', 'video', 'model3d'] as const;
</script>

{#if form?.allowlistError}<Notice tone="error">{$_(`app.settings.models.${form.allowlistError === 'forbidden' ? 'adminOnly' : 'unavailable'}`)}</Notice>{/if}
{#if form?.allowlistSaved}<Notice tone="success">{$_('app.settings.models.saved')}</Notice>{/if}

<Panel title={$_('app.settings.models.title')} description={$_('app.settings.models.subtitle')}>
  {#if !data.canEdit}
    <p class="m-0 text-[0.8125rem] text-muted-foreground">{$_('app.settings.models.adminOnly')}</p>
  {/if}

  {#each MEDIA as medium (medium)}
    <form method="POST" action="?/saveAllowlist" use:enhance data-testid={`allowlist-${medium}`}>
      <input type="hidden" name="medium" value={medium} />
      <h3 class="m-0 mt-4 text-[0.875rem] font-medium">{$_(`app.settings.models.${medium}`)}</h3>
      <div class="flex flex-col gap-1 py-2">
        {#each data.models[medium] as model (model.id)}
          <label class="flex items-center gap-2 text-[0.8125rem]">
            <input type="checkbox" name="model_ids" value={model.id} checked={data.allowed[medium].includes(model.id)} disabled={!data.canEdit} />
            {model.label}
          </label>
        {/each}
      </div>
      {#if data.canEdit}
        <Button size="sm" type="submit">{$_('app.settings.models.save')}</Button>
      {/if}
    </form>
  {/each}
</Panel>
