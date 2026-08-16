import { createInterface } from 'readline';

const ENTER = ['\n', '\r'];
const CTRL_D = '\u0004';
const CTRL_C = '\u0003';
const BACKSPACE = ['\u007f', '\b'];

export async function promptText(query: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<string>(resolve => rl.question(query, resolve));
  } finally {
    rl.close();
  }
}

export async function promptPassword(query: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(query);

    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    const cleanup = () => {
      stdin.setRawMode?.(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const onData = (char: string) => {
      if (ENTER.includes(char) || char === CTRL_D) {
        cleanup();
        process.stdout.write('\n');
        resolve(password);
        return;
      }

      if (char === CTRL_C) {
        cleanup();
        reject(new Error('Prompt cancelled'));
        return;
      }

      if (BACKSPACE.includes(char)) {
        password = password.slice(0, -1);
        return;
      }

      password += char;
    };

    stdin.on('data', onData);
  });
}
