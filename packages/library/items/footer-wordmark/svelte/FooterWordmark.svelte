<footer class="fl-footer-wordmark">
  <div class="fl-container top">
    <ul>
      <li><a href="#">product</a></li>
      <li><a href="#">pricing</a></li>
      <li><a href="#">docs</a></li>
      <li><a href="#">blog</a></li>
    </ul>
    <ul>
      <li><a href="#">GitHub</a></li>
      <li><a href="#">X</a></li>
      <li><a href="#">LinkedIn</a></li>
    </ul>
    <p>hi@example.com</p>
  </div>
  <p class="mark" aria-hidden="true">yourbrand</p>
  <div class="fl-container legal"><span>© 2026 Yourbrand</span><span><a href="#">privacy</a> · <a href="#">terms</a></span></div>
</footer>

<style>
.fl-footer-wordmark{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-footer-wordmark) *,:where(.fl-footer-wordmark) *::before,:where(.fl-footer-wordmark) *::after{box-sizing:border-box}
:where(.fl-footer-wordmark) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-footer-wordmark) a{color:inherit;text-decoration:none}
:where(.fl-footer-wordmark) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-footer-wordmark{container-type:inline-size;overflow:hidden;padding-top:var(--feega-space-16);background:var(--feega-fg);color:var(--feega-bg)}
.fl-footer-wordmark .top{display:grid;align-items:start;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-8);font-weight:500}
.fl-footer-wordmark ul{display:grid;gap:var(--feega-space-2);margin:0;padding:0;list-style:none}
.fl-footer-wordmark a{transition:color var(--feega-dur-fast) var(--feega-ease)}
.fl-footer-wordmark a:hover{color:var(--feega-accent)}
.fl-footer-wordmark .top p{justify-self:end}
.fl-footer-wordmark .mark{margin-top:var(--feega-space-12);font-size:21.5cqi;font-weight:600;line-height:1;letter-spacing:-0.075em;text-align:center;white-space:nowrap}
.fl-footer-wordmark .legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--feega-space-2);padding-block:var(--feega-space-6);color:var(--feega-fg-subtle);font-size:var(--feega-text-sm)}
@media (max-width:640px){.fl-footer-wordmark .top{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-footer-wordmark .top p{grid-column:1/-1;justify-self:start}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
