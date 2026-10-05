import { ENGINE_GLOBAL } from '../engine/engine';

export const HOT_PATCH = 'feega:hot';
export const HOT_DONE = 'feega:hot-done';
export const HOT_OPEN = '<!--hot-->';
export const HOT_CLOSE = '<!--/hot-->';
export const HOT_SCRIPT = '<script data-hot>';
export const HOT_MODULE = '<script type="module" data-hot>';
export const HOT_GLOBAL = '__feegaHot';
export const ON_DISPOSE = 'onHotDispose';
export const GL_GLOBAL = '__feegaGl';
const MODULE_RAN = 'feega:hot-module';
const MODULE_TIMEOUT_MS = 3000;

export type HotPatch = { type: typeof HOT_PATCH; root: string; scripts: string[]; modules: string[] };

const ROOT = /<!--hot-->([\s\S]*?)<!--\/hot-->/;
const SCRIPTS = /<script data-hot>([\s\S]*?)<\/script>/g;
const MODULES = /<script type="module" data-hot>([\s\S]*?)<\/script>/g;
const STAMP = /"stamp":"[^"]*"/g;

type Parts = { shell: string; root: string; scripts: string[]; modules: string[] };

function partsOf(html: string): Parts | null {
  const root = ROOT.exec(html)?.[1];
  if (root === undefined) {
    return null;
  }
  const scripts = [...html.matchAll(SCRIPTS)].map((m) => m[1]);
  const modules = [...html.matchAll(MODULES)].map((m) => m[1]);
  const shell = html.replace(ROOT, HOT_OPEN + HOT_CLOSE).replace(SCRIPTS, HOT_SCRIPT).replace(MODULES, HOT_MODULE).replace(STAMP, '');
  return { shell, root, scripts, modules };
}

export function hotPatch(current: string, next: string): HotPatch | null {
  const before = partsOf(current);
  const after = partsOf(next);
  if (!before || !after || before.shell !== after.shell || current === next) {
    return null;
  }
  return { type: HOT_PATCH, root: after.root, scripts: after.scripts, modules: after.modules };
}

export function hotScope(key: string): string {
  return `const ${ON_DISPOSE}=(function(k){var h=window.${HOT_GLOBAL}=window.${HOT_GLOBAL}||{};if(h[k]){h[k]();}var fns=[];h[k]=function(){fns.splice(0).forEach(function(f){f();});};return function(f){fns.push(f);};})(${JSON.stringify(key)});`;
}

export function hotSeek(render: string): string {
  return `(function(l){window.addEventListener('hf-seek',l);${ON_DISPOSE}(function(){window.removeEventListener('hf-seek',l);});})(function(e){${render}(e.detail.time);});`;
}

export function keptGl(): string {
  return `const SIZE_ATTRS = ['width', 'height'];
function copyAttrs(from, to) {
  for (const a of [...to.attributes]) if (!SIZE_ATTRS.includes(a.name)) to.removeAttribute(a.name);
  for (const a of [...from.attributes]) if (!SIZE_ATTRS.includes(a.name)) to.setAttribute(a.name, a.value);
}
function keptRenderer(id, make) {
  const kept = (window.${GL_GLOBAL} = window.${GL_GLOBAL} || {});
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const old = kept[id];
  if (old && old.canvas.width === canvas.width && old.canvas.height === canvas.height) {
    copyAttrs(canvas, old.canvas);
    canvas.replaceWith(old.canvas);
    old.renderer.setRenderTarget(null);
    return old.renderer;
  }
  if (old) dropRenderer(kept, id);
  const renderer = make(canvas);
  kept[id] = { canvas, renderer };
  return renderer;
}
function dropRenderer(kept, id) {
  kept[id].renderer.dispose();
  kept[id].renderer.forceContextLoss();
  delete kept[id];
}
function dropUnused(prefix, used) {
  const kept = window.${GL_GLOBAL} || {};
  Object.keys(kept).filter((id) => id.startsWith(prefix) && !used.includes(id)).forEach((id) => dropRenderer(kept, id));
}
function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const materials = o.material ? [].concat(o.material) : [];
    materials.forEach((m) => {
      Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
      Object.values(m.uniforms || {}).forEach((u) => u.value && u.value.isTexture && u.value.dispose());
      m.dispose();
    });
  });
  if (scene.environment) scene.environment.dispose();
}`;
}

export function hotRuntime(): string {
  return `<script>window.addEventListener('message',function(e){var m=e.data;if(e.source!==window.parent||!m||m.type!==${JSON.stringify(HOT_PATCH)}){return;}
var tl=window.__timelines&&window.__timelines.main;var root=document.getElementById('root');if(!tl||!root){return;}
var engine=window.${ENGINE_GLOBAL};var fresh=engine.timeline;var at=tl.time();
engine.timeline=function(){engine.timeline=fresh;tl.clear();return tl;};
try{root.innerHTML=m.root;m.scripts.forEach(function(s){var el=document.createElement('script');el.textContent='{'+s+'}';document.body.appendChild(el);el.remove();});}finally{engine.timeline=fresh;}
var modules=m.modules.reduce(function(prev,s){return prev.then(function(){return new Promise(function(done){var el=document.createElement('script');var finish=function(){window.removeEventListener(${JSON.stringify(MODULE_RAN)},finish);clearTimeout(late);el.remove();done();};var late=setTimeout(finish,${MODULE_TIMEOUT_MS});window.addEventListener(${JSON.stringify(MODULE_RAN)},finish,{once:true});el.type='module';el.textContent=s+';window.dispatchEvent(new Event('+${JSON.stringify(JSON.stringify(MODULE_RAN))}+'));';document.body.appendChild(el);});});},Promise.resolve());
Promise.all([typeof FIT_TEXT==='function'?FIT_TEXT():null,modules]).then(function(){tl.seek(at);window.parent.postMessage({type:${JSON.stringify(HOT_DONE)}},'*');});
});</script>`;
}
