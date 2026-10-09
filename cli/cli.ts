#!/usr/bin/env bun
import { Command } from 'commander';
import { loadEnv, assertEnv } from './lib/config.ts';

await loadEnv();

const program = new Command();

// Validate required env vars before any command runs (not before --help).
program.hook('preAction', () => assertEnv());

program
  .name('feega')
  .description('CLI per gestire feega — social media AI autopilot')
  .version('0.1.0')
  .addHelpText('after', `
Esempi:
  $ feega brands                   Lista tutti i brand
  $ feega dashboard my-brand       Dashboard completa

Documentazione completa: cli/README.md
`);

program
  .command('login')
  .description('Accedi a feega (default: apre il browser)')
  .option('--email <email>', 'email per login non interattivo (richiede --password o --password-stdin)')
  .option('--password <password>', 'password per login non interattivo (richiede --email)')
  .option('--password-stdin', 'legge la password da stdin, fuori da history e process list')
  .action(async (options) => {
    const { cmdLogin } = await import('./commands/login.ts');
    await cmdLogin(options);
  });

program
  .command('logout')
  .description('Disconnettiti da feega')
  .action(async () => {
    const { cmdLogout } = await import('./commands/logout.ts');
    await cmdLogout();
  });

program
  .command('brands')
  .description('Elenca tutti i brand con status e autopilot')
  .action(async () => {
    const { cmdBrands } = await import('./commands/brands.ts');
    await cmdBrands();
  });

program
  .command('status <slug>')
  .description('Status dettagliato di un brand (post pending, quota, ultimi run)')
  .action(async (slug: string) => {
    const { cmdStatus } = await import('./commands/status.ts');
    await cmdStatus(slug);
  });

program
  .command('health')
  .description('Verifica lo stato delle API (Supabase, Gemini, Zernio)')
  .action(async () => {
    const { cmdHealth } = await import('./commands/health.ts');
    await cmdHealth();
  });

program
  .command('dashboard <slug>')
  .description('Dashboard completa di un brand: stats, pipeline, stato autopilot')
  .action(async (slug: string) => {
    const { cmdDashboard } = await import('./commands/dashboard.ts');
    await cmdDashboard(slug);
  });

program
  .command('products <slug> [action]')
  .description('Prodotti: list (elenca), sync (reimporta dal sito e-commerce)')
  .action(async (slug: string, action: string | undefined) => {
    const { cmdProducts } = await import('./commands/products.ts');
    await cmdProducts(slug, { action: action ?? 'list' });
  });

program
  .command('ads <slug>')
  .description('Meta ad campaigns of a brand: list, approve spend')
  .option('--approve <id>', 'Approve and launch a proposed campaign (spends budget)')
  .option('--pause <id>', 'Pause a running campaign')
  .option('--resume <id>', 'Resume a paused campaign')
  .action(async (slug: string, opts) => {
    const { cmdAds } = await import('./commands/ads.ts');
    await cmdAds(slug, opts);
  });

program
  .command('media')
  .description('Signed links to the media of canvas nodes, generation runs or assets')
  .option('--node <ids>', 'Comma-separated node ids')
  .option('--run <ids>', 'Comma-separated run ids')
  .option('--asset <ids>', 'Comma-separated asset ids')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (opts) => {
    const { cmdMedia } = await import('./commands/media.ts');
    await cmdMedia(opts);
  });

const motion = program.command('motion').description('Motion videos: list, ask the editor agent to change one, render, publish as a web embed');

motion
  .command('ask <nodeId> <prompt>')
  .description('Ask the motion editor agent to edit a video (spends credits)')
  .option('--no-wait', 'Return the run id without waiting for the turn to end')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (nodeId: string, prompt: string, opts) => {
    const { cmdMotionAsk } = await import('./commands/motion.ts');
    await cmdMotionAsk(nodeId, prompt, opts);
  });

motion
  .command('run <runId>')
  .description('State of a motion agent run')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (runId: string, opts) => {
    const { cmdMotionRun } = await import('./commands/motion.ts');
    await cmdMotionRun(runId, opts);
  });

motion
  .command('render <nodeId>')
  .description('Render a video: a free link that renders in your browser')
  .option('--server', 'Render on our servers (not available yet)')
  .option('--resolution <r>', '720p, 1080p, 1440p or 2160p')
  .option('--format <f>', 'With --server: mp4-h264, mp4-h265, prores-422hq, prores-4444, webm-alpha, png-sequence, gif')
  .option('--quality <q>', 'standard or high')
  .option('--fps <n>', '24, 25, 30, 50 or 60')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (nodeId: string, opts) => {
    const { cmdMotionRender } = await import('./commands/motion.ts');
    await cmdMotionRender(nodeId, opts);
  });

motion
  .command('list')
  .description('List motion videos, to find a node id')
  .option('--project <id>', 'Only the videos of one project')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (opts) => {
    const { cmdMotionList } = await import('./commands/motion.ts');
    await cmdMotionList(opts);
  });

motion
  .command('embed <nodeId>')
  .description('Publish the video as a hosted web embed and print the snippet (free)')
  .option('--unpublish', 'Take the embed down')
  .option('--status', 'Show the embed state without publishing')
  .option('--download <file>', 'Save the self-contained HTML instead of hosting it')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (nodeId: string, opts) => {
    const { cmdMotionEmbed } = await import('./commands/motion.ts');
    await cmdMotionEmbed(nodeId, opts);
  });

motion
  .command('frames <nodeId>')
  .description('Save frames of the saved video as JPEGs and print the quality notes (free)')
  .requiredOption('--at <seconds>', 'Comma-separated times in seconds, up to 6 (e.g. 1,2.5,4)')
  .option('--width <px>', 'Longest side in pixels, up to 960')
  .option('--out <dir>', 'Where to save the frames (default: current directory)')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (nodeId: string, opts) => {
    const { cmdMotionFrames } = await import('./commands/motion.ts');
    await cmdMotionFrames(nodeId, opts);
  });

motion
  .command('revisions <nodeId>')
  .description('List the saved versions of a video, or put one back as a new version (free)')
  .option('--restore <version>', 'Restore this version; history is kept')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (nodeId: string, opts) => {
    const { cmdMotionRevisions } = await import('./commands/motion.ts');
    await cmdMotionRevisions(nodeId, opts);
  });

motion
  .command('render-status <runId>')
  .description('State of a render and the link to its file')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (runId: string, opts) => {
    const { cmdMotionRenderState } = await import('./commands/motion.ts');
    await cmdMotionRenderState(runId, opts);
  });

const gallery = program
  .command('gallery [query]')
  .description('Search the public gallery of free motion videos and compositions to remix')
  .option('--kind <k>', 'motion or composition')
  .option('--format <f>', '16:9, 9:16, 1:1 or 4:5')
  .option('--duration <d>', 'short (up to 6 s), medium (6 to 15 s) or long')
  .option('--tag <t>', 'One tag')
  .action(async (query: string | undefined, opts) => {
    const { cmdGallery } = await import('./commands/gallery.ts');
    await cmdGallery(query, opts);
  });

gallery
  .command('remix <itemId>')
  .description('Copy a gallery item into a project as a new motion video (free)')
  .requiredOption('--project <id>', 'The project to remix into')
  .option('--canvas <id>', 'The canvas (default: the Motion canvas)')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (itemId: string, opts) => {
    const { cmdGalleryRemix } = await import('./commands/gallery.ts');
    await cmdGalleryRemix(itemId, opts);
  });

gallery
  .command('publish <nodeId>')
  .description('Publish a motion video to the gallery so anyone can remix it (free)')
  .requiredOption('--title <t>', 'Up to 80 characters')
  .option('--description <d>', 'Up to 500 characters')
  .option('--tags <list>', 'Comma-separated, up to 8')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (nodeId: string, opts) => {
    const { cmdGalleryPublish } = await import('./commands/gallery.ts');
    await cmdGalleryPublish(nodeId, opts);
  });

gallery
  .command('withdraw <itemId>')
  .description('Take your item out of the gallery; copies already remixed stay')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (itemId: string, opts) => {
    const { cmdGalleryWithdraw } = await import('./commands/gallery.ts');
    await cmdGalleryWithdraw(itemId, opts);
  });

const effects = program
  .command('effects')
  .description('List image effects and the custom shader effects of your workspace')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (opts) => {
    const { cmdEffects } = await import('./commands/effects.ts');
    await cmdEffects(opts);
  });

effects
  .command('write <name>')
  .description('Write a custom effect from a GLSL file (same name replaces it), free')
  .requiredOption('--file <path>', 'GLSL body defining vec4 effect(vec2 uv)')
  .option('--params <path>', 'JSON file with the params list')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (name: string, opts) => {
    const { cmdEffectsWrite } = await import('./commands/effects.ts');
    await cmdEffectsWrite(name, opts);
  });

effects
  .command('patch <effectId>')
  .description('Replace the GLSL of a custom effect at its version, free')
  .requiredOption('--at-version <n>', 'The version list or write printed')
  .requiredOption('--file <path>', 'The new GLSL body')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (effectId: string, opts) => {
    const { cmdEffectsPatch } = await import('./commands/effects.ts');
    await cmdEffectsPatch(effectId, opts);
  });

const layouts = program
  .command('layouts')
  .description('List the custom composition layouts of your workspace')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (opts) => {
    const { cmdLayouts } = await import('./commands/layouts.ts');
    await cmdLayouts(opts);
  });

layouts
  .command('write <name>')
  .description('Write a custom layout from a JSON spec file (same name replaces it), free')
  .requiredOption('--file <path>', 'JSON spec: { kind: "spec", slots, place, ... }')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (name: string, opts) => {
    const { cmdLayoutsWrite } = await import('./commands/layouts.ts');
    await cmdLayoutsWrite(name, opts);
  });

layouts
  .command('patch <layoutId>')
  .description('Replace the spec of a custom layout at its version, free')
  .requiredOption('--at-version <n>', 'The version list or write printed')
  .requiredOption('--file <path>', 'The new JSON spec')
  .option('--org <id>', 'Which org, if you belong to more than one')
  .action(async (layoutId: string, opts) => {
    const { cmdLayoutsPatch } = await import('./commands/layouts.ts');
    await cmdLayoutsPatch(layoutId, opts);
  });

program
  .command('upgrade <slug>')
  .description('Open Stripe checkout: a monthly plan (--credits 8|16|32|64|128|256) or a one-time top-up (--top-up)')
  .option('--credits <n>', 'Monthly credits (1 credit = €1)')
  .option('--top-up <n>', 'One-time top-up in credits (1 credit = €1)')
  .action(async (slug: string, opts) => {
    const { cmdUpgrade } = await import('./commands/upgrade.ts');
    await cmdUpgrade(slug, opts);
  });

program
  .command('update')
  .description('Aggiorna feega CLI all\'ultima versione')
  .action(async () => {
    const { cmdUpdate } = await import('./commands/update.ts');
    await cmdUpdate();
  });

program.parse();
