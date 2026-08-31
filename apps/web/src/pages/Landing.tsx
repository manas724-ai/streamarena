import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ChannelSummary } from '@streamarena/shared';
import ChannelCard from '../components/ChannelCard';

export default function Landing() {
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ChannelSummary[]>('/api/channels')
      .then((data) => !cancelled && setChannels(data))
      .catch(() => !cancelled && setError('Could not reach the API — is apps/api running?'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const live = channels.filter((c) => c.isLive);
  const offline = channels.filter((c) => !c.isLive);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950/60 via-zinc-950 to-zinc-950 p-8 md:p-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Live · Multiplayer · Never ends</p>
        <h1 className="mt-3 max-w-2xl text-3xl md:text-5xl font-extrabold text-white leading-tight">
          Watch live streams. Chat. Gift. Then drop into the Arena yourself.
        </h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          The Arena is a single persistent multiplayer world that never resets — join mid-round, grow, wager sparks,
          climb the live leaderboard, all while chatting with a stream in the same window.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/arena" className="btn-primary text-base px-6 py-3">
            ▶ Jump into the Arena
          </Link>
          <a href="#live" className="btn-secondary text-base px-6 py-3">
            Browse live channels
          </a>
        </div>
      </section>

      {error && (
        <p className="mt-8 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          {error}
        </p>
      )}

      <section id="live" className="mt-10">
        <h2 className="text-lg font-bold text-white mb-4">
          Live now {live.length > 0 && <span className="text-zinc-500 font-normal">({live.length})</span>}
        </h2>
        {loading ? (
          <SkeletonGrid />
        ) : live.length === 0 ? (
          <EmptyState text="No one is live yet. Run the seed script, or go live yourself from the Creator Dashboard." />
        ) : (
          <Grid channels={live} />
        )}
      </section>

      {offline.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-white mb-4">Offline channels</h2>
          <Grid channels={offline} />
        </section>
      )}
    </div>
  );
}

function Grid({ channels }: { channels: ChannelSummary[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {channels.map((c) => (
        <ChannelCard key={c.id} channel={c} />
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card aspect-[4/5] animate-pulse bg-zinc-900/60" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="card p-8 text-center text-sm text-zinc-500">{text}</div>;
}
