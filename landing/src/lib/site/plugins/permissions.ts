const NETWORK_PREFIX = 'network:';

const WORDS: Readonly<Record<string, string>> = {
  selection: 'See which element you have selected',
  project: 'Read your project framework and folder layout',
  source: 'Read the text of your source files',
  'edit.style': 'Change the styles of the selected element',
  'edit.attributes': 'Change attributes on your elements',
  'edit.insert': 'Insert new elements into your code',
  'edit.dependency': 'Add packages to your package.json',
  'edit.asset': 'Copy files into your project',
  'file.pick': 'Ask you to pick a file'
};

export function permissionWords(permission: string): string {
  if (permission.startsWith(NETWORK_PREFIX)) {
    return `Download files from ${permission.slice(NETWORK_PREFIX.length)}`;
  }

  return WORDS[permission] ?? `Ask for the permission "${permission}"`;
}
