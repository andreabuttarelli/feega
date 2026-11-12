<script lang="ts">
  import { STEPS } from '.';
</script>

<ol class="steps">
  {#each STEPS as step, i (i)}
    <li>
      <p class="label"><span>0{i + 1}</span> {step.label}</p>
      <h3>{step.title}</h3>
      <p class="text">{step.text}</p>
    </li>
  {/each}
</ol>

<style>
  .steps {
    display: grid;
    gap: 32px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    padding-top: 16px;
    border-top: 1px solid var(--site-line);
  }

  p,
  h3 {
    margin: 0;
  }

  .label {
    color: #ff5100;
    font-family: 'Fragment Mono', monospace;
    font-variation-settings: normal;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .label span {
    opacity: 0.6;
  }

  h3 {
    margin-top: 24px;
    font-size: 20px;
    line-height: 24px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .text {
    margin-top: 8px;
    opacity: 0.7;
  }

  @media (min-width: 810px) {
    .steps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
    }
  }

  @media (min-width: 1200px) {
    h3 {
      font-size: 24px;
      line-height: 28.8px;
    }
  }
</style>
