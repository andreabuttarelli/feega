<template>
  <div class="fl-avatar-group">
    <div class="stack stack--sm" aria-label="6 people">
      <span class="fl-avatar">NS</span><span class="fl-avatar">FL</span><span class="fl-avatar">AE</span><span class="fl-avatar">SP</span><span class="fl-avatar more">+2</span>
    </div>
    <div class="stack stack--md" aria-label="6 people">
      <span class="fl-avatar">NS</span><span class="fl-avatar">FL</span><span class="fl-avatar">AE</span><span class="fl-avatar">SP</span><span class="fl-avatar more">+2</span>
    </div>
    <div class="stack stack--lg" aria-label="6 people">
      <span class="fl-avatar">NS</span><span class="fl-avatar">FL</span><span class="fl-avatar">AE</span><span class="fl-avatar">SP</span><span class="fl-avatar more">+2</span>
    </div>
  </div>
</template>

<style scoped>
.fl-avatar-group{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-avatar-group) *,:where(.fl-avatar-group) *::before,:where(.fl-avatar-group) *::after{box-sizing:border-box}
:where(.fl-avatar-group) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-avatar-group) a{color:inherit;text-decoration:none}
:where(.fl-avatar-group) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-avatar-group{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-8);padding:var(--feega-space-6) var(--feega-gutter)}
.fl-avatar-group .stack{display:flex}
.fl-avatar-group .fl-avatar{margin-left:-8px;box-shadow:0 0 0 2px var(--feega-bg);transition:transform var(--feega-dur) var(--feega-ease)}
.fl-avatar-group .fl-avatar:first-child{margin-left:0}
.fl-avatar-group .fl-avatar:hover{transform:translateY(-3px)}
.fl-avatar-group .fl-avatar:nth-child(1){background:var(--feega-accent-soft);color:var(--feega-accent-text)}
.fl-avatar-group .fl-avatar:nth-child(2){background:var(--feega-success-soft);color:var(--feega-success)}
.fl-avatar-group .fl-avatar:nth-child(3){background:var(--feega-fg);color:var(--feega-bg)}
.fl-avatar-group .more{background:var(--feega-raised);box-shadow:0 0 0 2px var(--feega-bg),inset 0 0 0 1px var(--feega-line-strong)}
.fl-avatar-group .stack--sm .fl-avatar{width:24px;height:24px;font-size:9px}
.fl-avatar-group .stack--lg .fl-avatar{width:44px;height:44px;margin-left:-12px;font-size:var(--feega-text-sm)}
.fl-avatar-group .stack--lg .fl-avatar:first-child{margin-left:0}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
