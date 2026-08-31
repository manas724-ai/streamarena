import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';

interface TicketRow {
  id: string;
  channel: 'email' | 'chat';
  subject: string;
  category: string;
  status: 'open' | 'escalated' | 'resolved';
  requiresHuman: boolean;
  escalationReason: string | null;
  requesterEmail: string | null;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  sender: string;
  body: string;
  createdAt: string;
}

// Human oversight surface for the AI-managed support desk — "100%
// AI-managed" doesn't mean zero visibility. Staff (listed in the
// ADMIN_USERNAMES env var) can see every ticket, what the AI said, and
// pick up anything triage flagged for a human. Not linked from the navbar
// on purpose; visit /admin/support directly.
export default function AdminSupport() {
  const { user, token, loading } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reply, setReply] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [filter, setFilter] = useState<'all' | 'escalated'>('escalated');

  useEffect(() => {
    if (!token) return;
    const query = filter === 'escalated' ? '?requiresHuman=true' : '';
    api
      .get<TicketRow[]>(`/api/support/tickets${query}`, token)
      .then(setTickets)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setForbidden(true);
      });
  }, [token, filter]);

  function openTicket(t: TicketRow) {
    setSelected(t);
    api.get<{ ticket: TicketRow; messages: MessageRow[] }>(`/api/support/tickets/${t.id}`, token).then((res) => {
      setMessages(res.messages);
    });
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    await api.post(`/api/support/tickets/${selected.id}/reply`, { body: reply }, token);
    setReply('');
    openTicket(selected);
  }

  async function resolve() {
    if (!selected) return;
    await api.post(`/api/support/tickets/${selected.id}/resolve`, undefined, token);
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, status: 'resolved' } : t)));
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-16 text-zinc-500">Loading…</div>;
  if (!user || !token) return <Navigate to="/login" replace />;
  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-400">
        <p className="text-lg font-semibold text-white">Not authorized</p>
        <p className="mt-2 text-sm">
          Add your username to <code className="text-zinc-300">ADMIN_USERNAMES</code> in <code className="text-zinc-300">apps/api/.env</code> to
          access the Support Inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold text-white mb-1">Support Inbox</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Every ticket the AI agent has handled — escalated ones need a human reply below.
      </p>

      <div className="mb-3 flex gap-2 text-xs">
        <button
          onClick={() => setFilter('escalated')}
          className={filter === 'escalated' ? 'btn-primary px-3 py-1' : 'btn-secondary px-3 py-1'}
        >
          Needs human
        </button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'btn-primary px-3 py-1' : 'btn-secondary px-3 py-1'}>
          All tickets
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="card divide-y divide-zinc-800 max-h-[70vh] overflow-y-auto">
          {tickets.length === 0 && <p className="p-4 text-sm text-zinc-500">Nothing here.</p>}
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className={`w-full text-left px-3 py-2.5 hover:bg-zinc-900 transition-colors ${selected?.id === t.id ? 'bg-zinc-900' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-100 truncate">{t.subject}</span>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {t.channel} · {t.category} {t.requesterEmail ? `· ${t.requesterEmail}` : ''}
              </p>
            </button>
          ))}
        </div>

        <div className="card p-4 min-h-[300px]">
          {!selected ? (
            <p className="text-sm text-zinc-500">Select a ticket to view the thread.</p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{selected.subject}</p>
                  {selected.escalationReason && <p className="text-xs text-amber-400 mt-0.5">Escalated: {selected.escalationReason}</p>}
                </div>
                {selected.status !== 'resolved' && (
                  <button onClick={resolve} className="btn-secondary text-xs px-3 py-1.5">
                    Mark resolved
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-2">
                {messages.map((m) => (
                  <div key={m.id} className="text-xs">
                    <span className="font-semibold text-zinc-400">{SENDER_LABEL[m.sender] ?? m.sender}: </span>
                    <span className="text-zinc-300 whitespace-pre-wrap">{m.body}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-zinc-800 pt-2 mt-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as human_agent…" className="input flex-1 text-xs" />
                <button onClick={sendReply} disabled={!reply.trim()} className="btn-primary text-xs px-3">
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SENDER_LABEL: Record<string, string> = {
  requester: 'Requester',
  ai_agent: 'AI Agent',
  human_agent: 'You (human)',
  system: 'System',
};

function StatusBadge({ status }: { status: TicketRow['status'] }) {
  const styles = {
    open: 'bg-emerald-500/20 text-emerald-400',
    escalated: 'bg-amber-500/20 text-amber-400',
    resolved: 'bg-zinc-700/40 text-zinc-400',
  }[status];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${styles}`}>{status}</span>;
}
