<script lang="ts">
  import { FIELD_INPUT, Field, Section } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { bindVariable, bindableTargets, typeOfVariable, unbindVariable, variableEntries } from '$lib/motion/variables';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void } = $props();

  const NONE = '';

  const entries = $derived(variableEntries(doc));
  const bound = $derived(Object.entries(clip.bind ?? {}));
  let key = $state(NONE);
  let target = $state(NONE);

  const type = $derived(key === NONE ? undefined : typeOfVariable(doc, key));
  const targets = $derived(type ? bindableTargets(clip, type).filter((t) => !clip.bind?.[t]) : []);

  function pickVariable(value: string) {
    key = value;
    target = NONE;
  }

  function bind() {
    if (key === NONE || target === NONE) {
      return;
    }
    commit(bindVariable(doc, clip.id, target, key), `Bound ${target} to ${key}`);
    target = NONE;
  }
</script>

{#if entries.length || bound.length}
  <Section title="Variables">
    {#each bound as [prop, name] (prop)}
      <div class="flex items-center justify-between gap-2" data-testid="variable-binding" data-target={prop}>
        <span class="truncate" title={prop}>{prop}</span>
        <span class="truncate text-[var(--ui-text-tertiary)]" data-testid="variable-binding-key">{name}</span>
        <button type="button" class={cn(FIELD_INPUT)} aria-label={`Unbind ${prop}`} data-testid={`variable-unbind-${prop}`} onclick={() => commit(unbindVariable(doc, clip.id, prop), `Unbound ${prop}`)}>Unbind</button>
      </div>
    {/each}
    {#if entries.length}
      <Field label="Variable" id="clip-variable">
        <select id="clip-variable" class={cn(FIELD_INPUT, 'w-full')} data-testid="variable-pick" value={key} onchange={(e) => pickVariable(e.currentTarget.value)}>
          <option value={NONE}>Choose a variable</option>
          {#each entries as e (e.key)}<option value={e.key}>{e.key} · {e.type}</option>{/each}
        </select>
      </Field>
      {#if type}
        <Field label="Bind to" id="clip-variable-target">
          <select id="clip-variable-target" class={cn(FIELD_INPUT, 'w-full')} data-testid="variable-target" value={target} onchange={(e) => (target = e.currentTarget.value)}>
            <option value={NONE}>{targets.length ? 'Choose a field' : `No ${type} field is free`}</option>
            {#each targets as t (t)}<option value={t}>{t}</option>{/each}
          </select>
        </Field>
        <button type="button" class={cn(FIELD_INPUT, 'w-full')} disabled={target === NONE} data-testid="variable-bind" onclick={bind}>Bind</button>
      {/if}
    {/if}
  </Section>
{/if}
