<script lang="ts">
  let { label, checked, testid, onchange }: { label: string; checked: boolean; testid: string; onchange: (checked: boolean) => void } = $props();
</script>

<label class="flex h-7 items-center gap-2 text-ui-label">
  <input type="checkbox" {checked} data-testid={testid} onchange={(e) => onchange(e.currentTarget.checked)} />
  {label}
</label>
