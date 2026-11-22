const FAQ_HEADING = '## Questions';
const QUESTION_PREFIX = '### ';

function plainText(markdown) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function faqFromBody(body = '') {
  const start = body.indexOf(`${FAQ_HEADING}\n`);
  if (start === -1) {
    return [];
  }

  const afterHeading = body.slice(start + FAQ_HEADING.length);
  const nextSection = afterHeading.search(/\n## /);
  const section = nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection);

  return section
    .split(`\n${QUESTION_PREFIX}`)
    .slice(1)
    .map((block) => {
      const [question, ...answer] = block.split('\n');
      return { question: plainText(question), answer: plainText(answer.join('\n')) };
    })
    .filter((item) => item.question && item.answer);
}

export function faqSchema(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer }
    }))
  };
}
