import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FromDesktop, ToDesktop } from '@lock-in/core';

// Stands in for the desktop app and its bridge: Chrome starts it as the Native Messaging
// host, and it speaks the same framed JSON. Tests read what the extension sent and push
// messages to it through two files.

const hostScript = (inbox: string, outbox: string, greeting: FromDesktop[]) => `
import { appendFileSync, readFileSync, watchFile } from 'node:fs';
const send = (message) => {
  const body = Buffer.from(JSON.stringify(message));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([length, body]));
};
let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE(0)) {
    const length = buffer.readUInt32LE(0);
    appendFileSync(${JSON.stringify(inbox)}, buffer.subarray(4, 4 + length).toString() + '\\n');
    buffer = buffer.subarray(4 + length);
  }
});
process.stdin.on('end', () => process.exit(0));
let sent = 0;
watchFile(${JSON.stringify(outbox)}, { interval: 50 }, () => {
  const lines = readFileSync(${JSON.stringify(outbox)}, 'utf8').split('\\n').filter(Boolean);
  for (const line of lines.slice(sent)) send(JSON.parse(line));
  sent = lines.length;
});
for (const message of ${JSON.stringify(greeting)}) send(message);
`;

export interface FakeDesktopApp {
  /** The executable to register as the Native Messaging host. */
  host: string;
  /** Everything the extension has sent so far. */
  received(): Promise<ToDesktop[]>;
  send(message: FromDesktop): Promise<void>;
  remove(): Promise<void>;
}

/** Creates a fake app that says `greeting` as soon as the extension connects. */
export async function fakeDesktopApp(greeting: FromDesktop[]): Promise<FakeDesktopApp> {
  const dir = await mkdtemp(join(tmpdir(), 'lock-in-fake-app-'));
  const inbox = join(dir, 'inbox.jsonl');
  const outbox = join(dir, 'outbox.jsonl');
  const script = join(dir, 'host.mjs');
  const host = join(dir, 'host.sh');
  await writeFile(inbox, '');
  await writeFile(outbox, '');
  await writeFile(script, hostScript(inbox, outbox, greeting));
  await writeFile(host, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(script)} "$@"\n`);
  await chmod(host, 0o755);

  return {
    host,
    async received() {
      const lines = (await readFile(inbox, 'utf8')).split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as ToDesktop);
    },
    async send(message) {
      await writeFile(outbox, JSON.stringify(message) + '\n', { flag: 'a' });
    },
    remove: () => rm(dir, { recursive: true, force: true }),
  };
}
