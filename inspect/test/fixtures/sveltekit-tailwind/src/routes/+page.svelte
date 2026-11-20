<script>
const plans = [
  { name: 'Starter', text: 'One project, every editor control.' },
  { name: 'Studio', text: 'Unlimited projects and shared tokens.' },
  { name: 'Team', text: 'Reviews, roles and a shared design system.' }
];
</script>

<div class="min-h-screen bg-white text-slate-900">
  <header class="flex items-center justify-between px-8 py-4 border-b">
    <span class="font-semibold">Northwind</span>
    <nav class="flex gap-6 text-sm">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
    </nav>
  </header>
  <main class="flex flex-col items-start gap-6 px-8 py-16">
    <h1 id="title" class="text-5xl font-medium tracking-tight">Plan your launch in an afternoon</h1>
    <p class="max-w-xl text-lg text-slate-600">Briefs, timelines and assets in one place your whole team can edit.</p>
    <section id="pricing" class="grid grid-cols-3 gap-4 w-full">
      <article id="card" class="flex flex-col gap-2 p-6 rounded-lg border bg-slate-50 shadow-sm">
        <h2>{plans[0].name}</h2>
        <p>{plans[0].text}</p>
      </article>
      <article class="flex flex-col gap-2 p-6 rounded-lg border bg-slate-50">
        <h2>{plans[1].name}</h2>
        <p>{plans[1].text}</p>
      </article>
      <article class="flex flex-col gap-2 p-6 rounded-lg border bg-slate-50">
        <h2>{plans[2].name}</h2>
        <p>{plans[2].text}</p>
      </article>
    </section>
  </main>
  <footer class="px-8 py-6 text-sm text-slate-500">© Northwind</footer>
</div>
