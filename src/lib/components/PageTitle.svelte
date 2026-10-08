<script lang="ts">
  import { TitleSize } from './page-title';

  let { text, id, size = TitleSize.Mega }: { text: string; id?: string; size?: TitleSize } = $props();

  const lowercase = $derived(text.toLocaleLowerCase());
</script>

<h1 {id} class="page-heading {size}" data-page-title>{lowercase}</h1>

<style>
  .page-heading {
    margin: 0;
    font-weight: var(--ui-mega-weight);
    color: var(--ui-ink);
    overflow-wrap: anywhere;
  }

  .mega {
    font-size: var(--ui-mega);
    line-height: var(--ui-mega-leading);
    letter-spacing: var(--ui-mega-tracking);
  }

  .small {
    font-size: var(--ui-text-xl);
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
</style>
