import { describe, test, expect } from '@jest/globals';
import { applyQuery } from '../../src/jmespath-query.js';
import { CoreError, CoreErrorCode } from '../../src/errors.js';

describe('applyQuery', () => {
  const data = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 }
  ];

  test('returns data unchanged when query is undefined', () => {
    expect(applyQuery(data, undefined)).toBe(data);
  });

  test('returns data unchanged when query is an empty string', () => {
    expect(applyQuery(data, '')).toBe(data);
  });

  test('filters data matching a JMESPath expression', () => {
    expect(applyQuery(data, "[?age > `26`]")).toEqual([{ name: 'Alice', age: 30 }]);
  });

  test('projects data matching a JMESPath expression', () => {
    expect(applyQuery(data, '[].name')).toEqual(['Alice', 'Bob']);
  });

  test('throws a CoreError with InvalidParams code on malformed syntax', () => {
    expect(() => applyQuery(data, '[invalid(')).toThrow(CoreError);
    try {
      applyQuery(data, '[invalid(');
      fail('expected applyQuery to throw');
    } catch (error) {
      expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
    }
  });

  test('the error message includes the bad query string', () => {
    try {
      applyQuery(data, '[invalid(');
      fail('expected applyQuery to throw');
    } catch (error) {
      expect((error as Error).message).toContain('[invalid(');
    }
  });
});
