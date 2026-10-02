<script lang="ts">
  import type { ReportField } from '$lib/reports/reasons';

  let {
    fields,
    values = {},
    errors = {}
  }: { fields: readonly ReportField[]; values?: Record<string, string>; errors?: Record<string, string> } = $props();
</script>

{#each fields as field (field.name)}
  <div class="field" class:invalid={errors[field.name]}>
    {#if field.kind === 'statement'}
      <label class="statement">
        <input type="checkbox" name={field.name} required={field.required} checked={values[field.name] === 'on'} />
        <span>{field.label}</span>
      </label>
    {:else}
      <label for={`f-${field.name}`}>{field.label}</label>
      {#if field.kind === 'textarea'}
        <textarea id={`f-${field.name}`} name={field.name} required={field.required} rows="4">{values[field.name] ?? ''}</textarea>
      {:else if field.kind === 'select'}
        <select id={`f-${field.name}`} name={field.name} required={field.required} value={values[field.name] ?? ''}>
          <option value="" disabled>Choose…</option>
          {#each field.options ?? [] as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      {:else}
        <input
          id={`f-${field.name}`}
          name={field.name}
          type={field.kind === 'url' ? 'url' : field.kind === 'email' ? 'email' : 'text'}
          required={field.required}
          value={values[field.name] ?? ''}
        />
      {/if}
    {/if}
    {#if errors[field.name]}
      <p class="error">{errors[field.name]}</p>
    {/if}
  </div>
{/each}

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  label {
    font-size: 13px;
    font-weight: 600;
  }
  input:not([type='checkbox']),
  textarea,
  select {
    width: 100%;
    padding: 10px;
    font: inherit;
    font-size: 14px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
  }
  .statement {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-weight: 400;
    line-height: 1.45;
  }
  .statement input {
    margin-top: 3px;
  }
  .invalid input,
  .invalid textarea,
  .invalid select {
    border-color: var(--danger, #d70015);
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--danger, #d70015);
  }
</style>
