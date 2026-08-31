import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { connectNamespace } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  FULL_ACCESS_PRODUCT,
  SOCKET_EVENTS,
  type ArenaEliminationEvent,
  type ArenaJoinAck,
  type ArenaPayoutEvent,
  type ArenaSnapshot,
} from '@streamarena/shared';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

// A compact, embeddable version can be used on the Watch page (spectate a
// stream while the arena runs alongside chat); `fullscreen` widens controls
// and the leaderboard for the standalone /arena page.
export default function ArenaCanvas({ fullscreen = false }: { fullscreen?: boolean }) {
  const { token, user, balance, setBalance, setFullAccess } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const snapshotRef = useRef<ArenaSnapshot | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const inputRef = useRef({ angle: 0, boost: false });
  const pointerRef = useRef({ x: 0, y: 0, active: false });

  const [joined, setJoined] = useState(false);
  const [joinRejected, setJoinRejected] = useState<'sign_in_required' | 'full_access_required' | null>(null);
  const [buyingFullAccess, setBuyingFullAccess] = useState(false);
  const [wagerInput, setWagerInput] = useState(50);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, forceTick] = useState(0); // cheap re-render pulse for leaderboard/round HUD

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // ---- socket lifecycle ---------------------------------------------------
  useEffect(() => {
    const socket = connectNamespace('/arena', token);
    socketRef.current = socket;

    socket.on('connect', () => socket.emit(SOCKET_EVENTS.ARENA_JOIN));

    socket.on(SOCKET_EVENTS.ARENA_JOIN_ACK, (ack: ArenaJoinAck) => {
      playerIdRef.current = ack.playerId;
      setJoined(true);
      setJoinRejected(null);
    });

    socket.on(SOCKET_EVENTS.ARENA_JOIN_REJECTED, ({ reason }: { reason: 'sign_in_required' | 'full_access_required' }) => {
      setJoinRejected(reason);
    });

    socket.on(SOCKET_EVENTS.ARENA_SNAPSHOT, (snap: ArenaSnapshot) => {
      snapshotRef.current = snap;
      if (snap.tick % 10 === 0) forceTick((n) => n + 1); // refresh leaderboard/HUD ~2x/s
    });

    socket.on(SOCKET_EVENTS.ARENA_ELIMINATED, (ev: ArenaEliminationEvent) => {
      const mine = playerIdMatchesUsername(ev.victim, snapshotRef.current, playerIdRef.current);
      pushToast(
        ev.killer ? `${ev.victim} was eliminated by ${ev.killer}` : `${ev.victim} was eliminated`,
        mine ? 'bad' : 'info',
      );
    });

    socket.on(SOCKET_EVENTS.ARENA_PAYOUT, ({ events }: { events: ArenaPayoutEvent[]; roundNumber: number }) => {
      const mine = events.find((e) => e.winnerUsername === user?.username);
      if (mine) {
        pushToast(`Round payout: +${mine.amount} sparks!`, 'good');
        setBalance(balance + mine.amount);
      } else if (events.length) {
        pushToast(`Round ended — ${events.length} wagerer(s) paid out`, 'info');
      }
    });

    socket.on('arena:wager-accepted', ({ amount, balance: newBalance }: { amount: number; balance?: number }) => {
      pushToast(`Wagered ${amount} sparks into the pot`, 'good');
      if (typeof newBalance === 'number') setBalance(newBalance);
    });
    socket.on('arena:wager-rejected', ({ reason }: { reason: string }) => pushToast(reason, 'bad'));

    return () => {
      socket.emit(SOCKET_EVENTS.ARENA_LEAVE);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- input: pointer angle, sent at a steady rate --------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function updateAngleFromPointer(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      inputRef.current.angle = Math.atan2(dy, dx);
    }

    function onMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
      updateAngleFromPointer(e.clientX, e.clientY);
    }
    function onDown() {
      inputRef.current.boost = true;
    }
    function onUp() {
      inputRef.current.boost = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') inputRef.current.boost = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') inputRef.current.boost = false;
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const sendInterval = setInterval(() => {
      socketRef.current?.emit(SOCKET_EVENTS.ARENA_INPUT, inputRef.current);
    }, 50);

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(sendInterval);
    };
  }, []);

  // ---- render loop -----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = container!.clientWidth * dpr;
      canvas!.height = container!.clientHeight * dpr;
      canvas!.style.width = `${container!.clientWidth}px`;
      canvas!.style.height = `${container!.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function draw() {
      const snap = snapshotRef.current;
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      ctx.fillStyle = '#0b0b12';
      ctx.fillRect(0, 0, w, h);

      if (snap) {
        const me = snap.players.find((p) => p.id === playerIdRef.current);
        const camX = (me?.x ?? ARENA_WIDTH / 2) - w / 2;
        const camY = (me?.y ?? ARENA_HEIGHT / 2) - h / 2;

        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        const gridSize = 80;
        const startX = -((camX % gridSize) + gridSize) % gridSize;
        const startY = -((camY % gridSize) + gridSize) % gridSize;
        for (let x = startX; x < w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = startY; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // arena bounds
        ctx.strokeStyle = 'rgba(124,58,237,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(-camX, -camY, ARENA_WIDTH, ARENA_HEIGHT);

        // orbs
        for (const orb of snap.orbs) {
          const x = orb.x - camX;
          const y = orb.y - camY;
          if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
          ctx.beginPath();
          ctx.fillStyle = orb.value >= 3 ? '#f59e0b' : orb.value === 2 ? '#22d3ee' : '#a78bfa';
          ctx.arc(x, y, 3 + orb.value, 0, Math.PI * 2);
          ctx.fill();
        }

        // players
        for (const p of snap.players) {
          if (!p.alive) continue;
          const x = p.x - camX;
          const y = p.y - camY;
          if (x < -60 || x > w + 60 || y < -60 || y > h + 60) continue;

          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.id === playerIdRef.current ? 1 : 0.9;
          ctx.arc(x, y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;

          if (p.id === playerIdRef.current) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          if (p.boosted) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, p.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.font = '12px ui-sans-serif, system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(p.username, x, y - p.radius - 8);
        }
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  function sendWager() {
    if (!token) return;
    socketRef.current?.emit(SOCKET_EVENTS.ARENA_WAGER, wagerInput);
  }

  async function buyFullAccessAndJoin() {
    if (!token) return;
    setBuyingFullAccess(true);
    try {
      const res = await api.post<{ fullAccessGranted: boolean }>('/api/wallet/purchase-full-access', undefined, token);
      setFullAccess(res.fullAccessGranted);
      if (res.fullAccessGranted) {
        setJoinRejected(null);
        socketRef.current?.emit(SOCKET_EVENTS.ARENA_JOIN);
      }
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Purchase failed', 'bad');
    } finally {
      setBuyingFullAccess(false);
    }
  }

  const snap = snapshotRef.current;
  const roundSecondsLeft = snap ? Math.max(0, Math.round((snap.round.endsAt - Date.now()) / 1000)) : 0;

  return (
    <div ref={containerRef} className={`relative w-full ${fullscreen ? 'h-[calc(100vh-56px)]' : 'aspect-video'} bg-black rounded-xl overflow-hidden border border-zinc-800`}>
      <canvas ref={canvasRef} className="block cursor-crosshair touch-none" />

      {!joined && !joinRejected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-zinc-300">
          Connecting to the Arena…
        </div>
      )}

      {!joined && joinRejected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center backdrop-blur-sm">
          <p className="text-sm text-zinc-400">You're spectating live — full gameplay is behind a one-time unlock.</p>
          {joinRejected === 'sign_in_required' ? (
            <>
              <p className="text-lg font-bold text-white">Log in to play in the Arena</p>
              <Link to="/login" className="btn-primary">
                Log in
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-white">
                Unlock {FULL_ACCESS_PRODUCT.name} — ${FULL_ACCESS_PRODUCT.priceUsd}
              </p>
              <p className="max-w-xs text-xs text-zinc-500">{FULL_ACCESS_PRODUCT.description}</p>
              <button onClick={buyFullAccessAndJoin} disabled={buyingFullAccess} className="btn-primary">
                {buyingFullAccess ? 'Processing…' : 'Unlock & join'}
              </button>
            </>
          )}
        </div>
      )}

      {/* HUD: round / pot */}
      <div className="absolute top-3 left-3 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur">
        Round #{snap?.round.number ?? '—'} · pot ✨{(snap?.round.pot ?? 0).toLocaleString()} · rotates in {roundSecondsLeft}s
      </div>

      {/* leaderboard */}
      <div className="absolute top-3 right-3 w-40 rounded-lg bg-black/60 p-2 text-xs backdrop-blur">
        <p className="mb-1 font-semibold text-zinc-400">Leaderboard</p>
        <ol className="space-y-0.5">
          {(snap?.leaderboard ?? []).map((row, i) => (
            <li key={i} className="flex justify-between text-zinc-300">
              <span className="truncate pr-2">
                {i + 1}. {row.username}
              </span>
              <span className="text-zinc-500">{row.score}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* wager controls */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1.5 backdrop-blur">
        <input
          type="number"
          min={1}
          value={wagerInput}
          onChange={(e) => setWagerInput(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-200"
          disabled={!token}
        />
        <button
          onClick={sendWager}
          disabled={!token}
          className="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-40"
        >
          Wager sparks
        </button>
        {!token && <span className="text-[11px] text-zinc-500">log in to wager</span>}
      </div>

      <div className="absolute bottom-3 right-3 text-[11px] text-zinc-500">
        move mouse to steer · hold space / click to boost
      </div>

      {/* toasts */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 space-y-1">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-full px-3 py-1 text-xs font-medium shadow-lg backdrop-blur ${
              t.tone === 'good'
                ? 'bg-emerald-500/90 text-black'
                : t.tone === 'bad'
                  ? 'bg-red-500/90 text-white'
                  : 'bg-zinc-800/90 text-zinc-100'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function playerIdMatchesUsername(username: string, snap: ArenaSnapshot | null, playerId: string | null) {
  if (!snap || !playerId) return false;
  return snap.players.some((p) => p.id === playerId && p.username === username);
}
