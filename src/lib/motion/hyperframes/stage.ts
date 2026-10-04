import { cameraMath, type StageSpec } from '../camera';
import { sampleTrack } from '../keyframes';
import { js, px } from './html';

export const STAGE_TIMELINE = 'feegaStage';

export const STAGE_CSS = '.world{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50% 0}.world>.layer,.world>.matte-src>.layer{backface-visibility:visible}';

export function cameraRuntime(): string {
  return `const CAMERA_MATH=(${cameraMath.toString()})((${sampleTrack.toString()}));`;
}

export function stageScript(spec: StageSpec, fps: number, duration: number): string {
  return `(function(){${cameraRuntime()}
const SPEC=${js(spec)};
const root=document.getElementById('root');
const world=document.getElementById('world');
const layers=SPEC.layers.map(function(l){return document.querySelector('.layer[data-clip="'+l.id+'"]');});
function stageAt(time){
  const state=CAMERA_MATH.frameAt(SPEC,time*${fps});
  root.style.perspective=state.perspective+'px';
  world.style.transform=CAMERA_MATH.matrixCss(state.world);
  state.layers.forEach(function(l,i){
    const el=layers[i];
    if(!el){return;}
    el.style.transform=l.transform;
    el.style.filter=l.blur?'blur('+l.blur+'px)':'';
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(STAGE_TIMELINE, duration, 'stageAt')}
window.addEventListener('hf-seek',function(e){stageAt(e.detail.time);});
stageAt(0);
})();`;
}

export function seekDriver(name: string, duration: number | string, render: string): string {
  return `if(tl){tl.to({},{id:${js(name)},duration:${duration},ease:'none',onUpdate:function(){${render}(this.time());}},0);}`;
}

export function stageRootStyle(spec: StageSpec): string {
  return `#root{perspective:${px(spec.rest)}}`;
}
