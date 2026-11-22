<template>
  <footer class="fl-footer-newsletter">
    <div class="fl-container grid">
      <form class="news" action="#">
        <a class="brand" href="#" aria-label="Yourbrand home"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
        <label class="fl-field" for="fl-footer-email">get the monthly update
          <span class="row"><input class="fl-input" id="fl-footer-email" type="email" placeholder="you@example.com" autocomplete="email" required /><button class="fl-btn fl-btn--primary" type="submit">subscribe</button></span>
        </label>
        <small>One email a month. Unsubscribe in one click.</small>
      </form>
      <nav class="cols" aria-label="Footer">
        <div><p>product</p><ul><li><a href="#">features</a></li><li><a href="#">pricing</a></li><li><a href="#">changelog</a></li></ul></div>
        <div><p>company</p><ul><li><a href="#">about</a></li><li><a href="#">careers</a></li><li><a href="#">contact</a></li></ul></div>
        <div><p>resources</p><ul><li><a href="#">docs</a></li><li><a href="#">guides</a></li><li><a href="#">status</a></li></ul></div>
      </nav>
    </div>
    <div class="fl-container legal"><span>© 2026 Yourbrand</span><span><a href="#">privacy</a><a href="#">terms</a><a href="#">cookies</a></span></div>
  </footer>
</template>

<style scoped>
.fl-footer-newsletter{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-footer-newsletter) *,:where(.fl-footer-newsletter) *::before,:where(.fl-footer-newsletter) *::after{box-sizing:border-box}
:where(.fl-footer-newsletter) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-footer-newsletter) a{color:inherit;text-decoration:none}
:where(.fl-footer-newsletter) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:44px;padding:0 var(--feega-space-6);border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg);font:inherit;font-size:0.9375rem;font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),border-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur-fast) var(--feega-ease)}
.fl-btn:hover{border-color:var(--feega-fg-subtle);background:var(--feega-surface)}
.fl-btn:active{transform:scale(0.97)}
.fl-btn--primary{border-color:var(--feega-accent);background:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{border-color:var(--feega-accent-hover);background:var(--feega-accent-hover)}
.fl-btn--ink{border-color:var(--feega-fg);background:var(--feega-fg);color:var(--feega-bg)}
.fl-btn--ink:hover{border-color:var(--feega-fg-muted);background:var(--feega-fg-muted)}
.fl-btn--ghost{border-color:transparent}
.fl-btn--sm{min-height:36px;padding:0 var(--feega-space-4);font-size:var(--feega-text-sm)}
.fl-btn .fl-px{width:10px;transition:transform var(--feega-dur) var(--feega-ease)}
.fl-btn:hover .fl-px{transform:translateX(3px)}
.fl-btn[disabled]{opacity:0.45;cursor:not-allowed}
.fl-field{display:grid;gap:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}
.fl-input{width:100%;min-height:44px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-md);background:var(--feega-input);color:var(--feega-fg);font:inherit;font-size:var(--feega-text-body);font-weight:400;letter-spacing:var(--feega-tracking);transition:border-color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur-fast) var(--feega-ease)}
.fl-input::placeholder{color:var(--feega-fg-subtle)}
.fl-input:hover{border-color:var(--feega-line-strong)}
.fl-input:focus{outline:none;border-color:var(--feega-accent);box-shadow:0 0 0 4px var(--feega-accent-soft)}
.fl-footer-newsletter{padding-top:var(--feega-space-16);border-top:1px solid var(--feega-line)}
.fl-footer-newsletter .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:var(--feega-space-16)}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:1.125rem;font-weight:600;letter-spacing:-0.04em}
.brand .fl-px{width:16px;color:var(--feega-accent)}
.fl-footer-newsletter .news{display:grid;align-content:start;justify-items:start;gap:var(--feega-space-6);max-width:26rem}
.fl-footer-newsletter .fl-field{width:100%}
.fl-footer-newsletter .row{display:flex;gap:var(--feega-space-2)}
.fl-footer-newsletter .row .fl-input{flex:1;min-width:0;border-radius:var(--feega-radius-full)}
.fl-footer-newsletter small{color:var(--feega-fg-subtle);font-size:var(--feega-text-xs)}
.fl-footer-newsletter .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-6)}
.fl-footer-newsletter .cols p{margin-bottom:var(--feega-space-3);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle);text-transform:uppercase}
.fl-footer-newsletter ul{display:grid;gap:var(--feega-space-2);margin:0;padding:0;list-style:none;font-weight:500}
.fl-footer-newsletter a:hover{color:var(--feega-accent-text)}
.fl-footer-newsletter .legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--feega-space-3);margin-top:var(--feega-space-16);padding-block:var(--feega-space-6);border-top:1px solid var(--feega-line);color:var(--feega-fg-subtle);font-size:var(--feega-text-sm)}
.fl-footer-newsletter .legal span:last-child{display:flex;gap:var(--feega-space-4)}
@media (max-width:820px){.fl-footer-newsletter .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}}
@media (max-width:420px){.fl-footer-newsletter .row{flex-direction:column}.fl-footer-newsletter .cols{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
