import { Permission, type Manifest } from './manifest';

export const PERMISSION_WORDS: Record<Permission, string> = {
  [Permission.Selection]: 'See which element you select',
  [Permission.Source]: 'Read the source file of the selected element',
  [Permission.Project]: 'Read facts about your project (TypeScript, public folder)',
  [Permission.EditStyle]: 'Change the styles of elements in your code',
  [Permission.EditAttributes]: 'Change attributes of elements in your code',
  [Permission.EditInsert]: 'Add new elements and component files to your code',
  [Permission.EditDependency]: 'Add packages to your package.json',
  [Permission.EditAsset]: 'Add files to your project assets',
  [Permission.PickFile]: 'Ask you to pick a file from your computer'
};

export const hostWords = (host: string) => `Send requests to ${host}`;

export const wordsOf = (manifest: Pick<Manifest, 'grants' | 'hosts'>): string[] => [...manifest.grants.map((grant) => PERMISSION_WORDS[grant]), ...manifest.hosts.map(hostWords)];
