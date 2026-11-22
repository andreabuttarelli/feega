<template>
  <div class="fl-progress-skeleton">
    <div class="bars">
      <label>Uploading <span>64%</span><progress max="100" value="64">64%</progress></label>
      <label>Storage used <span>8.2 of 10 GB</span><progress class="warn" max="100" value="82">82%</progress></label>
      <p class="spin" role="status"><i aria-hidden="true"></i>Building preview…</p>
    </div>
    <div class="skel" aria-busy="true" aria-label="Loading">
      <span class="b img"></span>
      <span class="b line w70"></span>
      <span class="b line"></span>
      <span class="b line w40"></span>
    </div>
  </div>
</template>

<style scoped>
.fl-progress-skeleton{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-progress-skeleton) *,:where(.fl-progress-skeleton) *::before,:where(.fl-progress-skeleton) *::after{box-sizing:border-box}
:where(.fl-progress-skeleton) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-progress-skeleton) a{color:inherit;text-decoration:none}
:where(.fl-progress-skeleton) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-progress-skeleton{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:var(--feega-space-8);padding:var(--feega-space-8) var(--feega-gutter)}
.fl-progress-skeleton .bars{display:grid;gap:var(--feega-space-6)}
.fl-progress-skeleton label{display:grid;grid-template-columns:1fr auto;gap:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}
.fl-progress-skeleton label span{color:var(--feega-fg-muted);font-variant-numeric:tabular-nums}
.fl-progress-skeleton progress{grid-column:1/-1;width:100%;height:8px;border:0;border-radius:var(--feega-radius-full);background:var(--feega-surface);overflow:hidden;appearance:none}
.fl-progress-skeleton progress::-webkit-progress-bar{background:var(--feega-surface)}
.fl-progress-skeleton progress::-webkit-progress-value{border-radius:var(--feega-radius-full);background:var(--feega-accent);transition:width var(--feega-dur) var(--feega-ease)}
.fl-progress-skeleton progress::-moz-progress-bar{border-radius:var(--feega-radius-full);background:var(--feega-accent)}
.fl-progress-skeleton .warn::-webkit-progress-value{background:var(--feega-danger)}
.fl-progress-skeleton .warn::-moz-progress-bar{background:var(--feega-danger)}
.fl-progress-skeleton .spin{display:inline-flex;align-items:center;gap:var(--feega-space-3);color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}
.fl-progress-skeleton .spin i{width:16px;height:16px;border:2px solid var(--feega-line-strong);border-top-color:var(--feega-accent);border-radius:var(--feega-radius-full);animation:fl-progress-skeleton-spin 800ms linear infinite}
@keyframes fl-progress-skeleton-spin{to{transform:rotate(360deg)}}
.fl-progress-skeleton .skel{display:grid;gap:var(--feega-space-3);padding:var(--feega-space-4);border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}
.fl-progress-skeleton .b{display:block;height:12px;border-radius:var(--feega-radius-xs);background:linear-gradient(90deg,var(--feega-surface) 30%,var(--feega-line) 50%,var(--feega-surface) 70%) 0 0/300% 100%;animation:fl-progress-skeleton-shine 1.4s var(--feega-ease) infinite}
@keyframes fl-progress-skeleton-shine{from{background-position:100% 0}to{background-position:0 0}}
.fl-progress-skeleton .img{height:auto;aspect-ratio:16/9;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md)}
.fl-progress-skeleton .w70{width:70%}
.fl-progress-skeleton .w40{width:40%}
@media (max-width:640px){.fl-progress-skeleton{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
