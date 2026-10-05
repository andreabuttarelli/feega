import type { Step } from './farm-render';
import { THREE_REDRAW } from '$lib/motion/hyperframes/three';

export const STRIP_FPS = 60;

export type StripTiming = { start: number; duration: number; mediaStart: number; rate: number };
export type Strip = StripTiming & { url: string };

const VIDEO_TAG = /<video\b[^>]*><\/video>/g;
const TIMING_ATTR = /\sdata-(start|duration|media-start|playback-rate)="/g;
const STRIP_DIR = 'strips';

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
const unescape = (url: string) => url.replace(/&amp;/g, '&').replace(/&quot;/g, '"');

export function stripFrame(strip: StripTiming, time: number, fps: number): number | null {
  const EPSILON = 1e-6;
  const local = time - strip.start;
  if (local < -EPSILON || local > strip.duration + EPSILON) {
    return null;
  }
  return Math.floor(Math.max(0, local) * strip.rate * fps + EPSILON) + 1;
}

function stripOf(tag: string): Strip {
  const number = (name: string, fallback: number) => Number(attr(tag, name) ?? fallback);
  return { url: unescape(attr(tag, 'src') ?? ''), start: number('data-start', 0), duration: number('data-duration', 0), mediaStart: number('data-media-start', 0), rate: number('data-playback-rate', 1) };
}

const RUNTIME = `<script>(function(){
var stripFrame=(${stripFrame.toString()});
window.addEventListener('hf-seek',function(e){
  var t=e.detail.time,waits=[];
  document.querySelectorAll('span[data-strip]').forEach(function(v){
    var img=v.nextElementSibling;
    if(!img||!img.classList.contains('__render_frame__')){img=document.createElement('img');img.className='__render_frame__';img.setAttribute('style',v.dataset.stripStyle||'');v.after(img);}
    var d=v.dataset,n=stripFrame({start:+d.stripStart,duration:+d.stripDuration,mediaStart:+d.stripMediaStart,rate:+(d.stripPlaybackRate||1)},t,${STRIP_FPS});
    if(n===null){img.style.visibility='hidden';return;}
    img.style.visibility='';
    var src='${STRIP_DIR}/'+d.strip+'/'+n+'.jpg';
    if(img.getAttribute('src')!==src){img.setAttribute('src',src);waits.push(img.decode().catch(function(){}));}
  });
  if(waits.length&&e.detail.waitUntil)e.detail.waitUntil(Promise.all(waits).then(function(){if(window.${THREE_REDRAW})window.${THREE_REDRAW}(t);}));
});
})();</script>`;

export function stripVideos(html: string): { html: string; strips: Strip[] } {
  const strips: Strip[] = [];
  const stripped = html.replace(VIDEO_TAG, (tag) => {
    const index = strips.push(stripOf(tag)) - 1;
    const open = tag.replace(/<\/video>$/, '').replace(/\ssrc="[^"]*"/, '').replace(/\sstyle="/, ' data-strip-style="').replace(TIMING_ATTR, (_m, name: string) => ` data-strip-${name}="`);
    return `${open.replace(/^<video/, `<span data-strip="${index}"`).replace(/>$/, ' style="display:none">')}</span>`;
  });
  if (!strips.length) {
    return { html, strips };
  }
  return { html: stripped.includes('</body>') ? stripped.replace('</body>', `${RUNTIME}</body>`) : stripped + RUNTIME, strips };
}

export function stripSteps(projectDir: string, strips: Strip[]): Step[] {
  return strips.flatMap((s, k) => {
    const dir = `${projectDir}/${STRIP_DIR}/${k}`;
    return [
      { what: `video ${k + 1} folder`, cmd: 'mkdir', args: ['-p', dir] },
      { what: `video ${k + 1} frames`, cmd: 'ffmpeg', args: ['-v', 'error', '-ss', String(s.mediaStart), '-t', String(s.duration * s.rate), '-i', s.url, '-vf', `fps=${STRIP_FPS},scale='min(1920,iw)':-2`, '-q:v', '3', `${dir}/%d.jpg`] }
    ];
  });
}
