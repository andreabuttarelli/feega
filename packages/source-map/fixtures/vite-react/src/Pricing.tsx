export function Pricing({ plan }: { plan: string }) {
  return (
    <section style={{ padding: 24 }}>
      <h2>{plan}</h2>
      <button id="buy">Start trial</button>
    </section>
  );
}
