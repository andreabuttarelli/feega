import { cameraMath, type StageSpec } from '../camera';
import { sampleTrack } from '../keyframes';
import { js, px } from './html';
import { hotScope, hotSeek } from './hot';

export const STAGE_TIMELINE = 'feegaStage';

export const STAGE_CSS = '.world{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50% 0}.world>.layer,.world>.matte-src>.layer{backface-visibility:visible}';

export function cameraRuntime(): string {
  return `const CAMERA_MATH=(${cameraMath.toString()})((${sampleTrack.toString()}));`;
}

export function stageScript(spec: StageSpec, fps: number, duration: number): string {
  return `(function(){${hotScope(STAGE_TIMELINE)}${cameraRuntime()}
const SPEC=${js(spec)};
const root=document.getElementById('root');
const world=document.getElementById('world');
const SVG='http://www.w3.org/2000/svg';
const lit=SPEC.layers.map(function(l,i){
  if(!l.lit){return null;}
  const svg=document.createElementNS(SVG,'svg');
  svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';
  const filter=document.createElementNS(SVG,'filter');
  filter.setAttribute('id','feegaLit'+i);filter.setAttribute('color-interpolation-filters','sRGB');
  const matrix=document.createElementNS(SVG,'feColorMatrix');
  matrix.setAttribute('type','matrix');
  filter.appendChild(matrix);svg.appendChild(filter);document.body.appendChild(svg);
  return matrix;
});
const layers=SPEC.layers.map(function(l){return document.querySelector('.layer[data-clip="'+l.id+'"]');});
function stageAt(time){
  const state=CAMERA_MATH.frameAt(SPEC,time*${fps});
  root.style.perspective=state.perspective+'px';
  world.style.transform=CAMERA_MATH.matrixCss(state.world);
  state.layers.forEach(function(l,i){
    const el=layers[i];
    if(!el){return;}
    el.style.transform=l.transform;
    const parts=[];
    if(l.blur){parts.push('blur('+l.blur+'px)');}
    if(l.light&&lit[i]){
      lit[i].setAttribute('values',l.light[0]+' 0 0 0 0 0 '+l.light[1]+' 0 0 0 0 0 '+l.light[2]+' 0 0 0 0 0 1 0');
      parts.push('url(#feegaLit'+i+')');
    }
    el.style.filter=parts.join(' ');
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(STAGE_TIMELINE, duration, 'stageAt')}
${hotSeek('stageAt')}
stageAt(0);
})();`;
}

export function seekDriver(name: string, duration: number | string, render: string): string {
  return `if(tl){tl.to({},{id:${js(name)},duration:${duration},ease:'none',onUpdate:function(){${render}(this.time());}},0);}`;
}

export function stageRootStyle(spec: StageSpec): string {
  return `#root{perspective:${px(spec.rest)}}`;
}
