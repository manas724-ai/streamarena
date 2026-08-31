import type { Namespace, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@streamarena/shared';

// Pure signaling relay for browser-native WebRTC. The server never touches
// media — it only forwards SDP offers/answers and ICE candidates between a
// broadcaster and each viewer, then the two browsers exchange video/audio
// peer-to-peer (mesh topology: the streamer opens one RTCPeerConnection per
// viewer). This is genuinely functional and needs zero native dependencies,
// which is exactly why it's the right shape for a prototype.
//
// It does not scale past a few dozen concurrent viewers on one streamer's
// upload bandwidth — see README.md "Scaling to production" for the SFU
// (mediasoup/LiveKit) swap-in that removes that ceiling without touching
// this event contract on the client side.

interface RtcSocketData {
  channelSlug?: string;
  role?: 'broadcaster' | 'viewer';
}

// channelSlug -> broadcaster socket id
const broadcasters = new Map<string, string>();

export function registerRtcNamespace(nsp: Namespace) {
  nsp.on('connection', (socket: Socket) => {
    const data = socket.data as RtcSocketData;

    socket.on(SOCKET_EVENTS.RTC_BROADCASTER_READY, (channelSlug: string) => {
      data.channelSlug = channelSlug;
      data.role = 'broadcaster';
      broadcasters.set(channelSlug, socket.id);
      socket.join(`rtc:${channelSlug}`);
    });

    socket.on(SOCKET_EVENTS.RTC_VIEWER_JOIN, (channelSlug: string) => {
      data.channelSlug = channelSlug;
      data.role = 'viewer';
      socket.join(`rtc:${channelSlug}`);
      const broadcasterId = broadcasters.get(channelSlug);
      if (broadcasterId) {
        nsp.to(broadcasterId).emit(SOCKET_EVENTS.RTC_VIEWER_JOIN, socket.id);
      }
    });

    socket.on(SOCKET_EVENTS.RTC_OFFER, ({ to, sdp }: { to: string; sdp: unknown }) => {
      nsp.to(to).emit(SOCKET_EVENTS.RTC_OFFER, { from: socket.id, sdp });
    });

    socket.on(SOCKET_EVENTS.RTC_ANSWER, ({ to, sdp }: { to: string; sdp: unknown }) => {
      nsp.to(to).emit(SOCKET_EVENTS.RTC_ANSWER, { from: socket.id, sdp });
    });

    socket.on(SOCKET_EVENTS.RTC_ICE_CANDIDATE, ({ to, candidate }: { to: string; candidate: unknown }) => {
      nsp.to(to).emit(SOCKET_EVENTS.RTC_ICE_CANDIDATE, { from: socket.id, candidate });
    });

    socket.on('disconnect', () => {
      if (data.role === 'broadcaster' && data.channelSlug) {
        broadcasters.delete(data.channelSlug);
        nsp.to(`rtc:${data.channelSlug}`).emit(SOCKET_EVENTS.RTC_BROADCASTER_LEFT);
      } else if (data.role === 'viewer' && data.channelSlug) {
        const broadcasterId = broadcasters.get(data.channelSlug);
        if (broadcasterId) nsp.to(broadcasterId).emit(SOCKET_EVENTS.RTC_VIEWER_LEFT, socket.id);
      }
    });
  });
}
