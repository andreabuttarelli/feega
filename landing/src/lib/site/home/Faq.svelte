<script lang="ts">
  import { FAQ } from '../home';

  const FIRST_COLUMN = Math.ceil(FAQ.length / 2);

  const columns = [FAQ.slice(0, FIRST_COLUMN), FAQ.slice(FIRST_COLUMN)];
</script>

<section class="faq site-full" id="faq">
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
    padding: 96px 16px 161px;
    color: var(--site-ink);
  }

  h2 {
    font-size: 50px;
    line-height: 45px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .cols {
    display: grid;
    margin-top: 40px;
  }

  details {
    border-top: 1px solid rgba(240, 238, 233, 0.2);
  }

  .site-col:last-child details:last-child {
    border-bottom: 1px solid rgba(240, 238, 233, 0.2);
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
    font-variation-settings: normal;
    font-size: 20px;
    line-height: 24px;
    letter-spacing: -0.02em;
    font-weight: 500;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary span:last-child {
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  details[open] summary span:last-child {
    transform: rotate(45deg);
  }

  p {
    padding-bottom: 18px;
    color: rgba(240, 238, 233, 0.7);
    font-family: 'Inter', sans-serif;
    font-variation-settings: normal;
    font-size: 15px;
    line-height: 21px;
    letter-spacing: -0.01em;
    font-weight: 500;
  }

  p :global(a) {
    color: #0099ff;
  }

  @media (min-width: 1200px) {
    .faq {
      padding: 160px 0 160px;
    }

    h2 {
      font-size: 78px;
      line-height: 70.2px;
    }

    .cols {
      grid-template-columns: 510px 510px;
      justify-content: space-between;
      align-items: start;
      margin-top: 41px;
    }

    .site-col details:last-child {
      border-bottom: 1px solid rgba(240, 238, 233, 0.2);
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .faq {
      padding: 120px 16px 162px;
    }

    h2 {
      font-size: 62px;
      line-height: 55.8px;
    }
  }
</style>
