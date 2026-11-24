const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const FENCE = /^```[^\n]*\n([\s\S]*?)\n?```$/;
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BULLET = /^[-*] (.*)$/;
const HEADING = /^#{1,6} (.*)$/;

const escaped = (text: string): string => text.replace(/[&<>"]/g, (c) => ESCAPES[c]);

const inline = (text: string): string =>
  escaped(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(LINK, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');

const block = (chunk: string): string => {
  const lines = chunk.split('\n');
  if (lines.every((line) => BULLET.test(line))) {
    return `<ul>${lines.map((line) => `<li>${inline(line.match(BULLET)![1])}</li>`).join('')}</ul>`;
  }
  const [first, ...rest] = lines;
  const heading = first.match(HEADING);
  if (heading) {
    return `<h4>${inline(heading[1])}</h4>${rest.length ? block(rest.join('\n')) : ''}`;
  }
  return `<p>${lines.map(inline).join('<br>')}</p>`;
};

const FENCED_SPLIT = /(```[\s\S]*?```)/g;

export const markdown = (text: string): string =>
  text
    .split(FENCED_SPLIT)
    .map((part) => {
      const fence = part.match(FENCE);
      if (fence) {
        return `<pre><code>${escaped(fence[1])}</code></pre>`;
      }
      return part
        .split(/\n{2,}/)
        .filter((chunk) => chunk.trim())
        .map(block)
        .join('');
    })
    .join('');
