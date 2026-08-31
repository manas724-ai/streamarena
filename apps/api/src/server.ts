// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.

import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

import { env } from './lib/env.js';
import { setIO } from './ws/io.js';
import { authRouter } from './routes/auth.js';
import { channelsRouter } from './routes/channels.js';
import { walletRouter } from './routes/wallet.js';
import { supportRouter } from './routes/support.js';
import { registerChatNamespace } from './ws/chat.js';
import { registerRtcNamespace } from './ws/rtcSignaling.js';
import { createArenaEngine, registerArenaNamespace } from './ws/arenaGateway.js';
import { registerSupportNamespace } from './ws/supportGateway.js';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'streamarena-api', time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/support', supportRouter);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: env.webOrigin, credentials: true },
});
setIO(io);

// Redis pub/sub adapter — lets Socket.IO fan events out across multiple API
// instances behind a load balancer (chat rooms, arena snapshots, etc. all
// keep working the same whether there's 1 instance or 50). If Redis isn't
// reachable (e.g. running the prototype with nothing but `npm run dev:api`),
// we log and continue on the default in-memory adapter — fine for a single
// instance, which is exactly the local dev story.
async function attachRedisAdapter() {
  try {
    const pubClient = new Redis(env.redisUrl, { lazyConnect: true, retryStrategy: () => null });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[socket.io] Redis adapter attached — ready for multi-instance scale-out');
  } catch (err) {
    console.warn('[socket.io] Redis not reachable, using in-memory adapter (fine for single-instance dev):', (err as Error).message);
  }
}

const chatNsp = io.of('/chat');
registerChatNamespace(chatNsp);

const rtcNsp = io.of('/rtc');
registerRtcNamespace(rtcNsp);

const arenaEngine = createArenaEngine();
const arenaNsp = io.of('/arena');
registerArenaNamespace(arenaNsp, arenaEngine);

const supportNsp = io.of('/support');
registerSupportNamespace(supportNsp);

await attachRedisAdapter();

httpServer.listen(env.port, () => {
  console.log(`StreamArena API listening on :${env.port}`);
  console.log(`  REST      → http://localhost:${env.port}/api`);
  console.log(`  Socket.IO → ws://localhost:${env.port} (namespaces: /chat /rtc /arena /support)`);
  console.log(
    `  AI support agent: ${env.anthropicApiKey ? 'Claude API (ANTHROPIC_API_KEY set)' : 'template fallback (no ANTHROPIC_API_KEY set)'}`,
  );
});
