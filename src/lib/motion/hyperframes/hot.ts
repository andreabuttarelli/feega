import { ENGINE_GLOBAL } from '../engine/engine';

export const HOT_PATCH = 'feega:hot';
export const HOT_DONE = 'feega:hot-done';
export const HOT_OPEN = '<!--hot-->';
export const HOT_CLOSE = '<!--/hot-->';
export const HOT_SCRIPT = '<script data-hot>';

export type HotPatch = { type: typeof HOT_PATCH; root: string; scripts: string[] };

const ROOT = /<!--hot-->([\s\S]*?)<!--\/hot-->/;
const SCRIPTS = /<script data-hot>([\s\S]*?)<\/script>/g;
const STAMP = /"stamp":"[^"]*"/g;

type Parts = { shell: string; root: string; scripts: string[] };

function partsOf(html: string): Parts | null {
  const root = ROOT.exec(html)?.[1];
  if (root === undefined) {
    return null;
  }
  const scripts = [...html.matchAll(SCRIPTS)].map((m) => m[1]);
  const shell = html.replace(ROOT, HOT_OPEN + HOT_CLOSE).replace(SCRIPTS, HOT_SCRIPT).replace(STAMP, '');
  return { shell, root, scripts };
}

export function hotPatch(current: string, next: string): HotPatch | null {
  const before = partsOf(current);
  const after = partsOf(next);
  if (!before || !after || before.shell !== after.shell || current === next) {
    return null;
  }
  return { type: HOT_PATCH, root: after.root, scripts: after.scripts };
}

export function hotRuntime(): string {
  return `<script>window.addEventListener('message',function(e){var m=e.data;if(e.source!==window.parent||!m||m.type!==${JSON.stringify(HOT_PATCH)}){return;}
var tl=window.__timelines&&window.__timelines.main;var root=document.getElementById('root');if(!tl||!root){return;}
var engine=window.${ENGINE_GLOBAL};var fresh=engine.timeline;var at=tl.time();
engine.timeline=function(){engine.timeline=fresh;tl.clear();return tl;};
try{root.innerHTML=m.root;m.scripts.forEach(function(s){var el=document.createElement('script');el.textContent='{'+s+'}';document.body.appendChild(el);el.remove();});}finally{engine.timeline=fresh;}
Promise.resolve(typeof FIT_TEXT==='function'?FIT_TEXT():null).then(function(){tl.seek(at);window.parent.postMessage({type:${JSON.stringify(HOT_DONE)}},'*');});
});</script>`;
}
