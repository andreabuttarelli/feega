<script lang="ts">
  let { text, id }: { text: string; id?: string } = $props();

  const lowercase = $derived(text.toLocaleLowerCase());
</script>

<h1 {id} class="mega-title" data-page-title>{lowercase}</h1>

<style>
  .mega-title {
    margin: 0;
    font-size: var(--ui-mega);
    font-weight: var(--ui-mega-weight);
    line-height: var(--ui-mega-leading);
    letter-spacing: var(--ui-mega-tracking);
    color: var(--ui-ink);
    overflow-wrap: anywhere;
  }
</style>
