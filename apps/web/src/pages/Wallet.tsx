import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { CURRENCY_PACKS, FULL_ACCESS_PRODUCT } from '@streamarena/shared';

interface TxRow {
  id: string;
  type: string;
  amount: number;
  meta: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  signup_bonus: 'Welcome bonus',
  purchase: 'Purchased sparks',
  gift_sent: 'Gift sent',
  gift_received: 'Gift received',
  arena_wager: 'Arena wager',
  arena_payout: 'Arena payout',
  full_access_purchase: 'Full Access Pass purchased',
};

export default function WalletPage() {
  const { user, token, balance, setBalance, setFullAccess, loading } = useAuth();
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyingFullAccess, setBuyingFullAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get<TxRow[]>('/api/wallet/me/transactions', token).then(setTransactions);
  }, [token, balance]);

  // See Dashboard.tsx for why this waits on `loading` before redirecting.
  if (loading) return <div className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">Loading…</div>;
  if (!user || !token) return <Navigate to="/login" replace />;

  async function buy(packId: string) {
    setBuying(packId);
    setError(null);
    try {
      const res = await api.post<{ balance: number }>('/api/wallet/purchase', { packId }, token);
      setBalance(res.balance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purchase failed');
    } finally {
      setBuying(null);
    }
  }

  async function buyFullAccess() {
    setBuyingFullAccess(true);
    setError(null);
    try {
      const res = await api.post<{ fullAccessGranted: boolean }>('/api/wallet/purchase-full-access', undefined, token);
      setFullAccess(res.fullAccessGranted);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purchase failed');
    } finally {
      setBuyingFullAccess(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Wallet</h1>
        <p className="text-sm text-zinc-500">
          Balance: <span className="text-amber-300 font-semibold">✨ {balance.toLocaleString()} sparks</span>
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Full Access</h2>
        {user.fullAccessGranted ? (
          <div className="card p-4 flex items-center gap-2 text-sm text-emerald-400">
            <span>✓</span> You have Full Access — you can play in the Arena any time.
          </div>
        ) : (
          <div className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{FULL_ACCESS_PRODUCT.name} — ${FULL_ACCESS_PRODUCT.priceUsd}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{FULL_ACCESS_PRODUCT.description} One-time purchase, applies to your account immediately.</p>
            </div>
            <button onClick={buyFullAccess} disabled={buyingFullAccess} className="btn-primary shrink-0">
              {buyingFullAccess ? 'Processing…' : 'Unlock'}
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Buy sparks</h2>
        <p className="text-xs text-zinc-600 mb-3">
          Checkout runs through a mock payment provider in this build (see README) — it succeeds instantly so the flow
          can be tested end-to-end without live payment credentials. Swapping in Stripe changes one file.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CURRENCY_PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => buy(p.id)}
              disabled={buying !== null}
              className="card p-3 text-left hover:border-amber-400/60 disabled:opacity-50 transition-colors"
            >
              <p className="text-lg font-bold text-amber-300">✨ {p.sparks.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">${p.priceUsd.toFixed(2)}</p>
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Recent activity</h2>
        <div className="card divide-y divide-zinc-800">
          {transactions.length === 0 && <p className="p-4 text-sm text-zinc-500">No transactions yet.</p>}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <p className="text-zinc-200">{TYPE_LABEL[tx.type] ?? tx.type}</p>
                <p className="text-xs text-zinc-600">{new Date(tx.created_at).toLocaleString()}</p>
              </div>
              <span className={tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {tx.amount >= 0 ? '+' : ''}
                {tx.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
