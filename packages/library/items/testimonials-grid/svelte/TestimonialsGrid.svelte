<section class="fl-testimonials-grid">
  <div class="fl-container head">
    <p class="fl-eyebrow">testimonials</p>
    <h2 class="fl-title">what people say</h2>
    <p class="fl-lead">Placeholder quotes. Use real words from real customers, with permission.</p>
  </div>
  <ul class="fl-container grid">
    <li><blockquote>Placeholder quote. Replace with a short, specific line from a customer.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">NS</span><span><b>Name Surname</b><small>Role, Company A</small></span></p></li>
    <li><blockquote>Placeholder. One concrete result beats three adjectives: what got faster, cheaper or simpler.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">FL</span><span><b>First Last</b><small>Role, Company B</small></span></p></li>
    <li><blockquote>Placeholder quote.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">AE</span><span><b>Alex Example</b><small>Role, Company C</small></span></p></li>
    <li><blockquote>Placeholder. Keep the customer’s own words and tone; edit only for length.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">SP</span><span><b>Sam Placeholder</b><small>Role, Company D</small></span></p></li>
    <li><blockquote>Placeholder quote about the moment it clicked.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">RS</span><span><b>Robin Sample</b><small>Role, Company E</small></span></p></li>
    <li><blockquote>Placeholder. Name the thing they used before, and why they stopped.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">KD</span><span><b>Kai Demo</b><small>Role, Company F</small></span></p></li>
  </ul>
</section>

<style>
.fl-testimonials-grid{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-testimonials-grid) *,:where(.fl-testimonials-grid) *::before,:where(.fl-testimonials-grid) *::after{box-sizing:border-box}
:where(.fl-testimonials-grid) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-testimonials-grid) a{color:inherit;text-decoration:none}
:where(.fl-testimonials-grid) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}
.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-testimonials-grid{padding-block:var(--feega-space-section)}
.fl-testimonials-grid .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}
.fl-testimonials-grid .grid{columns:3 18rem;column-gap:var(--feega-space-3);padding:0;list-style:none}
.fl-testimonials-grid li{display:grid;gap:var(--feega-space-6);margin-bottom:var(--feega-space-3);padding:var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-surface);break-inside:avoid}
.fl-testimonials-grid li:nth-child(3n+1){background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}
.fl-testimonials-grid blockquote{margin:0;font-size:1.125rem;font-weight:500;line-height:1.35;letter-spacing:-0.03em}
.fl-testimonials-grid blockquote::before{content:"“";display:block;height:0.6em;color:var(--feega-accent);font-size:2.5em;line-height:1}
.fl-testimonials-grid .who{display:flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm)}
.fl-testimonials-grid .who span:last-child{display:grid}
.fl-testimonials-grid .who b{font-weight:600}
.fl-testimonials-grid .who small{color:var(--feega-fg-muted)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
