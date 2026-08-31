import type { Namespace, Socket } from 'socket.io';
import { verifyToken } from '../lib/auth.js';
import { addViewer, getViewerCount, removeViewer } from './presence.js';
import { SOCKET_EVENTS, type ChatMessage } from '@streamarena/shared';
import { nanoid } from 'nanoid';
import { findUserById } from '../db/repo.js';

// Ring buffer of recent messages per channel so a viewer who just joined
// gets context. At real scale this becomes a Redis LIST (LPUSH + LTRIM)
// shared across API instances instead of process memory.
const HISTORY_LIMIT = 50;
const history = new Map<string, ChatMessage[]>();

function pushHistory(slug: string, msg: ChatMessage) {
  const arr = history.get(slug) ?? [];
  arr.push(msg);
  if (arr.length > HISTORY_LIMIT) arr.shift();
  history.set(slug, arr);
}

interface ChatSocketData {
  channelSlug?: string;
  userId?: string;
  username?: string;
  avatarColor?: string;
}

export function registerChatNamespace(nsp: Namespace) {
  nsp.on('connection', (socket: Socket) => {
    const data = socket.data as ChatSocketData;

    // Optional auth — guests can watch & see chat, only identified users can post.
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = verifyToken(token);
        data.userId = payload.sub;
        data.username = payload.username;
      } catch {
        /* invalid token — treat as guest */
      }
    }

    socket.on(SOCKET_EVENTS.CHAT_JOIN, async (channelSlug: string) => {
      if (typeof channelSlug !== 'string' || !channelSlug) return;
      data.channelSlug = channelSlug;
      socket.join(channelSlug);
      addViewer(channelSlug, socket.id);

      socket.emit(SOCKET_EVENTS.CHAT_HISTORY, history.get(channelSlug) ?? []);
      nsp.to(channelSlug).emit(SOCKET_EVENTS.CHAT_PRESENCE, { channelSlug, viewerCount: getViewerCount(channelSlug) });
    });

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (body: string) => {
      const slug = data.channelSlug;
      if (!slug || !data.userId || !data.username) return;
      const text = (body ?? '').toString().trim().slice(0, 300);
      if (!text) return;

      let avatarColor = data.avatarColor;
      if (!avatarColor) {
        const u = findUserById(data.userId);
        avatarColor = u?.avatarColor ?? '#7c3aed';
        data.avatarColor = avatarColor;
      }

      const msg: ChatMessage = {
        id: nanoid(10),
        channelSlug: slug,
        userId: data.userId,
        username: data.username,
        avatarColor,
        body: text,
        kind: 'chat',
        createdAt: new Date().toISOString(),
      };
      pushHistory(slug, msg);
      nsp.to(slug).emit(SOCKET_EVENTS.CHAT_MESSAGE, msg);
    });

    socket.on(SOCKET_EVENTS.CHAT_LEAVE, () => {
      if (data.channelSlug) {
        socket.leave(data.channelSlug);
        removeViewer(data.channelSlug, socket.id);
        nsp.to(data.channelSlug).emit(SOCKET_EVENTS.CHAT_PRESENCE, {
          channelSlug: data.channelSlug,
          viewerCount: getViewerCount(data.channelSlug),
        });
      }
    });

    socket.on('disconnect', () => {
      if (data.channelSlug) {
        removeViewer(data.channelSlug, socket.id);
        nsp.to(data.channelSlug).emit(SOCKET_EVENTS.CHAT_PRESENCE, {
          channelSlug: data.channelSlug,
          viewerCount: getViewerCount(data.channelSlug),
        });
      }
    });
  });
}
