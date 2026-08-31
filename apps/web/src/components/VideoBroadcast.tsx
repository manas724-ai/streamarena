import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectNamespace } from '../lib/socket';
import { SOCKET_EVENTS } from '@streamarena/shared';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Streamer side of the browser-native WebRTC broadcast. One RTCPeerConnection
// per viewer (mesh fan-out) — see rtcSignaling.ts on the server for why this
// is the right shape for a prototype and what swaps in at real scale.
export default function VideoBroadcast({ channelSlug, live }: { channelSlug: string; live: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [capturing, setCapturing] = useState(false);
  const [viewerPeerCount, setViewerPeerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'camera' | 'screen'>('camera');

  useEffect(() => {
    const socket = connectNamespace('/rtc');
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.RTC_VIEWER_JOIN, async (viewerId: string) => {
      const stream = streamRef.current;
      if (!stream) return;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(viewerId, pc);
      setViewerPeerCount(peersRef.current.size);

      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit(SOCKET_EVENTS.RTC_ICE_CANDIDATE, { to: viewerId, candidate: e.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) {
          peersRef.current.delete(viewerId);
          setViewerPeerCount(peersRef.current.size);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit(SOCKET_EVENTS.RTC_OFFER, { to: viewerId, sdp: offer });
    });

    socket.on(SOCKET_EVENTS.RTC_ANSWER, async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peersRef.current.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on(SOCKET_EVENTS.RTC_ICE_CANDIDATE, async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(from);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on(SOCKET_EVENTS.RTC_VIEWER_LEFT, (viewerId: string) => {
      peersRef.current.get(viewerId)?.close();
      peersRef.current.delete(viewerId);
      setViewerPeerCount(peersRef.current.size);
    });

    return () => {
      for (const pc of peersRef.current.values()) pc.close();
      peersRef.current.clear();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (live && streamRef.current) {
      socketRef.current?.emit(SOCKET_EVENTS.RTC_BROADCASTER_READY, channelSlug);
    }
  }, [live, channelSlug, capturing]);

  async function startCapture(kind: 'camera' | 'screen') {
    setError(null);
    try {
      const stream =
        kind === 'camera'
          ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      setSource(kind);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCapturing(true);
      if (live) socketRef.current?.emit(SOCKET_EVENTS.RTC_BROADCASTER_READY, channelSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access camera/screen');
    }
  }

  function stopCapture() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    for (const pc of peersRef.current.values()) pc.close();
    peersRef.current.clear();
    setViewerPeerCount(0);
    setCapturing(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-contain" />
        {!capturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-zinc-400">
            <p>Camera is off</p>
            <div className="flex gap-2">
              <button onClick={() => startCapture('camera')} className="btn-primary">
                Start camera
              </button>
              <button onClick={() => startCapture('screen')} className="btn-secondary">
                Share screen
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-400">
        <span>
          {capturing ? `Broadcasting (${source}) · ${viewerPeerCount} peer connection(s)` : 'Not broadcasting'}
          {!live && capturing && ' · go live to let viewers connect'}
        </span>
        {capturing && (
          <button onClick={stopCapture} className="text-red-400 hover:text-red-300">
            Stop
          </button>
        )}
      </div>
      {error && <p className="px-3 pb-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
