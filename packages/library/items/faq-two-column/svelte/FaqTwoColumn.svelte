<section class="fl-faq-two-column">
  <div class="fl-container head">
    <p class="fl-eyebrow">faq</p>
    <h2 class="fl-title">questions, answered</h2>
  </div>
  <dl class="fl-container grid">
    <div><dt>Is there a free plan?</dt><dd>Yes. The starter plan is free forever and has every core feature.</dd></div>
    <div><dt>Can I cancel anytime?</dt><dd>Yes. Cancel from settings; you keep access until the period ends.</dd></div>
    <div><dt>Where is my data stored?</dt><dd>In the region you pick at signup. Placeholder: say which.</dd></div>
    <div><dt>Do you offer discounts?</dt><dd>Education and non-profit teams get 50% off. Write to us.</dd></div>
    <div><dt>Does it work with my framework?</dt><dd>Svelte, React, Vue and Astro today. Placeholder list.</dd></div>
    <div><dt>How do I get help?</dt><dd>Docs first, then chat. A person replies within a day.</dd></div>
  </dl>
</section>

<style>
.fl-faq-two-column{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-faq-two-column) *,:where(.fl-faq-two-column) *::before,:where(.fl-faq-two-column) *::after{box-sizing:border-box}
:where(.fl-faq-two-column) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-faq-two-column) a{color:inherit;text-decoration:none}
:where(.fl-faq-two-column) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}
.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
.fl-faq-two-column{padding-block:var(--feega-space-section)}
.fl-faq-two-column .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}
.fl-faq-two-column .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--feega-space-8) var(--feega-space-16)}
.fl-faq-two-column .grid > div{display:grid;gap:var(--feega-space-2);padding-top:var(--feega-space-6);border-top:1px solid var(--feega-line)}
.fl-faq-two-column dt{font-size:1.125rem;font-weight:500;letter-spacing:-0.03em}
.fl-faq-two-column dd{margin:0;color:var(--feega-fg-muted)}
@media (max-width:720px){.fl-faq-two-column .grid{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
