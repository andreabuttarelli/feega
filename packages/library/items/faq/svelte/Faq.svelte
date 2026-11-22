<section class="fl-faq">
  <div class="fl-container inner">
    <h2 class="fl-title">Questions</h2>
    <div class="list">
      <details open><summary>First question?</summary><p>A short, direct answer to the first question.</p></details>
      <details><summary>Second question?</summary><p>A short, direct answer to the second question.</p></details>
      <details><summary>Third question?</summary><p>A short, direct answer to the third question.</p></details>
      <details><summary>Fourth question?</summary><p>A short, direct answer to the fourth question.</p></details>
    </div>
  </div>
</section>

<style>
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-title{margin:0;font-size:clamp(1.75rem,4.5vw,2.5rem);font-weight:600;letter-spacing:-0.04em;line-height:1.1;text-wrap:balance}
.fl-lead{margin:0;color:var(--feega-fg-muted);font-size:1.125rem;text-wrap:pretty}
.fl-faq{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-faq *,.fl-faq *::before,.fl-faq *::after{box-sizing:border-box}
.fl-faq a{color:inherit}
.fl-faq :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-faq{padding-block:var(--feega-space-section)}
.fl-faq .inner{display:grid;gap:var(--feega-space-8);max-width:48rem}
.fl-faq details{border-bottom:1px solid var(--feega-line)}
.fl-faq summary{display:flex;justify-content:space-between;align-items:center;gap:var(--feega-space-4);padding:var(--feega-space-4) 0;font-weight:500;cursor:pointer;list-style:none}
.fl-faq summary::-webkit-details-marker{display:none}
.fl-faq summary::after{content:"";flex:none;width:0.5rem;height:0.5rem;border-right:2px solid var(--feega-fg-muted);border-bottom:2px solid var(--feega-fg-muted);transform:rotate(45deg)}
.fl-faq details[open] summary::after{transform:rotate(-135deg)}
.fl-faq details p{margin:0 0 var(--feega-space-4);color:var(--feega-fg-muted)}
</style>
