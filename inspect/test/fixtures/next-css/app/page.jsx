import styles from './page.module.css';

const PLANS = [
  { name: 'Starter', text: 'One project, every editor control.' },
  { name: 'Studio', text: 'Unlimited projects and shared tokens.' },
  { name: 'Team', text: 'Reviews, roles and a shared design system.' }
];

export default function Page() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Northwind</span>
        <nav className={styles.nav}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
      </header>
      <main className={styles.main}>
        <h1 id="title" className={styles.title}>Plan your launch in an afternoon</h1>
        <p className={styles.lead}>Briefs, timelines and assets in one place your whole team can edit.</p>
        <button id="cta" type="button">Get started</button>
        <div id="actions" className={styles.actions}>
          <a id="start" className={styles.btn} href="#start">Start free</a>
          <a id="docs" className={styles.btn} href="#docs">Read docs</a>
        </div>
        <section id="pricing" className={styles.grid}>
          <article id="card" className={styles.card}>
            <h2>{PLANS[0].name}</h2>
            <p>{PLANS[0].text}</p>
          </article>
          <article className={styles.card}>
            <h2>{PLANS[1].name}</h2>
            <p>{PLANS[1].text}</p>
          </article>
          <article className={styles.card}>
            <h2>{PLANS[2].name}</h2>
            <p>{PLANS[2].text}</p>
          </article>
        </section>
      </main>
      <footer className={styles.footer}>© Northwind</footer>
    </div>
  );
}
