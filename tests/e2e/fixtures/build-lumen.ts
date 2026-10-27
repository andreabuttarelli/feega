import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlayMode } from '@feega/motion-core/motion/interactive/settings';
import { heroSource } from './interactive-hero';
import { lumenPage } from './lumen-page';

const [dir, origin, bundlePath = new URL('../../../src/lib/motion/interactive/bundle.ts', import.meta.url).pathname] = process.argv.slice(2);

const bundle = await import(bundlePath);
const stored: string = await bundle.embedSource(heroSource((process.env.HERO_PLAYBACK as PlayMode | undefined) ?? PlayMode.Autoplay));

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'hero.html'), bundle.hostedPage(stored, origin));
writeFileSync(join(dir, 'hero.json'), JSON.stringify(bundle.embedSettings(stored)));
writeFileSync(join(dir, 'page.html'), lumenPage(origin));
