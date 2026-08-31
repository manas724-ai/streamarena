import { useState } from 'react';
import { GIFT_CATALOG } from '@streamarena/shared';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { Link } from 'react-router-dom';

export default function GiftBar({ channelSlug, disabled }: { channelSlug: string; disabled?: boolean }) {
  const { token, balance, setBalance } = useAuth();
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function sendGift(giftId: string) {
    if (!token) return;
    setSending(giftId);
    setError(null);
    try {
      const res = await api.post<{ balance: number }>('/api/wallet/gift', { channelSlug, giftId }, token);
      setBalance(res.balance);
      const gift = GIFT_CATALOG.find((g) => g.id === giftId);
      setFlash(`Sent ${gift?.emoji} ${gift?.name}!`);
      setTimeout(() => setFlash(null), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send gift');
    } finally {
      setSending(null);
    }
  }

  if (!token) {
    return (
      <div className="card flex items-center justify-between px-3 py-2 text-sm text-zinc-500">
        <span>
          <Link to="/login" className="text-violet-400 hover:text-violet-300">
            Log in
          </Link>{' '}
          to send gifts
        </span>
      </div>
    );
  }

  return (
    <div className="card px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Send a gift</span>
        {flash ? (
          <span className="text-xs text-emerald-400">{flash}</span>
        ) : (
          <span className="text-xs text-zinc-500">Balance: ✨{balance.toLocaleString()}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {GIFT_CATALOG.map((g) => (
          <button
            key={g.id}
            disabled={disabled || sending !== null || balance < g.cost}
            onClick={() => sendGift(g.id)}
            title={`${g.name} — ${g.cost} sparks`}
            className="flex flex-col items-center rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs hover:border-amber-400/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-lg">{g.emoji}</span>
            <span className="mt-0.5 text-zinc-300">{g.cost}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
