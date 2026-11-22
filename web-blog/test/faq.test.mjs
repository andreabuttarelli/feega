import assert from 'node:assert/strict';
import { test } from 'node:test';
import { faqFromBody, faqSchema } from '../src/faq.mjs';

const body = `Intro.

## Questions

### Is it free?

Yes. See [pricing](https://www.feega.app/pricing) for \`details\`.

### Does it work offline?

No.

## Sources

- A
`;

test('reads each question and its plain answer from the Questions section', () => {
  assert.deepEqual(faqFromBody(body), [
    { question: 'Is it free?', answer: 'Yes. See pricing for details.' },
    { question: 'Does it work offline?', answer: 'No.' }
  ]);
});

test('a post without a Questions section has no questions', () => {
  assert.deepEqual(faqFromBody('## Sources\n\n- A\n'), []);
});

test('questions become a FAQPage schema', () => {
  const schema = faqSchema(faqFromBody(body));
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity[0].acceptedAnswer.text, 'Yes. See pricing for details.');
});
