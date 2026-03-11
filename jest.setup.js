// Suppress experimental warning for ES modules in Jest
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (
    name === 'warning' &&
    typeof data === 'object' &&
    data.name === 'ExperimentalWarning' &&
    data.message.includes('CommonJS module') &&
    data.message.includes('loading ES Module')
  ) {
    return false;
  }
  return originalEmit.apply(process, arguments);
};