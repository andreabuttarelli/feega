import { FIDELITY_APPS, AppSource } from '$lib/server/code-import/fidelity-apps';
import { BASE_CONDITIONS, Scheme, WIDTHS, type RenderConditions } from '$lib/server/code-import/render-conditions';
import { MAX_ROUTES } from '$lib/server/code-import/repo';

export type Thresholds = { routeSuccess: number; componentCoverage: number; bindRate: number; fidelity: number };

export type CorpusEntry = {
  name: string;
  repo: string;
  sha: string;
  licence: string;
  framework: string;
  app: string;
  expectedRoutes: string[];
  routes: string[];
  conditions: RenderConditions[];
  componentFiles: number;
  declaredVariants?: number;
  needs?: string;
  thresholds: Thresholds;
};

export const COMPONENT_RULE = 'files with extension .tsx/.jsx/.svelte/.vue under a components/ directory of the app, excluding index.*, *.test.*, *.spec.*, *.stories.*';

export const ROUTE_RULE = 'file-router pages in the tree at the pinned sha: SvelteKit +page.svelte, Next app/**/page.*, Nuxt/Vite pages/**/*.vue, TanStack src/routes/**/*.tsx; (groups), @slots and _pathless segments dropped';

const DARK_PHONE: RenderConditions = { scheme: Scheme.Dark, width: WIDTHS.Phone };

const CONDITIONS = [BASE_CONDITIONS, DARK_PHONE];

const DEFAULT_THRESHOLDS: Thresholds = { routeSuccess: 0.9, componentCoverage: 0.5, bindRate: 0.6, fidelity: 0.95 };

const isStatic = (route: string) => !route.includes('[') && !route.includes('$');

const typed = (expected: string[]) => expected.filter(isStatic).slice(0, MAX_ROUTES);

type Pinned = Omit<CorpusEntry, 'routes' | 'conditions' | 'thresholds'> & { routes?: string[] };

const entry = (p: Pinned): CorpusEntry => ({ ...p, routes: p.routes ?? typed(p.expectedRoutes), conditions: CONDITIONS, thresholds: DEFAULT_THRESHOLDS });

const PINNED: Pinned[] = [
  {
    name: 'traidue',
    repo: 'andreabuttarelli/traidue.com',
    sha: '5eaea2f056e981a75f451faeec895dff60eebbe1',
    licence: 'Apache-2.0',
    framework: 'SvelteKit + Tailwind 4',
    app: '',
    expectedRoutes: ['/', '/chi-siamo', '/cookie', '/famiglie', '/giovani', '/glossario', '/migliori-portali-informazione-trans', '/newsletter', '/operazioni', '/operazioni/[slug]', '/perche-ai', '/privacy', '/quiz', '/quiz/[slug]', '/servizi', '/servizi/[id]', '/termini', '/wiki', '/wiki/[slug]'],
    componentFiles: 24
  },
  {
    name: 'next-shadcn-admin',
    repo: 'arhamkhnz/next-shadcn-admin-dashboard',
    sha: '3d1d6f4abf4231b258c81da25da1ccbc38d9b954',
    licence: 'MIT',
    framework: 'Next 16 + shadcn',
    app: '',
    expectedRoutes: ['/', '/auth/v1/login', '/auth/v1/register', '/auth/v2/login', '/auth/v2/register', '/chat', '/dashboard', '/dashboard/[...not-found]', '/dashboard/academy', '/dashboard/analytics', '/dashboard/analytics-v1', '/dashboard/calendar', '/dashboard/chat', '/dashboard/coming-soon', '/dashboard/crm', '/dashboard/crm-v1', '/dashboard/default', '/dashboard/default-v1', '/dashboard/ecommerce', '/dashboard/file-manager', '/dashboard/finance', '/dashboard/finance-v1', '/dashboard/infrastructure', '/dashboard/invoice', '/dashboard/kanban', '/dashboard/logistics', '/dashboard/mail', '/dashboard/patient-monitoring', '/dashboard/productivity', '/dashboard/products', '/dashboard/profile', '/dashboard/roles', '/dashboard/tasks', '/dashboard/users', '/mail', '/unauthorized'],
    componentFiles: 67
  },
  {
    name: 'shadcn-admin',
    repo: 'satnaing/shadcn-admin',
    sha: 'e16c87f213a5ba5e45964e9b67c792105ec74d26',
    licence: 'MIT',
    framework: 'Vite React + TanStack Router',
    app: '',
    expectedRoutes: ['/', '/401', '/403', '/404', '/500', '/503', '/apps', '/chats', '/clerk', '/clerk/sign-in', '/clerk/sign-up', '/clerk/user-management', '/errors/$error', '/forgot-password', '/help-center', '/otp', '/settings', '/settings/account', '/settings/appearance', '/settings/display', '/settings/notifications', '/sign-in', '/sign-in-2', '/sign-up', '/tasks', '/users'],
    routes: FIDELITY_APPS['shadcn-admin'].pages,
    componentFiles: 92
  },
  {
    name: 'nuxt-dashboard',
    repo: 'nuxt-ui-templates/dashboard',
    sha: '5fe43b8cc033a35a79e2c8432c64f70ab7ab1ef9',
    licence: 'MIT',
    framework: 'Nuxt 4',
    app: '',
    expectedRoutes: ['/', '/customers', '/inbox', '/settings', '/settings/members', '/settings/notifications', '/settings/security'],
    componentFiles: 13
  },
  {
    name: 'shadcn-ui-v4',
    repo: 'shadcn-ui/ui',
    sha: 'dd41d19e2f80ff6891951f7ced74c2c9a650b065',
    licence: 'MIT',
    framework: 'Next (pnpm + turbo monorepo)',
    app: 'apps/v4',
    expectedRoutes: ['/', '/blocks', '/blocks/[...categories]', '/charts/[type]', '/colors', '/create', '/docs/[[...slug]]', '/docs/changelog', '/examples/[base]/[name]', '/examples/authentication', '/examples/dashboard', '/examples/playground', '/examples/rtl', '/examples/tasks', '/preview/[base]/[name]', '/preview/typeset/[name]', '/sera', '/typeset', '/view/[style]/[name]'],
    componentFiles: 499,
    needs: 'app path apps/v4: RepoRef has no subdirectory, the sandbox boots the repo root'
  },
  {
    name: 'saas-starter',
    repo: 'nextjs/saas-starter',
    sha: '6e33e58b1e553a41fe22e6b941a7229a002de361',
    licence: 'MIT',
    framework: 'Next + Postgres',
    app: '',
    expectedRoutes: ['/', '/dashboard', '/dashboard/activity', '/dashboard/general', '/dashboard/security', '/pricing', '/sign-in', '/sign-up'],
    componentFiles: 7,
    needs: 'POSTGRES_URL, STRIPE_SECRET_KEY, AUTH_SECRET: the sandbox passes no env'
  },
  {
    name: 'next-playground',
    repo: 'vercel/next-app-router-playground',
    sha: 'b5c0f7eaf1ed070d20aa29f435ce22a48b987684',
    licence: 'MIT',
    framework: 'Next 16 RSC',
    app: '',
    expectedRoutes: ['/', '/[section]', '/[section]/[category]', '/active-links', '/app-shell-upgrading', '/breadcrumbs', '/cached-components', '/cached-functions', '/cached-routes', '/context', '/error', '/layouts', '/loading', '/navigation-stages', '/not-found', '/parallel-routes', '/private-cache', '/remote-cache', '/route-groups', '/search-params', '/use-link-status', '/view-transitions'],
    routes: FIDELITY_APPS['next-playground'].pages,
    componentFiles: 0
  },
  {
    name: 'svgl',
    repo: 'pheralb/svgl',
    sha: 'c0ec7ab121354ac1096b17b3aebbb293c8ce5600',
    licence: 'MIT',
    framework: 'SvelteKit, Svelte 5',
    app: '',
    expectedRoutes: ['/', '/directory/[category]', '/docs/[...slug]', '/extensions', '/favorites'],
    routes: FIDELITY_APPS.svgl.pages,
    componentFiles: 107
  },
  {
    name: 'vitesse',
    repo: 'antfu-collective/vitesse',
    sha: 'a8785264f83c2ebe1b3cf689296775a4949957c8',
    licence: 'MIT',
    framework: 'Vue 3 + Vite',
    app: '',
    expectedRoutes: ['/', '/[...all]', '/hi/[name]'],
    routes: FIDELITY_APPS.vitesse.pages,
    componentFiles: 3
  }
];

export const CORPUS: CorpusEntry[] = PINNED.map(entry);

export const OUT_OF_CORPUS = Object.entries(FIDELITY_APPS)
  .filter(([, app]) => app.source !== AppSource.Repo)
  .map(([name]) => ({ name, unrun: 'Storybook source, not a repository import' }));

export const repoUrl = (e: CorpusEntry) => `https://github.com/${e.repo}/tree/${e.sha}`;
