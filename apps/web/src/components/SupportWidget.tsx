import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectNamespace } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { SOCKET_EVENTS, type SupportChatMessage, type SupportTicketInfo } from '@streamarena/shared';

const STORAGE_KEY = 'streamarena.support.ticketId';

// A floating AI-agent-backed support chat, available everywhere in the
// app (mounted once in App.tsx) — this is the "live chat... self
// triggered AI agent" surface. Every message is triaged server-side
// (support/triage.ts) before the AI responds; if a message gets escalated,
// the widget says so plainly rather than pretending a human is typing.
export default function SupportWidget() {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [ticketInfo, setTicketInfo] = useState<SupportTicketInfo | null>(null);
  const [draft, setDraft] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const socket = connectNamespace('/support', token);
    socketRef.current = socket;

    socket.on('connect', () => {
      const savedTicketId = sessionStorage.getItem(STORAGE_KEY);
      if (savedTicketId) socket.emit(SOCKET_EVENTS.SUPPORT_JOIN, savedTicketId);
    });

    socket.on(SOCKET_EVENTS.SUPPORT_TICKET_INFO, (info: SupportTicketInfo) => {
      setTicketInfo(info);
      sessionStorage.setItem(STORAGE_KEY, info.id);
    });
    socket.on(SOCKET_EVENTS.SUPPORT_MESSAGE, (m: SupportChatMessage) => {
      setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
    });
    socket.on(SOCKET_EVENTS.SUPPORT_AGENT_TYPING, (typing: boolean) => setAgentTyping(typing));
    socket.on(SOCKET_EVENTS.SUPPORT_ESCALATED, () => {
      /* the ai_agent acknowledgment message already explains this — ticketInfo.status covers the badge */
    });

    return () => {
      socket.disconnect();
    };
  }, [open, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, agentTyping]);

  function send() {
    const text = draft.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit(SOCKET_EVENTS.SUPPORT_MESSAGE, text);
    setDraft('');
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-2 flex h-[480px] w-80 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-zinc-100">StreamArena Support</p>
              <p className="text-[11px] text-zinc-500">
                {ticketInfo?.status === 'escalated' ? 'Escalated to a human — AI acknowledged' : 'AI agent · usually replies instantly'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300" aria-label="Close">
              ✕
            </button>
          </div>

          <div ref={listRef} className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-500">
                Hi{user ? ` ${user.displayName}` : ''} — ask about your account, streaming setup, sparks/purchases, or
                the Arena. Sensitive requests (refunds, safety, legal) get flagged for a human automatically.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'requester' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                    m.sender === 'requester'
                      ? 'bg-violet-600 text-white'
                      : m.sender === 'system'
                        ? 'bg-zinc-800/60 text-zinc-400 italic'
                        : 'bg-zinc-800 text-zinc-100'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ))}
            {agentTyping && <p className="text-[11px] text-zinc-500">Agent is typing…</p>}
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
              placeholder="Message support…"
              maxLength={2000}
              className="input flex-1 text-xs"
            />
            <button className="btn-primary px-3 text-xs" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-xl text-white shadow-lg hover:bg-violet-500 transition-colors"
        aria-label="Open support chat"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
