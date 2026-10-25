import type { MotionClip } from '../doc';
import { sampleTrack } from '../keyframes';
import { formatCounter, type Counter } from '../text-counter';
import { js } from './html';
import { hotScope, hotSeek } from './hot';
import { seekDriver } from './stage';

export type CounterBake = { id: string; from: number; counter: Counter };

const COUNTER_TIMELINE = 'feegaCounters';
const FRAME_EPSILON = 1e-6;

export const counterBake = (clip: MotionClip): CounterBake | null => {
  const counter = clip.props.counter as Counter | undefined;
  return clip.component === 'Text' && counter ? { id: clip.id, from: clip.from, counter } : null;
};

export function counterScript(bakes: readonly CounterBake[], fps: number, duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(COUNTER_TIMELINE)}const B=${js(bakes)};const SAMPLE=(${sampleTrack.toString()});const FORMAT=(${formatCounter.toString()});
function countersAt(time){
  B.forEach(function(b){
    const host=document.querySelector('#tx-'+b.id+' > span');
    if(!host){return;}
    const c=b.counter;
    const p=Math.min(Math.max((Math.floor(time*${fps}+${FRAME_EPSILON})-b.from-c.start)/c.duration,0),1);
    const eased=SAMPLE([{frame:0,value:0,ease:c.ease},{frame:1,value:1,ease:'linear'}],p);
    const text=FORMAT(c.from+(c.to-c.from)*eased,c.format,c.decimals);
    if(host.textContent!==text){host.textContent=text;}
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(COUNTER_TIMELINE, duration, 'countersAt')}
${hotSeek('countersAt')}
countersAt(0);
})();</script>`;
}
