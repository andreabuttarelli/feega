import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

export enum Fixture {
  Today = 'tempo-today.png',
  Streaks = 'tempo-streaks.png',
  Stats = 'tempo-stats.png',
  Reference = 'reference.png'
}

export enum Loop {
  Asked = 'asked',
  No = 'no'
}

export type Brief = { name: string; text: string; files: Fixture[]; loop: Loop };

export const BRIEFS: Brief[] = [
  { name: 'saas-launch', text: 'Make a 20-second launch teaser video for Linear (linear.app). 16:9, 1920x1080.', files: [], loop: Loop.No },
  { name: 'quote', text: 'Kinetic typography video of this quote: "Simplicity is the ultimate sophistication." — Leonardo da Vinci. Square 1080x1080, about 10 seconds.', files: [], loop: Loop.No },
  { name: 'app-showcase', text: 'Feature showcase video for our habit-tracking app Tempo, vertical 1080x1920, about 20 seconds. The three attached screenshots are the real app: today view, streaks, stats.', files: [Fixture.Today, Fixture.Streaks, Fixture.Stats], loop: Loop.No },
  { name: 'social-promo', text: 'A 15-second vertical (1080x1920) Instagram promo for Nordbrew, our coffee brand, launching its Autumn Blend. Brand colours: #1F2A24 dark green, #E8DCC8 cream, #C8742C amber.', files: [], loop: Loop.No },
  { name: 'abstract-loop', text: 'An 8-second generative abstract animation inspired by the attached reference image. Square 1080x1080, it must loop seamlessly.', files: [Fixture.Reference], loop: Loop.Asked }
];

export const PLAIN_SUFFIX = 'Deliver the final video as out.mp4 (1080x1920 or as the brief says) in this folder.';

export const briefText = (b: Brief) => (b.files.length ? `${b.text}\nAttached: ${b.files.join(', ')}.` : b.text);

const SCREEN = (title: string, body: string) => `<!doctype html><html><body style="margin:0;width:390px;height:844px;background:#0E0F12;color:#F2F2F2;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="padding:56px 22px 0"><div style="font-size:13px;color:#8A8F98;letter-spacing:.04em">TEMPO</div><div style="font-size:32px;font-weight:600;letter-spacing:-.03em;margin-top:6px">${title}</div>${body}</div>
<div style="position:absolute;bottom:0;left:0;right:0;height:78px;border-top:1px solid #23252B;display:flex;justify-content:space-around;align-items:center;color:#8A8F98;font-size:12px"><span style="color:#7CE0A3">Today</span><span>Streaks</span><span>Stats</span><span>You</span></div></body></html>`;

const habit = (name: string, done: boolean, meta: string) =>
  `<div style="display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #1D1F24"><div style="width:26px;height:26px;border-radius:50%;${done ? 'background:#7CE0A3' : 'border:2px solid #3A3D45'}"></div><div style="flex:1"><div style="font-size:17px">${name}</div><div style="font-size:13px;color:#8A8F98">${meta}</div></div></div>`;

const bar = (h: number, d: string) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:30px;height:${h}px;background:#7CE0A3"></div><span style="font-size:11px;color:#8A8F98">${d}</span></div>`;

const HTML: Record<Exclude<Fixture, Fixture.Reference>, string> = {
  [Fixture.Today]: SCREEN('Tuesday', `<div style="margin:18px 0 8px;font-size:14px;color:#8A8F98">4 of 6 done</div><div style="height:6px;background:#23252B"><div style="width:66%;height:6px;background:#7CE0A3"></div></div>${habit('Morning run', true, '5 km · 7:10')}${habit('Read 20 pages', true, 'Atomic Habits')}${habit('No sugar', true, 'Day 12')}${habit('Meditate', true, '10 min')}${habit('Journal', false, 'Evening')}${habit('Spanish', false, '15 min')}`),
  [Fixture.Streaks]: SCREEN('Streaks', `<div style="margin-top:28px;text-align:center"><div style="font-size:96px;font-weight:600;letter-spacing:-.05em;color:#7CE0A3">47</div><div style="color:#8A8F98">days of morning runs</div></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:30px">${Array.from({ length: 35 }, (_, i) => `<div style="aspect-ratio:1;background:${i % 9 === 4 ? '#23252B' : '#7CE0A3'};opacity:${0.35 + ((i * 7) % 10) / 15}"></div>`).join('')}</div>`),
  [Fixture.Stats]: SCREEN('This week', `<div style="display:flex;gap:28px;margin-top:22px"><div><div style="font-size:34px;font-weight:600">86%</div><div style="font-size:13px;color:#8A8F98">completion</div></div><div><div style="font-size:34px;font-weight:600">+12%</div><div style="font-size:13px;color:#8A8F98">vs last week</div></div></div><div style="display:flex;align-items:flex-end;justify-content:space-between;height:220px;margin-top:36px">${[120, 160, 140, 190, 170, 80, 200].map((h, i) => bar(h, 'MTWTFSS'[i])).join('')}</div>`)
};

export async function makeFixtures(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const ref = join(dir, Fixture.Reference);
  if (!existsSync(ref)) {
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'mandelbrot=size=1080x1080:start_scale=0.4:outer=normalized_iteration_count', '-vf', 'hue=h=200:s=1.4', '-frames:v', '1', ref]);
  }
  const missing = Object.keys(HTML).filter((f) => !existsSync(join(dir, f))) as Array<keyof typeof HTML>;
  if (!missing.length) {
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  for (const f of missing) {
    await page.setContent(HTML[f]);
    await page.screenshot({ path: join(dir, f) });
  }
  await browser.close();
}
