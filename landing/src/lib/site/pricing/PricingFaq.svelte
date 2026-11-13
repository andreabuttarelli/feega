<script lang="ts">
  import { pricingFaq, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();
</script>

<div class="faq">
  <h3>Questions</h3>
  <div class="list">
    {#each pricingFaq(plan) as item (item.q)}
      <details>
        <summary><span>{item.q}</span><span aria-hidden="true">+</span></summary>
        <p>{item.a}</p>
      </details>
    {/each}
  </div>
</div>

<style>
  .faq {
    display: grid;
    gap: 24px;
    margin-top: 96px;
  }

  h3 {
    margin: 0;
    font-size: 28px;
    line-height: 1.1;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  details {
    border-top: 1px solid rgba(240, 238, 233, 0.2);
  }

  details:last-child {
    border-bottom: 1px solid rgba(240, 238, 233, 0.2);
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 56px;
    list-style: none;
    cursor: pointer;
    font-size: 18px;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 2px;
  }

  details[open] summary span:last-child {
    transform: rotate(45deg);
  }

  details p {
    margin: 0;
    padding-bottom: 20px;
    max-width: 640px;
    opacity: 0.7;
  }

  @media (min-width: 810px) {
    .faq {
      grid-template-columns: 1fr 2fr;
      gap: 32px;
    }
  }
</style>
