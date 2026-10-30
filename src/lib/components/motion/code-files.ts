type CodeFile = { path: string; content: string };

export function entryFile<T extends CodeFile>(files: T[], picked = ''): T | undefined {
  return files.find((f) => f.path === picked) ?? files.find((f) => f.path.includes('/pages/') || f.path.endsWith('+page.svelte')) ?? files.find((f) => f.path === 'index.html') ?? files[0];
}
