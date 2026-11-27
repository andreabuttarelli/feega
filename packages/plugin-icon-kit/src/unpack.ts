export async function unpack<T>(packed: string): Promise<T> {
  const bytes = Uint8Array.from(atob(packed), (char) => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));

  return JSON.parse(await new Response(stream).text());
}
