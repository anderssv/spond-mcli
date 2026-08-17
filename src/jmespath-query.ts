import jmespath from 'jmespath';
import { CoreError, CoreErrorCode } from './errors.js';

export function applyQuery<T>(data: T, query: string | undefined): unknown {
  if (!query) return data;

  try {
    return jmespath.search(data, query);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CoreError(CoreErrorCode.InvalidParams, `Invalid JMESPath query "${query}": ${detail}`);
  }
}
