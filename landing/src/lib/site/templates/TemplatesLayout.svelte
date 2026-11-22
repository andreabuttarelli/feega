<script lang="ts">
  import type { Snippet } from 'svelte';
  import '$lib/site/landing/landing.css';
  import '$lib/site/alternatives/alternatives.css';
  import '$lib/site/catalog/catalog.css';
  import './templates.css';

  let { children }: { children: Snippet } = $props();
</script>

<div class="catalog tpl-catalog">
  <div class="main">
    <article class="landing compare tpl">
      {@render children()}
    </article>
  </div>
</div>
