import { describe, expect, it } from 'vitest';
import { Policy, autoAnswer, isPolicy, policyOf } from './permission-policy';

const options = [
  { id: 'reject', name: 'Reject', allows: false },
  { id: 'allow', name: 'Allow', allows: true }
];

describe('the permission policy', () => {
  it('asks every time by default', () => {
    expect(autoAnswer(Policy.Ask, 'edit', options)).toBeNull();
  });

  it('lets edits through and still asks for commands', () => {
    expect(autoAnswer(Policy.Edits, 'edit', options)).toBe('allow');
    expect(autoAnswer(Policy.Edits, 'execute', options)).toBeNull();
    expect(autoAnswer(Policy.Edits, 'fetch', options)).toBeNull();
  });

  it('allows everything when told to', () => {
    expect(autoAnswer(Policy.All, 'execute', options)).toBe('allow');
  });

  it('asks when the agent offers no allowing option', () => {
    expect(autoAnswer(Policy.All, 'edit', [options[0]])).toBeNull();
  });

  it('recognises only its own values', () => {
    expect(isPolicy('edits')).toBe(true);
    expect(isPolicy('yolo')).toBe(false);
  });

  it('prefers the project choice, then the setting, then asking', () => {
    expect(policyOf('all', 'edits')).toBe(Policy.All);
    expect(policyOf(undefined, 'edits')).toBe(Policy.Edits);
    expect(policyOf(undefined, undefined)).toBe(Policy.Ask);
  });
});
