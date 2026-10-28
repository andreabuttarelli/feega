<script lang="ts">
  import ColorField from '$lib/components/motion/ColorField.svelte';
  import type { ControlProps } from './types';

  let { label, value, onchange }: ControlProps = $props();
</script>

<ColorField name={label} value={String(value ?? '#000000')} onchange={(next) => onchange(next)} />
