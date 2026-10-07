export async function inlineMedia(root: Element, shrink: (url: string) => Promise<string>, cache: Map<string, Promise<string>>): Promise<void> {
  const REMOTE = /^(https?|blob):/;
  const CSS_URL = /url\(["']?([^"')]+)["']?\)/;
  const small = (url: string) => {
    if (!cache.has(url)) {
      cache.set(url, shrink(url).catch(() => url));
    }
    return cache.get(url)!;
  };

  const work: Promise<void>[] = [];
  for (const node of Array.from(root.querySelectorAll('*'))) {
    const el = node as HTMLElement & { src?: string };
    if (el.tagName === 'IMG' && el.src && REMOTE.test(el.src)) {
      work.push(small(el.src).then((data) => void (el.src = data)));
      continue;
    }
    const remote = CSS_URL.exec(getComputedStyle(el).backgroundImage)?.[1];
    if (remote && REMOTE.test(remote)) {
      work.push(small(remote).then((data) => el.style.setProperty('background-image', `url("${data}")`)));
    }
  }
  await Promise.all(work);
}

export async function shrinkImage(url: string): Promise<string> {
  const MAX_SIDE = 1280;
  const QUALITY = 0.9;
  const blob = await fetch(url).then((r) => r.blob());
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const small = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY });
  return new Promise((resolve, reject) => Object.assign(new FileReader(), { onload: (e: ProgressEvent<FileReader>) => resolve(String(e.target?.result)), onerror: reject }).readAsDataURL(small));
}
