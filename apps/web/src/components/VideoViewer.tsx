import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectNamespace } from '../lib/socket';
import { SOCKET_EVENTS } from '@streamarena/shared';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function VideoViewer({ channelSlug, isLive }: { channelSlug: string; isLive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'live' | 'offline'>('waiting');

  useEffect(() => {
    if (!isLive) {
      setStatus('offline');
      return;
    }
    setStatus('waiting');

    const socket = connectNamespace('/rtc');
    socketRef.current = socket;

    socket.on('connect', () => socket.emit(SOCKET_EVENTS.RTC_VIEWER_JOIN, channelSlug));

    socket.on(SOCKET_EVENTS.RTC_OFFER, async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      setStatus('connecting');
      broadcasterIdRef.current = from;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(() => {});
        }
        setStatus('live');
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit(SOCKET_EVENTS.RTC_ICE_CANDIDATE, { to: from, candidate: e.candidate });
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(SOCKET_EVENTS.RTC_ANSWER, { to: from, sdp: answer });
    });

    socket.on(SOCKET_EVENTS.RTC_ICE_CANDIDATE, async ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on(SOCKET_EVENTS.RTC_BROADCASTER_LEFT, () => {
      setStatus('offline');
      pcRef.current?.close();
      pcRef.current = null;
    });

    return () => {
      pcRef.current?.close();
      pcRef.current = null;
      socket.disconnect();
    };
  }, [channelSlug, isLive]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
      <video ref={videoRef} playsInline className="h-full w-full object-contain" />
      {status !== 'live' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-zinc-400">
          {status === 'offline' && 'Stream is offline'}
          {status === 'waiting' && 'Waiting for the broadcaster…'}
          {status === 'connecting' && 'Connecting…'}
        </div>
      )}
    </div>
  );
}
