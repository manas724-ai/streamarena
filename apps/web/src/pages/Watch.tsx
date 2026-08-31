import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { ChannelSummary } from '@streamarena/shared';
import { useAuth } from '../context/AuthContext';
import ChatPanel from '../components/ChatPanel';
import GiftBar from '../components/GiftBar';
import VideoViewer from '../components/VideoViewer';
import VideoBroadcast from '../components/VideoBroadcast';
import ArenaCanvas from '../game/ArenaCanvas';

export default function Watch() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showArena, setShowArena] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    function poll() {
      api
        .get<ChannelSummary>(`/api/channels/${slug}`)
        .then((c) => !cancelled && setChannel(c))
        .catch(() => !cancelled && setNotFound(true));
    }
    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  if (notFound) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-zinc-400">Channel not found.</div>;
  }
  if (!channel || !slug) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-zinc-500">Loading…</div>;
  }

  const isOwnChannel = user?.username === channel.streamerUsername;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="min-w-0 space-y-3">
          {isOwnChannel ? (
            <VideoBroadcast channelSlug={channel.slug} live={channel.isLive} />
          ) : (
            <VideoViewer channelSlug={channel.slug} isLive={channel.isLive} />
          )}

          <div>
            <div className="flex items-center gap-2">
              {channel.isLive && (
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Live</span>
              )}
              <h1 className="text-lg font-bold text-white truncate">{channel.title}</h1>
            </div>
            <p className="text-sm text-zinc-500">
              {channel.streamerUsername} · {channel.viewerCount.toLocaleString()} watching
            </p>
          </div>

          <GiftBar channelSlug={channel.slug} disabled={isOwnChannel} />

          <div className="card p-3">
            <button
              onClick={() => setShowArena((v) => !v)}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {showArena ? 'Hide' : 'Play alongside stream —'} the endless Arena{' '}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </button>
            {showArena && (
              <div className="mt-3">
                <ArenaCanvas />
              </div>
            )}
          </div>
        </div>

        <div className="h-[70vh] lg:h-[calc(100vh-140px)]">
          <ChatPanel channelSlug={channel.slug} />
        </div>
      </div>
    </div>
  );
}
