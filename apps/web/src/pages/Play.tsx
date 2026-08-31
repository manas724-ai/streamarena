import ArenaCanvas from '../game/ArenaCanvas';

export default function Play() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="mb-3">
        <h1 className="text-xl font-bold text-white">The Arena</h1>
        <p className="text-sm text-zinc-500">
          One persistent world, no matches, no lobbies — join anytime. Eat orbs to grow, avoid bigger players, eliminate
          smaller ones. Every 60s the wager pot pays out to that round's top wagering players; the world itself never
          resets.
        </p>
      </div>
      <ArenaCanvas fullscreen />
    </div>
  );
}
