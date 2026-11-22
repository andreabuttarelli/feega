import './Faq.css';

export function Faq() {
  return (
    <section className="fl-faq">
      <div className="fl-container inner">
        <h2 className="fl-title">Questions</h2>
        <div className="list">
          <details open><summary>First question?</summary><p>A short, direct answer to the first question.</p></details>
          <details><summary>Second question?</summary><p>A short, direct answer to the second question.</p></details>
          <details><summary>Third question?</summary><p>A short, direct answer to the third question.</p></details>
          <details><summary>Fourth question?</summary><p>A short, direct answer to the fourth question.</p></details>
        </div>
      </div>
    </section>
  );
}
