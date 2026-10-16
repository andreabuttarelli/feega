const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function painted(frames = 2): Promise<void> {
  for (let i = 0; i < frames; i += 1) {
    await nextFrame();
  }
}

export async function decoded(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);
}
