<script lang="ts">
  import { lower } from '../lower';
  import { itemHref, shotPath } from './paths';
  import { Theme, Tier, type Framework, type Template } from './template';

  let { template, theme, framework }: { template: Template; theme: Theme; framework?: Framework } = $props();
</script>

<a class="tpl-card" href={itemHref(template.id, framework)}>
  <span class="shot-box">
    <img src={shotPath(template.id, theme)} alt="{template.name} template preview, {theme} theme" width="640" height="400" loading="lazy" decoding="async" />
    {#if template.tier === Tier.Pro}<span class="badge">pro</span>{/if}
  </span>
  <strong>{lower(template.name)}</strong>
  <span class="desc">{template.description}</span>
</a>
