import { SITE_URL } from '../links';
import { script } from '../structured-data';
import { Tier, Theme, type Template } from './template';
import { shotPath, templatePath } from './paths';

const ABSOLUTE = (path: string) => `${SITE_URL}${path}`;

const PUBLISHER = { '@type': 'Organization', name: 'Feega', url: `${SITE_URL}/` };

const LICENSE = 'https://www.apache.org/licenses/LICENSE-2.0';

const LANGUAGES = ['Svelte', 'React (TSX)', 'Vue', 'Astro', 'HTML', 'CSS'];

export type ListedPage = { readonly name: string; readonly path: string };

export const collectionJsonLd = (page: { name: string; description: string; path: string }, items: readonly ListedPage[]) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: page.name,
    description: page.description,
    url: ABSOLUTE(page.path),
    publisher: PUBLISHER,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, url: ABSOLUTE(item.path) }))
    }
  });

export const templateJsonLd = (template: Template, description: string) =>
  script({
    '@context': 'https://schema.org',
    '@type': ['CreativeWork', 'SoftwareSourceCode'],
    name: template.name,
    description,
    url: ABSOLUTE(templatePath(template.id)),
    image: ABSOLUTE(shotPath(template.id, Theme.Dark)),
    keywords: template.tags.join(', '),
    programmingLanguage: LANGUAGES,
    license: LICENSE,
    isAccessibleForFree: template.tier === Tier.Free,
    author: PUBLISHER,
    publisher: PUBLISHER,
    isPartOf: { '@type': 'CollectionPage', name: 'Feega templates', url: ABSOLUTE('/templates') }
  });
