<script lang="ts">
  import '$lib/styles/tailwind.css';
  import AppShell from '$lib/components/app/AppShell.svelte';

  let { data, children } = $props();
</script>

<AppShell {data}>
  {@render children()}
</AppShell>
