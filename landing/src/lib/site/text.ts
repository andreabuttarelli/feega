export const plainText = (html: string) =>
  html
    .replace(/<a [^>]*href="mailto:([^"]+)"[^>]*>[^<]*<\/a>/g, '$1')
    .replace(/<a [^>]*href="(\/[^"#]*)[^"]*"[^>]*>([^<]*)<\/a>/g, '$2 (https://www.feega.app$1)')
    .replace(/<a [^>]*href="#[^"]*"[^>]*>([^<]*)<\/a>/g, '$1')
    .replace(/<[^>]+>/g, '');
