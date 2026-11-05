export const plainText = (html: string) =>
  html
    .replace(/<a [^>]*href="mailto:([^"]+)"[^>]*>[^<]*<\/a>/g, '$1')
    .replace(/<a [^>]*href="(\/[^"#]*)[^"]*"[^>]*>([^<]*)<\/a>/g, '$2 (https://feega.app$1)')
    .replace(/<a [^>]*href="#[^"]*"[^>]*>([^<]*)<\/a>/g, '$1')
    .replace(/<[^>]+>/g, '');
