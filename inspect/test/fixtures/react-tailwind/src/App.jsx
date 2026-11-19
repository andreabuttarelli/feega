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
      </header>
      <main className="flex flex-col items-start gap-6 px-8 py-16">
        <h1 id="title" className="text-5xl font-medium tracking-tight">Plan your launch in an afternoon</h1>
        <p className="max-w-xl text-lg text-slate-600">Briefs, timelines and assets in one place your whole team can edit.</p>
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
      </main>
      <footer className="px-8 py-6 text-sm text-slate-500">© Northwind</footer>
    </div>
  );
}
