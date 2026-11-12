import { PAGES } from './demos';

const PAGE_PARAM = 's';

export function Gallery() {
  const wanted = new URLSearchParams(location.search).get(PAGE_PARAM);
  const page = PAGES.find((p) => p.slug === wanted);
  if (!page) {
    return (
      <ul style={{ padding: 32, lineHeight: 1.8 }}>
        {PAGES.map((p) => (
          <li key={p.slug}>
            <a href={`?${PAGE_PARAM}=${p.slug}`}>{p.title}</a>
          </li>
        ))}
      </ul>
    );
  }
  return <page.Demo />;
}
