<script>
const plans = [
  { name: 'Starter', text: 'One project, every editor control.' },
  { name: 'Studio', text: 'Unlimited projects and shared tokens.' },
  { name: 'Team', text: 'Reviews, roles and a shared design system.' }
];
</script>

<div class="page">
  <header class="header">
    <span class="brand">Northwind</span>
    <nav class="nav">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
    </nav>
  </header>
  <main class="main">
    <h1 id="title" class="title">Plan your launch in an afternoon</h1>
    <p class="lead">Briefs, timelines and assets in one place your whole team can edit.</p>
    <button id="cta" type="button">Get started</button>
    <section id="pricing" class="grid">
      <article id="card" class="card">
        <h2>{plans[0].name}</h2>
        <p>{plans[0].text}</p>
      </article>
      <article class="card">
        <h2>{plans[1].name}</h2>
        <p>{plans[1].text}</p>
      </article>
      <article class="card">
        <h2>{plans[2].name}</h2>
        <p>{plans[2].text}</p>
      </article>
    </section>
  </main>
  <footer class="footer">© Northwind</footer>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #fff;
    color: #0f172a;
    font-family: system-ui, sans-serif;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 32px;
    border-bottom: 1px solid #e2e8f0;
  }

  .nav {
    display: flex;
    gap: 24px;
  }

  .main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 24px;
    padding: 64px 32px;
  }

  .title {
    font-size: 48px;
    font-weight: 500;
    margin: 0;
  }

  .lead {
    max-width: 560px;
    color: #475569;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    width: 100%;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
  }

  .footer {
    padding: 24px 32px;
    color: #64748b;
  }
</style>
