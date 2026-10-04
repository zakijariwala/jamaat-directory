import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/lib/phone';

describe('normalizePhone', () => {
  it.each([
    ['9820012345', '+919820012345'],
    ['098200 12345', '+919820012345'],
    ['+91-98200-12345', '+919820012345'],
    ['91 98200 12345', '+919820012345'],
    ['0091 98200 12345', '+919820012345'],
    ['+971 50 123 4567', '+971501234567'],
    ['(022) 2745-1234', '+912227451234'],
  ])('%s -> %s', (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });

  it('returns null for blanks and leaves unrecognised input for a moderator', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('  ')).toBeNull();
    expect(normalizePhone('n/a')).toBeNull();
    expect(normalizePhone('12345')).toBe('12345');
  });
});
