<script lang="ts">
  import { FAQ } from '../home';

  const FIRST_COLUMN = 7;

  const columns = [FAQ.slice(0, FIRST_COLUMN), FAQ.slice(FIRST_COLUMN)];
</script>

<section class="faq" id="faq">
  <h2>FAQ</h2>

  <div class="cols">
    {#each columns as items, i (i)}
      <div class="site-col">
        {#each items as item (item.q)}
          <details>
            <summary><span>{item.q}</span><span aria-hidden="true">+</span></summary>
            <p>{@html item.a}</p>
          </details>
        {/each}
      </div>
    {/each}
  </div>
</section>

<style>
  .faq {
    margin: 0 auto;
    padding: 0 20px 121px;
  }

  h2 {
    font-size: 50px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .cols {
    display: grid;
    margin-top: 40px;
  }

  .site-col + .site-col details:first-child {
    border-top: 0;
  }

  details {
    border-bottom: 1px solid rgba(240, 238, 233, 0.2);
  }

  details:first-child {
    border-top: 1px solid rgba(240, 238, 233, 0.2);
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 18px 0;
    list-style: none;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 20px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-variation-settings: normal;
    font-weight: 500;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  details[open] summary span:last-child {
    transform: rotate(45deg);
  }

  p {
    padding-bottom: 18px;
    opacity: 0.7;
  }

  p :global(a) {
    color: #0099ff;
  }

  @media (min-width: 1200px) {
    .faq {
      max-width: 1500px;
      padding: 0 20px 120px;
    }

    h2 {
      font-size: 78px;
    }

    .cols {
      grid-template-columns: 1fr 1fr;
      column-gap: 40px;
      align-items: start;
    }

    .site-col + .site-col details:first-child {
      border-top: 1px solid rgba(240, 238, 233, 0.2);
    }
  }
</style>
