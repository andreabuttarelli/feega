<script lang="ts">
  import { enhance } from '$app/forms';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Field, FieldLayout } from '$lib/components/ui/field';
  import { Select } from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();

  // Length rungs come from the server, filtered to the active model's maxDuration — Seedance 2.5
  // unlocks 20s/30s; Grok stays at 10/13/15. Never a hardcoded global ceiling.
  const LENGTHS = $derived(data.durationOptions?.length ? data.durationOptions : [10, 13, 15]);
  // Unset = Auto (AI / script chooses per clip). Do not pretend 13s is selected when unset.
  const storedDuration = $derived(
    typeof data.brand?.content_prefs?.videoDuration === 'number'
      ? Number(data.brand.content_prefs.videoDuration)
      : null
  );
  const current = $derived(storedDuration);

  const SLOTS = $derived(data.modelSlots ?? []);

  // 720p costs exactly double per second and every draft is billed, shipped or not — so 480p is
  // the recommendation, not merely the default.
  const RESOLUTIONS = ['480p', '720p'];
  const DEFAULT_RESOLUTION = '480p';
  const currentRes = $derived(String(data.brand?.content_prefs?.videoResolution ?? DEFAULT_RESOLUTION));

  // Mirrors VIDEO_INSTRUCTIONS_MAX in studio-actions.ts — the server truncates regardless, this is
  // just so the box tells the user before they lose the tail of what they typed.
  const MAX = 600;
  let instructions = $state('');
  $effect(() => {
    instructions = String(data.brand?.content_prefs?.videoInstructions ?? '');
  });
</script>

{#if form?.saved}<Notice tone="success">{$_('app.settings.video.saved')}</Notice>{/if}
{#if form?.error}<Notice tone="error">{form.error}</Notice>{/if}

<Panel title={$_('app.settings.video.title')}>
  {#each SLOTS as slot (slot.id)}
    <Field label={$_(`app.settings.video.slots.${slot.i18n}`)} hint={$_(`app.settings.video.slots.${slot.i18n}Desc`)} layout={FieldLayout.Row}>
      {#if !slot.choices.length && !slot.synced}
        <span class="vd-warn">{$_('app.settings.video.catalogueNotSynced')}</span>
      {:else}
        <form method="POST" action="?/updateMediaModel" use:enhance class="vd-form">
          <input type="hidden" name="slot" value={slot.id} />
          <Select name="model" class="w-56">
            <option value="" selected={!slot.current}>{$_('app.settings.video.modelDefault')}</option>
            {#each slot.choices as m (m.id)}
              <option value={m.id} selected={m.id === slot.current}>{m.label}</option>
            {/each}
          </Select>
          <Button variant="secondary" type="submit">{$_('app.settings.save')}</Button>
        </form>
      {/if}
    </Field>
  {/each}
  <Field label={$_('app.settings.video.clipLength')} hint={$_('app.settings.video.clipLengthDesc')} layout={FieldLayout.Row}>
    <form method="POST" action="?/updateVideoDuration" use:enhance class="vd-form">
      <Select name="videoDuration" class="w-40">
        <option value="" selected={current == null}>{$_('app.settings.video.clipLengthAuto')}</option>
        {#each LENGTHS as s (s)}
          <option value={s} selected={current === s}>{s}s</option>
        {/each}
      </Select>
      <Button variant="secondary" type="submit">{$_('app.settings.save')}</Button>
    </form>
  </Field>
  <Field label={$_('app.settings.video.resolution')} hint={$_('app.settings.video.resolutionDesc')} layout={FieldLayout.Row}>
    <form method="POST" action="?/updateVideoResolution" use:enhance class="vd-form">
      <Select name="videoResolution" class="w-40">
        {#each RESOLUTIONS as r (r)}
          <option value={r} selected={r === currentRes}>
            {r}{r === DEFAULT_RESOLUTION ? ` · ${$_('app.settings.video.recommended')}` : ''}
          </option>
        {/each}
      </Select>
      <Button variant="secondary" type="submit">{$_('app.settings.save')}</Button>
    </form>
  </Field>
  <Field label={$_('app.settings.video.instructions')} hint={$_('app.settings.video.instructionsDesc')}>
    <form method="POST" action="?/updateVideoInstructions" use:enhance class="vi-form">
      <Textarea
        name="videoInstructions"
        rows={4}
        maxlength={MAX}
        bind:value={instructions}
        placeholder={$_('app.settings.video.instructionsPlaceholder')}
      />
      <div class="vi-foot">
        <span class="text-[0.8125rem] text-muted-foreground">{instructions.length}/{MAX}</span>
        <Button variant="secondary" type="submit">{$_('app.settings.save')}</Button>
      </div>
    </form>
  </Field>
</Panel>

<style>
  .vd-form { display: flex; align-items: center; gap: 8px; }
  .vi-form { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .vi-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .vd-warn { color: var(--sh-destructive); font-size: 13px; }
</style>
