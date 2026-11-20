import { Benefits } from './Benefits';
import { Faq } from './Faq';

const TOPICS = ['Briefs', 'Timelines', 'Assets'];

const PLANS = [
  { name: 'Starter', price: '$0', text: 'One project, every editor control.' },
  { name: 'Studio', price: '$12', text: 'Unlimited projects and shared tokens.' },
  { name: 'Team', price: '$29', text: 'Reviews, roles and a shared design system.' }
];

export function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="flex items-center justify-between px-8 py-4 border-b">
        <span className="font-semibold">Northwind</span>
        <nav className="flex gap-6 text-sm text-slate-600">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <span id="badge" className="absolute top-3 right-4 text-xs">New</span>
      </header>
      <main className="flex flex-col items-start gap-6 px-8 py-16">
        <h1 id="title" className="text-5xl font-medium tracking-tight">Plan your launch in an afternoon</h1>
        <p className="max-w-xl text-lg text-slate-600">Briefs, timelines and assets in one place your whole team can edit.</p>
        <button id="cta" type="button">Get started</button>
        <div id="actions">
          <a id="start" className="mr-3 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-white no-underline" href="#start">Start free</a>
          <a id="docs" className="mr-3 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-white no-underline" href="#docs">Read docs</a>
        </div>
        <section id="pricing" className="grid grid-cols-3 gap-4 w-full">
          <article id="card" className="flex flex-col gap-2 p-6 rounded-lg border bg-slate-50 shadow-sm">
            <h2 className="text-xl font-semibold">{PLANS[0].name}</h2>
            <p className="text-slate-600">{PLANS[0].text}</p>
          </article>
          <article className="flex flex-col gap-2 p-6 rounded-lg border bg-slate-50">
            <h2 className="text-xl font-semibold">{PLANS[1].name}</h2>
            <p className="text-slate-600">{PLANS[1].text}</p>
          </article>
          <article className="flex flex-col gap-2 p-6 rounded-lg border bg-slate-50">
            <h2 className="text-xl font-semibold">{PLANS[2].name}</h2>
            <p className="text-slate-600">{PLANS[2].text}</p>
          </article>
        </section>
        <ul id="topics" className="m-0 list-none p-0">
          {TOPICS.map((topic) => (
            <li key={topic} className="py-2">{topic}</li>
          ))}
        </ul>
        <Benefits />
        <Faq />
      </main>
      <footer className="px-8 py-6 text-sm text-slate-500">© Northwind</footer>
    </div>
  );
}
