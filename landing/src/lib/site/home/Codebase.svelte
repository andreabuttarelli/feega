<script lang="ts">
  import { CODEBASE_PATH } from '../codebase';
  import Steps from '../codebase/Steps.svelte';
  import Frameworks from '../codebase/Frameworks.svelte';
</script>

<section class="codebase site-wide" id="codebase" aria-labelledby="codebase-title">
  <p class="eyebrow">Code → Design → Code</p>
  <h2 id="codebase-title">Design in your codebase</h2>
  <p class="lead">Bring the app you already have. Feega runs it, turns it into boards you can edit, and sends your changes back to the repo.</p>

  <div class="steps">
    <Steps />
  </div>

  <div class="frameworks">
    <Frameworks />
  </div>

  <a class="more" href={CODEBASE_PATH}><span>How it works, in detail</span> →</a>
</section>

<style>
  .codebase {
    padding: 120px 20px 0;
    color: var(--site-ink);
  }

  .eyebrow {
    color: #ff5100;
  }

  h2 {
    margin-top: 16px;
    font-size: 30px;
    line-height: 32px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .lead {
    max-width: 520px;
    margin-top: 16px;
    opacity: 0.8;
  }

  .steps {
    margin-top: 48px;
  }

  .frameworks {
    margin-top: 64px;
  }

  .more {
    display: inline-block;
    margin-top: 40px;
  }

  .more span {
    border-bottom: 1px solid var(--site-ink);
  }

  @media (min-width: 810px) {
    .codebase {
      padding: 160px 0 0;
    }

    h2 {
      font-size: 38px;
      line-height: 40px;
    }

    .steps {
      margin-top: 56px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 46px;
      line-height: 46px;
    }
  }
</style>
