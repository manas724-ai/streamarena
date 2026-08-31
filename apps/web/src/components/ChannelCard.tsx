import { Link } from 'react-router-dom';
import type { ChannelSummary } from '@streamarena/shared';

export default function ChannelCard({ channel }: { channel: ChannelSummary }) {
  return (
    <Link
      to={`/watch/${channel.slug}`}
      className="group card overflow-hidden hover:border-violet-500/60 transition-colors"
    >
      <div className="relative aspect-video bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950 flex items-center justify-center overflow-hidden">
        <ArenaGlyph seed={channel.slug} />
        {channel.isLive && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Live
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-zinc-200">
          {channel.viewerCount.toLocaleString()} watching
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-white">{channel.title}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{channel.streamerUsername}</p>
        {channel.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {channel.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// Deterministic little abstract blob per channel so the discovery grid
// doesn't look empty without real thumbnail infrastructure wired up yet.
function ArenaGlyph({ seed }: { seed: string }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <div
      className="h-16 w-16 rounded-full opacity-70 blur-xl"
      style={{ background: `hsl(${hue}, 80%, 60%)` }}
    />
  );
}
