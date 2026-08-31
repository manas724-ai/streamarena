// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.
// ---------------------------------------------------------------------------
// @streamarena/shared
// Types & constants shared between the API (server) and the web (client).
// Keeping these in one package is what keeps the realtime protocol and the
// REST DTOs from drifting apart as the app grows.
// ---------------------------------------------------------------------------

// ---- Core domain -----------------------------------------------------------

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  fullAccessGranted: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
  wallet: WalletSummary;
}

// ---- Full Access paywall ---------------------------------------------------
// A one-time real-money purchase (separate from spark packs) that unlocks
// the ability to actually control a player in the Arena. Guests/free
// accounts can still spectate — see arenaGateway.ts's ARENA_JOIN handler.

export const FULL_ACCESS_PRODUCT = {
  id: 'full_access_pass',
  name: 'Full Access Pass',
  priceUsd: 19.99,
  description: 'Unlocks playing in the Arena — spectating and chat stay free.',
};

export interface WalletSummary {
  balance: number; // in "sparks" — the platform's virtual currency
}

export interface ChannelSummary {
  id: string;
  slug: string;
  title: string;
  streamerId: string;
  streamerUsername: string;
  isLive: boolean;
  viewerCount: number;
  startedAt: string | null;
  tags: string[];
}

// ---- Chat --------------------------------------------------------------

export interface ChatMessage {
  id: string;
  channelSlug: string;
  userId: string;
  username: string;
  avatarColor: string;
  body: string;
  kind: 'chat' | 'system' | 'gift';
  createdAt: string;
}

// ---- Gifting / monetization ------------------------------------------

export interface GiftDef {
  id: string;
  name: string;
  emoji: string;
  cost: number; // sparks
  impact: number; // arena impact points awarded to streamer's active game presence, if any
}

export const GIFT_CATALOG: GiftDef[] = [
  { id: 'spark', name: 'Spark', emoji: '✨', cost: 10, impact: 1 },
  { id: 'heart', name: 'Heart', emoji: '❤️', cost: 25, impact: 2 },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', cost: 100, impact: 8 },
  { id: 'crown', name: 'Crown', emoji: '👑', cost: 500, impact: 40 },
  { id: 'meteor', name: 'Meteor Strike', emoji: '☄️', cost: 1500, impact: 120 },
];

export const CURRENCY_PACKS = [
  { id: 'pack_500', sparks: 500, priceUsd: 4.99 },
  { id: 'pack_1200', sparks: 1200, priceUsd: 9.99 },
  { id: 'pack_2600', sparks: 2600, priceUsd: 19.99 },
  { id: 'pack_7000', sparks: 7000, priceUsd: 49.99 },
];

// ---- Endless Arena game -------------------------------------------------

export const ARENA_WIDTH = 2000;
export const ARENA_HEIGHT = 1200;
export const ARENA_TICK_HZ = 20;
export const ARENA_ORB_COUNT = 220;
export const ARENA_BOT_MIN = 6;
export const ARENA_ROUND_MS = 60_000; // pot rotates every 60s; the arena itself never resets
export const ARENA_BASE_RADIUS = 14;
export const ARENA_BASE_SPEED = 140; // px/s
export const ARENA_BOOST_MULT = 1.8;

export interface ArenaPlayerState {
  id: string; // socket-scoped player id
  userId: string | null; // null for guest/bot
  username: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  score: number;
  alive: boolean;
  isBot: boolean;
  boosted: boolean;
}

export interface ArenaOrb {
  id: number;
  x: number;
  y: number;
  value: number;
}

export interface ArenaSnapshot {
  tick: number;
  serverTime: number;
  players: ArenaPlayerState[];
  orbs: ArenaOrb[];
  leaderboard: { username: string; score: number }[];
  round: {
    number: number;
    endsAt: number; // epoch ms — rounds are endless, this only rotates the wager pot
    pot: number;
  };
}

export interface ArenaJoinAck {
  playerId: string;
  arenaWidth: number;
  arenaHeight: number;
}

export interface ArenaInput {
  angle: number; // radians, direction of travel
  boost: boolean;
}

export interface ArenaEliminationEvent {
  victim: string;
  killer: string | null;
  victimScore: number;
}

export interface ArenaPayoutEvent {
  winnerUsername: string;
  amount: number;
  roundNumber: number;
}

// ---- Socket.IO event name constants (avoid typos across client/server) --

export const SOCKET_EVENTS = {
  // chat namespace
  CHAT_JOIN: 'chat:join',
  CHAT_LEAVE: 'chat:leave',
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
  CHAT_PRESENCE: 'chat:presence',
  GIFT_SEND: 'gift:send',
  GIFT_RECEIVED: 'gift:received',

  // signaling namespace (WebRTC)
  RTC_BROADCASTER_READY: 'rtc:broadcaster-ready',
  RTC_VIEWER_JOIN: 'rtc:viewer-join',
  RTC_OFFER: 'rtc:offer',
  RTC_ANSWER: 'rtc:answer',
  RTC_ICE_CANDIDATE: 'rtc:ice-candidate',
  RTC_BROADCASTER_LEFT: 'rtc:broadcaster-left',
  RTC_VIEWER_LEFT: 'rtc:viewer-left',

  // arena namespace
  ARENA_JOIN: 'arena:join',
  ARENA_JOIN_ACK: 'arena:join-ack',
  ARENA_JOIN_REJECTED: 'arena:join-rejected',
  ARENA_INPUT: 'arena:input',
  ARENA_SNAPSHOT: 'arena:snapshot',
  ARENA_ELIMINATED: 'arena:eliminated',
  ARENA_PAYOUT: 'arena:payout',
  ARENA_LEAVE: 'arena:leave',
  ARENA_WAGER: 'arena:wager',

  // support namespace (AI-agent-managed live chat)
  SUPPORT_JOIN: 'support:join',
  SUPPORT_TICKET_INFO: 'support:ticket-info',
  SUPPORT_MESSAGE: 'support:message',
  SUPPORT_AGENT_TYPING: 'support:agent-typing',
  SUPPORT_ESCALATED: 'support:escalated',
} as const;

// ---- AI-managed support desk ------------------------------------------------

export type SupportSender = 'requester' | 'ai_agent' | 'human_agent' | 'system';

export interface SupportChatMessage {
  id: string;
  ticketId: string;
  sender: SupportSender;
  body: string;
  createdAt: string;
}

export interface SupportTicketInfo {
  id: string;
  subject: string;
  category: string;
  status: 'open' | 'escalated' | 'resolved';
  requiresHuman: boolean;
}
