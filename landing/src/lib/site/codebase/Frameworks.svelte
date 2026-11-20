<script lang="ts">
  import { TESTED } from '.';
  import { lower } from '../lower';
  import { LOGO_PATHS } from './logos';
</script>

<div class="frameworks">
  <ul class="tested" aria-label="Frameworks tested on real apps">
    {#each TESTED as framework (framework.name)}
      <li>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={LOGO_PATHS[framework.logo]} /></svg>
        {framework.name}
      </li>
    {/each}
  </ul>
</div>

<style>
  .frameworks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px 40px;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tested {
    gap: 12px 24px;
    color: #fff;
  }

  .tested li {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
  }

  .tested svg {
    width: 20px;
    height: 20px;
  }





  svg {
    flex: none;
    fill: currentColor;
  }
</style>
