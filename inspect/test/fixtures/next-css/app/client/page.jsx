'use client';

import { useState } from 'react';

export default function Client() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1 id="client-title">Client page</h1>
      <button id="count" type="button" onClick={() => setCount(count + 1)}>Clicked {count}</button>
    </main>
  );
}
