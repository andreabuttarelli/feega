import { LOADER_FILE, EMBED_TAG } from '../../../src/lib/motion/interactive/loader';
import { HERO_ID } from './interactive-hero';

export const LUMEN_PATH = '/__lumen';

const FEATURES = [
  { title: 'Design tokens, in code', body: 'Colours, type and spacing arrive as a typed theme. Change a token in Figma and every component follows on the next sync.' },
  { title: 'Components you would write', body: 'Auto layout becomes flexbox, variants become props. No absolute positioning, no div soup, no cleanup pass.' },
  { title: 'Reviewed like any pull request', body: 'Every sync opens a branch with a readable diff. Your team merges design changes the way it merges everything else.' }
];

const LOGOS = ['Northwind', 'Fieldnote', 'Brightside', 'Parcel&Co', 'Halcyon'];

const card = (f: (typeof FEATURES)[number]) => `<article><h3>${f.title}</h3><p>${f.body}</p></article>`;

export const lumenPage = (origin: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumen: Figma to production React</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:auto}
body{margin:0;background:#0a0f1f;color:#f4f5ff;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif}
nav{position:fixed;inset:0 0 auto 0;height:64px;z-index:50;display:flex;align-items:center;gap:32px;padding:0 48px;background:linear-gradient(#0a0f1f,#0a0f1f00)}
nav b{font-size:20px;letter-spacing:-.02em}nav b span{color:#8b6cff}nav a{color:#aeb7d6;text-decoration:none;font-size:15px}nav .sp{flex:1}nav .cta{color:#fff;background:#2a3566;padding:8px 16px;border-radius:8px}
section.rest{max-width:1120px;margin:0 auto;padding:120px 48px}
h2{font-size:40px;letter-spacing:-.03em;margin:0 0 48px;line-height:1.1}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
article{background:#121a38;border:1px solid #232e5e;border-radius:16px;padding:28px}article h3{margin:0 0 10px;font-size:20px}article p{margin:0;color:#aeb7d6}
.logos{display:flex;gap:56px;justify-content:center;color:#5d6a9c;font-weight:600;font-size:20px;padding:56px 0 0}
footer{padding:48px;text-align:center;color:#5d6a9c;border-top:1px solid #1a2348}
</style>
<script src="${origin}/${LOADER_FILE}" async></script></head>
<body>
<nav><b>lumen<span>.</span></b><a href="#">Product</a><a href="#">Pricing</a><a href="#">Docs</a><a href="#">Changelog</a><span class="sp"></span><a href="#">Sign in</a><a class="cta" href="#">Get started</a></nav>
<${EMBED_TAG} src="${HERO_ID}" style="display:block;height:100vh"></${EMBED_TAG}>
<section class="rest"><h2>From frame to pull request,<br>without the handoff.</h2><div class="grid">${FEATURES.map(card).join('')}</div>
<div class="logos">${LOGOS.map((l) => `<span>${l}</span>`).join('')}</div></section>
<footer>© 2026 Lumen Labs. Built for teams who ship.</footer>
</body></html>`;
