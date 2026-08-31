// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.

import { nanoid } from 'nanoid';
import {
  ARENA_BASE_RADIUS,
  ARENA_BASE_SPEED,
  ARENA_BOOST_MULT,
  ARENA_BOT_MIN,
  ARENA_HEIGHT,
  ARENA_ORB_COUNT,
  ARENA_ROUND_MS,
  ARENA_TICK_HZ,
  ARENA_WIDTH,
  type ArenaEliminationEvent,
  type ArenaInput,
  type ArenaOrb,
  type ArenaPayoutEvent,
  type ArenaPlayerState,
  type ArenaSnapshot,
} from '@streamarena/shared';

// ---------------------------------------------------------------------------
// Endless Arena — a server-authoritative, tick-based multiplayer game.
//
// Design notes (why it's built this way):
//  - Server owns all state and simulates it on a fixed clock (20Hz). Clients
//    only ever send *intent* (an input angle + boost flag), never positions.
//    This is the same trust model every serious competitive multiplayer game
//    uses — it's what makes cheating-by-modified-client hard.
//  - The arena is a *singleton* that starts when the process boots and never
//    resets — players join and leave a persistent world, matching "never
//    ending" gameplay instead of discrete matches.
//  - Rounds only rotate the wager pot (every ARENA_ROUND_MS); they do not
//    reset player scores/positions.
//  - Bots keep the world feeling alive when few humans are connected and
//    give the engine something to do that's easy to eyeball-verify.
// ---------------------------------------------------------------------------

const BOT_NAMES = ['Nova', 'Byte', 'Ghost', 'Comet', 'Vex', 'Pixel', 'Rune', 'Zephyr', 'Ash', 'Kilo'];
const PLAYER_COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#eab308'];

interface InternalPlayer extends ArenaPlayerState {
  input: ArenaInput;
  wager: number; // sparks staked this round, 0 if not wagering
  lastEatenAt: number;
  botTargetOrb: number | null;
}

export type PayoutHandler = (events: ArenaPayoutEvent[], roundNumber: number) => void;
export type EliminationHandler = (event: ArenaEliminationEvent) => void;

export class ArenaEngine {
  private players = new Map<string, InternalPlayer>();
  private orbs = new Map<number, ArenaOrb>();
  private nextOrbId = 1;
  private tick = 0;
  private roundNumber = 1;
  private roundEndsAt = Date.now() + ARENA_ROUND_MS;
  private pot = 0;
  private timer: NodeJS.Timeout | null = null;
  private onPayout: PayoutHandler = () => {};
  private onElimination: EliminationHandler = () => {};

  constructor() {
    for (let i = 0; i < ARENA_ORB_COUNT; i++) this.spawnOrb();
    for (let i = 0; i < ARENA_BOT_MIN; i++) this.addBot();
  }

  onPayoutEvent(handler: PayoutHandler) {
    this.onPayout = handler;
  }

  onEliminationEvent(handler: EliminationHandler) {
    this.onElimination = handler;
  }

  start() {
    if (this.timer) return;
    const intervalMs = 1000 / ARENA_TICK_HZ;
    this.timer = setInterval(() => this.step(intervalMs / 1000), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---- player lifecycle ---------------------------------------------------

  addPlayer(opts: { userId: string | null; username: string }): string {
    const id = nanoid(8);
    const player: InternalPlayer = {
      id,
      userId: opts.userId,
      username: opts.username,
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      x: Math.random() * ARENA_WIDTH,
      y: Math.random() * ARENA_HEIGHT,
      vx: 0,
      vy: 0,
      radius: ARENA_BASE_RADIUS,
      score: 0,
      alive: true,
      isBot: false,
      boosted: false,
      input: { angle: 0, boost: false },
      wager: 0,
      lastEatenAt: 0,
      botTargetOrb: null,
    };
    this.players.set(id, player);
    return id;
  }

  removePlayer(id: string) {
    this.players.delete(id);
  }

  setInput(id: string, input: ArenaInput) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.input = { angle: input.angle, boost: !!input.boost };
  }

  addWager(id: string, amount: number) {
    const p = this.players.get(id);
    if (!p) return;
    p.wager += amount;
    this.pot += amount;
  }

  private addBot() {
    const id = this.addPlayer({ userId: null, username: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] });
    const p = this.players.get(id)!;
    p.isBot = true;
  }

  private spawnOrb() {
    const orb: ArenaOrb = {
      id: this.nextOrbId++,
      x: Math.random() * ARENA_WIDTH,
      y: Math.random() * ARENA_HEIGHT,
      value: 1 + Math.floor(Math.random() * 3),
    };
    this.orbs.set(orb.id, orb);
  }

  // ---- simulation ----------------------------------------------------------

  private step(dt: number) {
    this.tick++;
    this.runBotAI();
    this.movePlayers(dt);
    this.resolveOrbCollisions();
    this.resolvePlayerCollisions();
    this.maintainBotPopulation();
    this.maybeRotateRound();
  }

  private runBotAI() {
    for (const bot of this.players.values()) {
      if (!bot.isBot || !bot.alive) continue;

      // Flee from a much bigger nearby player, otherwise chase the nearest orb.
      let nearestThreat: InternalPlayer | null = null;
      let nearestThreatDist = Infinity;
      for (const other of this.players.values()) {
        if (other.id === bot.id || !other.alive) continue;
        if (other.radius < bot.radius * 1.25) continue;
        const d = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (d < 220 && d < nearestThreatDist) {
          nearestThreat = other;
          nearestThreatDist = d;
        }
      }

      if (nearestThreat) {
        const angle = Math.atan2(bot.y - nearestThreat.y, bot.x - nearestThreat.x);
        bot.input = { angle, boost: nearestThreatDist < 100 };
        continue;
      }

      let target = bot.botTargetOrb !== null ? this.orbs.get(bot.botTargetOrb) : undefined;
      if (!target) {
        let best: ArenaOrb | null = null;
        let bestDist = Infinity;
        for (const orb of this.orbs.values()) {
          const d = Math.hypot(orb.x - bot.x, orb.y - bot.y);
          if (d < bestDist) {
            bestDist = d;
            best = orb;
          }
        }
        target = best ?? undefined;
        bot.botTargetOrb = target ? target.id : null;
      }
      if (target) {
        bot.input = { angle: Math.atan2(target.y - bot.y, target.x - bot.x), boost: false };
      }
    }
  }

  private movePlayers(dt: number) {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const speed = ARENA_BASE_SPEED * (p.input.boost && p.score > 5 ? ARENA_BOOST_MULT : 1);
      p.boosted = p.input.boost && p.score > 5;
      if (p.boosted) p.score = Math.max(0, p.score - dt * 2); // boosting costs score, like burning fuel
      p.vx = Math.cos(p.input.angle) * speed;
      p.vy = Math.sin(p.input.angle) * speed;
      p.x = clamp(p.x + p.vx * dt, p.radius, ARENA_WIDTH - p.radius);
      p.y = clamp(p.y + p.vy * dt, p.radius, ARENA_HEIGHT - p.radius);
      p.radius = ARENA_BASE_RADIUS + Math.sqrt(p.score) * 2.2;
    }
  }

  private resolveOrbCollisions() {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const orb of this.orbs.values()) {
        const d = Math.hypot(orb.x - p.x, orb.y - p.y);
        if (d < p.radius) {
          p.score += orb.value;
          this.orbs.delete(orb.id);
          this.spawnOrb();
          if (p.botTargetOrb === orb.id) p.botTargetOrb = null;
        }
      }
    }
  }

  private resolvePlayerCollisions() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= Math.max(a.radius, b.radius)) continue;

        const [big, small] = a.radius >= b.radius ? [a, b] : [b, a];
        if (big.radius < small.radius * 1.15) continue; // too close in size to eat

        small.alive = false;
        const absorbed = Math.round(small.score * 0.7);
        big.score += absorbed;
        this.onElimination({ victim: small.username, killer: big.username, victimScore: small.score });

        if (small.isBot) {
          this.players.delete(small.id);
        } else {
          // Human players respawn after a short delay with a score penalty already applied.
          setTimeout(() => this.respawn(small.id), 1500);
        }
      }
    }
  }

  private respawn(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    p.alive = true;
    p.x = Math.random() * ARENA_WIDTH;
    p.y = Math.random() * ARENA_HEIGHT;
    p.score = Math.floor(p.score * 0.3);
    p.radius = ARENA_BASE_RADIUS + Math.sqrt(p.score) * 2.2;
  }

  private maintainBotPopulation() {
    const botCount = [...this.players.values()].filter((p) => p.isBot).length;
    if (botCount < ARENA_BOT_MIN && this.tick % 20 === 0) this.addBot();
  }

  private maybeRotateRound() {
    if (Date.now() < this.roundEndsAt) return;

    const wagerers = [...this.players.values()].filter((p) => p.wager > 0);
    const events: ArenaPayoutEvent[] = [];
    if (wagerers.length > 0 && this.pot > 0) {
      const totalScore = wagerers.reduce((sum, p) => sum + Math.max(1, p.score), 0);
      for (const p of wagerers) {
        const share = Math.max(1, p.score) / totalScore;
        const amount = Math.round(this.pot * share);
        if (amount > 0) events.push({ winnerUsername: p.username, amount, roundNumber: this.roundNumber });
      }
    }
    if (events.length) this.onPayout(events, this.roundNumber);

    for (const p of this.players.values()) p.wager = 0;
    this.pot = 0;
    this.roundNumber++;
    this.roundEndsAt = Date.now() + ARENA_ROUND_MS;
  }

  // ---- snapshot -------------------------------------------------------------

  getSnapshot(): ArenaSnapshot {
    const players = [...this.players.values()].map(
      (p): ArenaPlayerState => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        color: p.color,
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: p.vx,
        vy: p.vy,
        radius: Math.round(p.radius * 10) / 10,
        score: Math.round(p.score),
        alive: p.alive,
        isBot: p.isBot,
        boosted: p.boosted,
      }),
    );
    const leaderboard = [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((p) => ({ username: p.username, score: Math.round(p.score) }));

    return {
      tick: this.tick,
      serverTime: Date.now(),
      players,
      orbs: [...this.orbs.values()],
      leaderboard,
      round: { number: this.roundNumber, endsAt: this.roundEndsAt, pot: this.pot },
    };
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
