import { js } from './html';

export const EXACT_SEEK = 'feega:seek';

export type ExactSeek = { type: typeof EXACT_SEEK; time: number };

export const exactSeek = (time: number): ExactSeek => ({ type: EXACT_SEEK, time });

export function exactSeekScript(): string {
  return `<script>addEventListener('message',function(e){var m=e.data;if(!m||m.type!==${js(EXACT_SEEK)}||typeof m.time!=='number'){return;}var p=window.__player;if(p&&p.renderSeek){p.renderSeek(m.time,{exact:true});}});</script>`;
}
