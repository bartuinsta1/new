import { preview } from 'vite';
import type { PreviewServer } from 'vite';

let server: PreviewServer;

export async function setup() {
  server = await preview({ preview: { port: 4180, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
}

export async function teardown() {
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
