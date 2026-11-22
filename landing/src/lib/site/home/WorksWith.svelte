<script lang="ts">
  import { lower } from '../lower';
  import { EDITORS, FRAMEWORKS, WORKS_WITH_CLOSING, WORKS_WITH_LABEL } from './works-with';

  const ROWS = [EDITORS, FRAMEWORKS];
</script>

<div class="works" data-agent-id="hero-works-with">
  <p class="label">{lower(WORKS_WITH_LABEL)}</p>

  {#each ROWS as row}
    <ul>
      {#each row as item}
        <li>
          {#if item.href}
            <a href={item.href}><span class="icon">{@html item.icon}</span>{lower(item.name)}</a>
          {:else}
            <span class="plain"><span class="icon">{@html item.icon}</span>{lower(item.name)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}

  <p class="label">{lower(WORKS_WITH_CLOSING)}</p>
</div>

<style>
  .works {
    box-sizing: border-box;
    width: 100%;
    max-width: var(--site-max);
    margin: 28px auto 0;
    text-align: left;
  }

  .label {
    margin: 0 0 12px;
    font-size: 14px;
    opacity: 0.5;
  }

  .label:last-child {
    margin: 4px 0 0;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  a,
  .plain {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--site-ink);
    font-size: 15px;
    text-decoration: none;
  }

  a:hover {
    color: var(--site-accent);
  }

  .icon {
    display: inline-flex;
    width: 20px;
    height: 20px;
  }
</style>
