'use client';

export function Hero() {
  return (
    <header className="flex flex-col gap-4">
      <h1 className="text-5xl font-semibold tracking-tight">Ship faster</h1>
      <a id="cta" className="rounded-md bg-black px-4 py-2 text-white" href="#">Get started</a>
    </header>
  );
}
