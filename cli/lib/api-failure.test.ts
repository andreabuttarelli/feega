import { describe, expect, test } from 'bun:test';
import { apiFailure } from './api.ts';

describe('an API refusal reads in words', () => {
  test('leads with the message the server wrote, then the body for a script', () => {
    const body = JSON.stringify({ error: 'agent_edit_cap', used: 1000, limit: 1000, message: 'This free team used its 1,000 agent edits for the week.' });

    expect(apiFailure(402, body)).toBe(`API 402: This free team used its 1,000 agent edits for the week.\n${body}`);
  });

  test('keeps the old shape when there is no message', () => {
    expect(apiFailure(500, 'boom')).toBe('API 500: boom');
  });
});
