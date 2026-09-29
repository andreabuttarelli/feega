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

program
  .command('upgrade <slug>')
  .description('Upgrade piano — apre la pagina di checkout nel browser')
  .action(async (slug: string) => {
    const { cmdUpgrade } = await import('./commands/upgrade.ts');
    await cmdUpgrade(slug);
  });

program
  .command('update')
  .description('Aggiorna feega CLI all\'ultima versione')
  .action(async () => {
    const { cmdUpdate } = await import('./commands/update.ts');
    await cmdUpdate();
  });

program.parse();
