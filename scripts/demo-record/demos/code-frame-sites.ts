export const REACT_SITE: Record<string, string> = {
  'App.tsx': `import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import Home from './pages/Home';
import Pricing from './pages/Pricing';
import About from './pages/About';
import './styles.css';

export default function App() {
  return (
    <MemoryRouter>
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <Footer />
      </div>
    </MemoryRouter>
  );
}
`,
  'styles.css': `body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
.grain { background-image: radial-gradient(circle at 20% 10%, #fde7c7 0, transparent 45%), radial-gradient(circle at 80% 0%, #dbeafe 0, transparent 40%); }
`,
  'components/Nav.tsx': `import { NavLink } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

const LINKS = [
  { to: '/', label: 'Product' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' }
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <BarChart3 size={20} /> Northwind
        </NavLink>
        <div className="flex gap-6 text-sm">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => (isActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900')}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <NavLink to="/pricing" className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white">Start free</NavLink>
      </nav>
    </header>
  );
}
`,
  'components/Footer.tsx': `export default function Footer() {
  return (
    <footer className="border-t border-stone-200 py-10 text-center text-sm text-stone-500">
      © 2026 Northwind Analytics · Made in Lisbon
    </footer>
  );
}
`,
  'components/Reveal.tsx': `import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export default function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="reveal"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
`,
  'pages/Home.tsx': `import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gauge, LineChart, Users } from 'lucide-react';
import Reveal from '../components/Reveal';

const FEATURES = [
  { icon: Gauge, title: 'Live dashboards', body: 'Every metric your team tracks, refreshed the moment it changes.' },
  { icon: LineChart, title: 'Forecasts that explain themselves', body: 'See the drivers behind every projection, not just the line.' },
  { icon: Users, title: 'Built for small teams', body: 'Share a board with a link. No seats to count, no admin to call.' }
];

export default function Home() {
  return (
    <main>
      <section className="grain px-6 pb-24 pt-28 text-center">
        <motion.p className="text-sm font-medium uppercase tracking-widest text-amber-700" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          Analytics for teams of 2 to 50
        </motion.p>
        <motion.h1
          id="hero-title"
          className="mx-auto mt-4 max-w-3xl text-6xl font-semibold leading-tight tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          Know your numbers before the Monday meeting.
        </motion.h1>
        <motion.p className="mx-auto mt-6 max-w-xl text-lg text-stone-600" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 }}>
          Northwind connects to Stripe, Shopify and your database, and turns them into one page your whole team reads.
        </motion.p>
        <motion.div className="mt-10 flex justify-center gap-3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}>
          <Link to="/pricing" className="rounded-full bg-stone-900 px-6 py-3 text-white">See pricing</Link>
          <Link to="/about" className="rounded-full border border-stone-300 px-6 py-3">Our story</Link>
        </motion.div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-24 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.12}>
            <div className="h-full rounded-2xl border border-stone-200 bg-white p-8">
              <f.icon className="text-amber-700" />
              <h3 className="mt-6 text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-stone-600">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="bg-stone-900 px-6 py-28 text-center text-white">
        <Reveal>
          <blockquote className="mx-auto max-w-3xl text-3xl leading-snug">
            "We cancelled three tools the week we moved to Northwind. Our Monday meeting is now fifteen minutes."
          </blockquote>
          <p className="mt-6 text-stone-400">Marta Silva, COO at Lumen Ceramics</p>
        </Reveal>
      </section>
    </main>
  );
}
`,
  'pages/Pricing.tsx': `import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const PLANS = [
  { name: 'Starter', monthly: 0, perks: ['3 dashboards', '2 data sources', 'Daily refresh'] },
  { name: 'Team', monthly: 29, perks: ['Unlimited dashboards', '10 data sources', 'Live refresh', 'Forecasts'], featured: true },
  { name: 'Scale', monthly: 99, perks: ['Everything in Team', 'SSO', 'Audit log', 'Priority support'] }
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const price = (monthly: number) => (yearly ? Math.round(monthly * 0.8) : monthly);

  return (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <h1 className="text-center text-5xl font-semibold tracking-tight">Simple pricing</h1>
      <div className="mt-8 flex justify-center">
        <button id="billing-toggle" onClick={() => setYearly(!yearly)} className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm">
          {yearly ? 'Billed yearly · save 20%' : 'Billed monthly'}
        </button>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PLANS.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={'rounded-2xl p-8 ' + (p.featured ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white')}
          >
            <h2 className="text-lg font-medium">{p.name}</h2>
            <p className="mt-4 text-5xl font-semibold" data-testid={'price-' + p.name}>\${price(p.monthly)}<span className="text-base font-normal opacity-60">/mo</span></p>
            <ul className="mt-8 space-y-3">
              {p.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2"><Check size={16} /> {perk}</li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
`,
  'pages/About.tsx': `import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  ['2019', 'Founded in Lisbon'],
  ['4,200', 'Teams on Northwind'],
  ['38', 'People, fully remote']
];

export default function About() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stat', { opacity: 0, y: 60, stagger: 0.15, scrollTrigger: { trigger: '.stats', start: 'top 80%' } });
      gsap.to('.bar', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.stats', start: 'top bottom', end: 'bottom top', scrub: true } });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={root}>
      <section className="mx-auto max-w-3xl px-6 py-28">
        <h1 className="text-5xl font-semibold tracking-tight">We build the tool we wanted.</h1>
        <p className="mt-6 text-lg text-stone-600">
          Northwind started as a spreadsheet three founders shared every Monday. It grew into the page four thousand teams open first.
        </p>
      </section>
      <div className="h-[60vh] bg-gradient-to-b from-stone-50 to-amber-50" />
      <div className="bar mx-auto h-1 max-w-6xl origin-left scale-x-0 bg-amber-600" />
      <section className="stats mx-auto grid max-w-6xl gap-6 px-6 py-24 md:grid-cols-3">
        {STATS.map(([value, label]) => (
          <div key={label} className="stat rounded-2xl bg-white p-10 shadow-sm">
            <p className="text-5xl font-semibold">{value}</p>
            <p className="mt-2 text-stone-500">{label}</p>
          </div>
        ))}
      </section>
      <div className="h-[40vh]" />
    </main>
  );
}
`
};

export const SVELTE_SITE: Record<string, string> = {
  'App.svelte': `<script lang="ts">
  import Nav from './components/Nav.svelte';
  import Home from './pages/Home.svelte';
  import Pricing from './pages/Pricing.svelte';
  import About from './pages/About.svelte';

  const PAGES = { '#/': Home, '#/pricing': Pricing, '#/about': About };
  let hash = $state(location.hash || '#/');
  const Page = $derived(PAGES[hash as keyof typeof PAGES] ?? Home);
</script>

<svelte:window onhashchange={() => { hash = location.hash || '#/'; scrollTo(0, 0); }} />

<div class="min-h-screen bg-[#0f1115] text-zinc-100">
  <Nav {hash} />
  {#key hash}
    <Page />
  {/key}
</div>
`,
  'components/Nav.svelte': `<script lang="ts">
  let { hash }: { hash: string } = $props();
  const LINKS = [['#/', 'Home'], ['#/pricing', 'Pricing'], ['#/about', 'About']];
</script>

<header class="sticky top-0 z-10 border-b border-white/10 bg-[#0f1115]/80 backdrop-blur">
  <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <a href="#/" class="font-semibold tracking-tight">Orbit<span class="text-violet-400">.</span></a>
    <div class="flex gap-6 text-sm">
      {#each LINKS as [href, label]}
        <a {href} class={hash === href ? 'text-white' : 'text-zinc-400 hover:text-white'}>{label}</a>
      {/each}
    </div>
  </nav>
</header>
`,
  'lib/reveal.ts': `export function reveal(node: HTMLElement, delay = 0) {
  node.style.opacity = '0';
  node.style.transform = 'translateY(40px)';
  node.style.transition = \`opacity 700ms \${delay}ms, transform 700ms cubic-bezier(.22,1,.36,1) \${delay}ms\`;

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    node.style.opacity = '1';
    node.style.transform = 'none';
    node.dataset.revealed = 'true';
    observer.disconnect();
  }, { threshold: 0.25 });

  observer.observe(node);
  return { destroy: () => observer.disconnect() };
}
`,
  'pages/Home.svelte': `<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { reveal } from '../lib/reveal';

  const FEATURES = [
    ['Orbit Sync', 'Your calendar, tasks and notes in one timeline that updates itself.'],
    ['Focus blocks', 'Orbit protects deep-work time and moves meetings around it.'],
    ['Weekly review', 'A two-minute recap every Friday of what moved and what stalled.']
  ];
</script>

<main>
  <section class="px-6 pb-24 pt-28 text-center">
    <h1 id="svelte-hero" in:fly={{ y: 40, duration: 800 }} class="mx-auto max-w-3xl text-6xl font-semibold leading-tight tracking-tight">
      Plan less. <span class="text-violet-400">Ship more.</span>
    </h1>
    <p in:fade={{ delay: 250, duration: 800 }} class="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
      Orbit is the planner that rearranges your week so the important work actually happens.
    </p>
    <a in:fly={{ y: 20, delay: 450 }} href="#/pricing" class="mt-10 inline-block rounded-full bg-violet-500 px-6 py-3 font-medium text-white">Try Orbit free</a>
  </section>
  <div class="h-[50vh]"></div>
  <section class="mx-auto grid max-w-6xl gap-6 px-6 pb-32 md:grid-cols-3">
    {#each FEATURES as [title, body], i}
      <article use:reveal={i * 120} class="feature rounded-2xl border border-white/10 bg-white/5 p-8">
        <h3 class="text-xl font-semibold">{title}</h3>
        <p class="mt-2 text-zinc-400">{body}</p>
      </article>
    {/each}
  </section>
</main>
`,
  'pages/Pricing.svelte': `<script lang="ts">
  import { scale } from 'svelte/transition';
  let seats = $state(5);
  const total = $derived(seats * 8);
</script>

<main class="mx-auto max-w-3xl px-6 py-24 text-center">
  <h1 class="text-5xl font-semibold tracking-tight">One plan. Pay per person.</h1>
  <div in:scale={{ start: 0.9, duration: 500 }} class="mt-12 rounded-2xl border border-white/10 bg-white/5 p-10">
    <p class="text-zinc-400">Team size</p>
    <div class="mt-4 flex items-center justify-center gap-6">
      <button id="seats-down" class="h-10 w-10 rounded-full bg-white/10" onclick={() => (seats = Math.max(1, seats - 1))}>−</button>
      <span id="seats" class="text-4xl font-semibold">{seats}</span>
      <button id="seats-up" class="h-10 w-10 rounded-full bg-white/10" onclick={() => seats++}>+</button>
    </div>
    <p class="mt-8 text-6xl font-semibold" id="svelte-total">\${total}<span class="text-lg text-zinc-400">/mo</span></p>
  </div>
</main>
`,
  'pages/About.svelte': `<script lang="ts">
  import { fly } from 'svelte/transition';
  import { reveal } from '../lib/reveal';
</script>

<main class="mx-auto max-w-3xl px-6 py-28">
  <h1 in:fly={{ x: -40, duration: 700 }} class="text-5xl font-semibold tracking-tight">Six people, one planner.</h1>
  <p class="mt-6 text-lg text-zinc-400">We are a small team in Berlin and Turin building the tool we use every day.</p>
  <div class="h-[60vh]"></div>
  <p use:reveal class="text-3xl">Orbit is independent, profitable and here for the long run.</p>
</main>
`
};
