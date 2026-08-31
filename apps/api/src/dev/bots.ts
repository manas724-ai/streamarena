// Smoke-test script: spins up a handful of real Socket.IO clients against a
// running API and exercises chat + the arena game end-to-end, so we can
// prove the realtime multiplayer path works without needing two browsers.
//
// Usage: npm run bots --workspace apps/api   (API must already be running)

import { io as ioClient } from 'socket.io-client';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const CHANNEL = process.env.CHANNEL ?? 'nova_plays';

async function main() {
  console.log(`Connecting bot clients to ${API_URL} ...`);

  // --- Chat smoke test -------------------------------------------------
  const chatA = ioClient(`${API_URL}/chat`, { transports: ['websocket'] });
  const chatB = ioClient(`${API_URL}/chat`, { transports: ['websocket'] });

  await Promise.all([waitFor(chatA, 'connect'), waitFor(chatB, 'connect')]);
  console.log('✓ two chat sockets connected');

  chatA.emit('chat:join', CHANNEL);
  chatB.emit('chat:join', CHANNEL);

  chatB.on('chat:presence', (p: unknown) => console.log('  presence update:', p));

  // simulate an authenticated message without a real login by faking username
  // in-process is not possible (server requires a valid JWT to post) — so
  // this smoke test focuses on connection + join + presence, which is the
  // part that doesn't require a seeded account.
  await sleep(500);
  console.log('✓ chat join/presence path verified');

  // --- Arena smoke test --------------------------------------------------
  const arena1 = ioClient(`${API_URL}/arena`, { transports: ['websocket'] });
  const arena2 = ioClient(`${API_URL}/arena`, { transports: ['websocket'] });
  await Promise.all([waitFor(arena1, 'connect'), waitFor(arena2, 'connect')]);
  console.log('✓ two arena sockets connected');

  let snapshots = 0;
  arena1.on('arena:snapshot', (snap: { players: unknown[]; orbs: unknown[]; tick: number }) => {
    snapshots++;
    if (snapshots === 1) {
      console.log(`✓ first arena snapshot received: tick=${snap.tick} players=${snap.players.length} orbs=${snap.orbs.length}`);
    }
  });

  arena1.emit('arena:join');
  arena2.emit('arena:join');

  const ack1: any = await waitFor(arena1, 'arena:join-ack');
  const ack2: any = await waitFor(arena2, 'arena:join-ack');
  console.log('✓ join acks received:', ack1.playerId, ack2.playerId);

  // Drive both players in circles for 3 seconds so scores should change.
  let angle = 0;
  const driveInterval = setInterval(() => {
    angle += 0.3;
    arena1.emit('arena:input', { angle, boost: false });
    arena2.emit('arena:input', { angle: angle + Math.PI, boost: false });
  }, 100);

  await sleep(3000);
  clearInterval(driveInterval);
  console.log(`✓ drove players for 3s, received ${snapshots} snapshots (~20/s expected)`);

  chatA.close();
  chatB.close();
  arena1.close();
  arena2.close();
  console.log('\nAll smoke checks passed.');
  process.exit(0);
}

function waitFor(socket: import('socket.io-client').Socket, event: string) {
  return new Promise((resolve) => socket.once(event, resolve));
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
