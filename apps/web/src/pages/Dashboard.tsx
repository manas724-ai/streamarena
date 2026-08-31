import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import type { ChannelSummary } from '@streamarena/shared';
import VideoBroadcast from '../components/VideoBroadcast';

export default function Dashboard() {
  const { user, token, loading } = useAuth();
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<ChannelSummary>(`/api/channels/${user.username}`).then((c) => {
      setChannel(c);
      setTitle(c.title);
      setTags(c.tags.join(', '));
    });
  }, [user]);

  // Wait for AuthProvider to finish restoring the session from storage
  // before deciding whether to bounce to /login — otherwise a hard page
  // load (not a client-side nav) briefly sees user=null and redirects a
  // perfectly logged-in user.
  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-zinc-500">Loading…</div>;
  if (!user || !token) return <Navigate to="/login" replace />;
  if (!channel) return <div className="mx-auto max-w-4xl px-4 py-16 text-zinc-500">Loading…</div>;

  async function toggleLive() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<ChannelSummary>(`/api/channels/me/${channel!.isLive ? 'end-live' : 'go-live'}`, undefined, token);
      setChannel(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update stream');
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<ChannelSummary>(
        '/api/channels/me',
        { title, tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5) },
        token,
      );
      setChannel(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Creator dashboard</h1>
        <Link to={`/watch/${channel.slug}`} className="text-sm text-violet-400 hover:text-violet-300">
          View my channel page →
        </Link>
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">
            Status:{' '}
            <span className={channel.isLive ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
              {channel.isLive ? 'LIVE' : 'Offline'}
            </span>
          </p>
          {channel.isLive && <p className="text-xs text-zinc-600">Started {new Date(channel.startedAt!).toLocaleTimeString()}</p>}
        </div>
        <button onClick={toggleLive} disabled={busy} className={channel.isLive ? 'btn-secondary' : 'btn-primary'}>
          {channel.isLive ? 'End stream' : 'Go live'}
        </button>
      </div>

      <VideoBroadcast channelSlug={channel.slug} live={channel.isLive} />

      <form onSubmit={saveMeta} className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-zinc-300">Stream details</p>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" maxLength={80} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Tags (comma-separated, up to 5)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="arena, wagers, chill" />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="btn-primary">
          Save
        </button>
      </form>

      <div className="card p-4 text-sm text-zinc-400">
        <p className="font-semibold text-zinc-300 mb-1">How viewers reach you</p>
        <p>
          Your channel URL is <code className="text-zinc-300">/watch/{channel.slug}</code>. Go live, then open that URL in
          another browser (or tab) to see the WebRTC broadcast + chat + arena all connect live.
        </p>
      </div>
    </div>
  );
}
