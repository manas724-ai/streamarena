// In-memory presence counters, keyed by channel slug and by socket id so a
// disconnect always cleans up correctly. For a multi-instance deployment
// this moves to Redis (INCR/DECR + a per-socket key with TTL) — the call
// sites below don't change, only the storage backing them.

const viewersByChannel = new Map<string, Set<string>>();

export function addViewer(channelSlug: string, socketId: string) {
  if (!viewersByChannel.has(channelSlug)) viewersByChannel.set(channelSlug, new Set());
  viewersByChannel.get(channelSlug)!.add(socketId);
}

export function removeViewer(channelSlug: string, socketId: string) {
  viewersByChannel.get(channelSlug)?.delete(socketId);
}

export function getViewerCount(channelSlug: string): number {
  return viewersByChannel.get(channelSlug)?.size ?? 0;
}

export function removeViewerFromAll(socketId: string) {
  for (const set of viewersByChannel.values()) set.delete(socketId);
}
