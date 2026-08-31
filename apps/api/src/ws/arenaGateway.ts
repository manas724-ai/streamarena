import type { Namespace, Socket } from 'socket.io';
import { ArenaEngine } from '../game/arena.js';
import { verifyToken } from '../lib/auth.js';
import {
  createArenaResult,
  creditWallet,
  findUserByUsername,
  getWalletBalance,
  hasFullAccess,
  tryDebitWallet,
} from '../db/repo.js';
import { SOCKET_EVENTS, type ArenaInput, type ArenaJoinAck } from '@streamarena/shared';

interface ArenaSocketData {
  playerId?: string;
  userId?: string | null;
  username?: string;
}

const GUEST_ADJECTIVES = ['Swift', 'Lucky', 'Shadow', 'Cosmic', 'Wild', 'Iron', 'Neon'];

export function createArenaEngine() {
  return new ArenaEngine();
}

export function registerArenaNamespace(nsp: Namespace, engine: ArenaEngine) {
  engine.onEliminationEvent((event) => {
    nsp.emit(SOCKET_EVENTS.ARENA_ELIMINATED, event);
  });

  engine.onPayoutEvent((events, roundNumber) => {
    nsp.emit(SOCKET_EVENTS.ARENA_PAYOUT, { events, roundNumber });
    // Persist payouts + credit wallets. Winners are matched by username here
    // for prototype simplicity; a production build would key by userId
    // captured at wager time instead of trusting username uniqueness alone.
    for (const ev of events) {
      const user = findUserByUsername(ev.winnerUsername);
      if (!user) continue;
      creditWallet(user.id, ev.amount, 'arena_payout', `round ${roundNumber}`);
      createArenaResult(roundNumber, user.id, ev.amount);
    }
  });

  engine.start();

  // Broadcast the world snapshot to every connected client at the tick rate.
  const snapshotTimer = setInterval(() => {
    nsp.emit(SOCKET_EVENTS.ARENA_SNAPSHOT, engine.getSnapshot());
  }, 1000 / 20);
  nsp.on('close', () => clearInterval(snapshotTimer));

  nsp.on('connection', (socket: Socket) => {
    const data = socket.data as ArenaSocketData;

    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = verifyToken(token);
        data.userId = payload.sub;
        data.username = payload.username;
      } catch {
        /* guest */
      }
    }

    socket.on(SOCKET_EVENTS.ARENA_JOIN, () => {
      // Spectating (receiving snapshots) is free and requires no join at
      // all — the client just doesn't call ARENA_JOIN. Controlling a
      // player is gated behind the Full Access purchase, enforced here
      // server-side so a client can't just skip calling the paywall.
      if (!data.userId) {
        socket.emit(SOCKET_EVENTS.ARENA_JOIN_REJECTED, { reason: 'sign_in_required' });
        return;
      }
      if (!hasFullAccess(data.userId)) {
        socket.emit(SOCKET_EVENTS.ARENA_JOIN_REJECTED, { reason: 'full_access_required' });
        return;
      }
      const username = data.username ?? `${GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)]}Guest${Math.floor(Math.random() * 900 + 100)}`;
      const playerId = engine.addPlayer({ userId: data.userId ?? null, username });
      data.playerId = playerId;
      const ack: ArenaJoinAck = { playerId, arenaWidth: 2000, arenaHeight: 1200 };
      socket.emit(SOCKET_EVENTS.ARENA_JOIN_ACK, ack);
    });

    socket.on(SOCKET_EVENTS.ARENA_INPUT, (input: ArenaInput) => {
      if (!data.playerId) return;
      if (typeof input?.angle !== 'number') return;
      engine.setInput(data.playerId, input);
    });

    socket.on(SOCKET_EVENTS.ARENA_WAGER, async (amount: number) => {
      if (!data.playerId || !data.userId) {
        socket.emit('arena:wager-rejected', { reason: 'Sign in to wager' });
        return;
      }
      const wager = Math.floor(Number(amount));
      if (!Number.isFinite(wager) || wager <= 0) return;

      const debited = tryDebitWallet(data.userId, wager, 'arena_wager', 'arena round wager');
      if (!debited) {
        socket.emit('arena:wager-rejected', { reason: 'Insufficient balance' });
        return;
      }
      engine.addWager(data.playerId, wager);
      socket.emit('arena:wager-accepted', { amount: wager, balance: getWalletBalance(data.userId) });
    });

    socket.on(SOCKET_EVENTS.ARENA_LEAVE, () => {
      if (data.playerId) engine.removePlayer(data.playerId);
      data.playerId = undefined;
    });

    socket.on('disconnect', () => {
      if (data.playerId) engine.removePlayer(data.playerId);
    });
  });
}
