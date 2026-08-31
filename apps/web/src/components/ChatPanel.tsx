import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectNamespace } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { SOCKET_EVENTS, type ChatMessage, type GiftDef } from '@streamarena/shared';

interface GiftReceivedPayload {
  channelSlug: string;
  fromUsername: string;
  gift: GiftDef;
}

export default function ChatPanel({ channelSlug }: { channelSlug: string }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = connectNamespace('/chat', token);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.CHAT_JOIN, channelSlug);
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(SOCKET_EVENTS.CHAT_HISTORY, (history: ChatMessage[]) => setMessages(history));
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (msg: ChatMessage) => setMessages((prev) => [...prev.slice(-199), msg]));
    socket.on(SOCKET_EVENTS.CHAT_PRESENCE, (p: { viewerCount: number }) => setViewerCount(p.viewerCount));
    socket.on(SOCKET_EVENTS.GIFT_RECEIVED, (payload: GiftReceivedPayload) => {
      setMessages((prev) => [
        ...prev.slice(-199),
        {
          id: `gift-${Date.now()}-${Math.random()}`,
          channelSlug,
          userId: 'system',
          username: payload.fromUsername,
          avatarColor: '#f59e0b',
          body: `sent ${payload.gift.emoji} ${payload.gift.name} (${payload.gift.cost} sparks)`,
          kind: 'gift',
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    return () => {
      socket.emit(SOCKET_EVENTS.CHAT_LEAVE);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelSlug, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit(SOCKET_EVENTS.CHAT_MESSAGE, text);
    setDraft('');
  }

  return (
    <div className="card flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-sm font-semibold text-zinc-200">Stream chat</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          {viewerCount.toLocaleString()} watching
        </span>
      </div>

      <div ref={listRef} className="scrollbar-thin flex-1 min-h-0 space-y-1.5 overflow-y-auto px-3 py-2">
        {messages.length === 0 && <p className="text-xs text-zinc-600">No messages yet — say hi.</p>}
        {messages.map((m) => (
          <p key={m.id} className="text-sm leading-snug break-words">
            <span style={{ color: m.avatarColor }} className="font-semibold">
              {m.username}
            </span>
            {m.kind === 'gift' ? (
              <span className="text-amber-300"> {m.body}</span>
            ) : (
              <span className="text-zinc-300">: {m.body}</span>
            )}
          </p>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-zinc-800 p-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder={token ? 'Send a message' : 'Log in to chat'}
          disabled={!token}
          className="input flex-1"
        />
        <button disabled={!token || !draft.trim()} className="btn-primary px-3">
          Send
        </button>
      </form>
    </div>
  );
}
