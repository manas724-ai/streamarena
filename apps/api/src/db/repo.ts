import { nanoid } from 'nanoid';
import { db, withTransaction } from './client.js';

// A small hand-rolled repository layer standing in for an ORM. Every
// function here is the seam you'd point at Postgres in production —
// nothing above this file (routes, ws gateways) knows or cares that the
// storage is SQLite.

function id() {
  return nanoid(24);
}
function now() {
  return new Date().toISOString();
}

// ---- users -----------------------------------------------------------------

export interface UserRow {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  avatarColor: string;
  email: string | null;
  fullAccessGranted: boolean;
  createdAt: string;
}

function mapUser(row: any): UserRow {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    avatarColor: row.avatar_color,
    email: row.email,
    fullAccessGranted: !!row.full_access_granted,
    createdAt: row.created_at,
  };
}

export function findUserByUsername(username: string): UserRow | undefined {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  return row ? mapUser(row) : undefined;
}

export function findUserById(userId: string): UserRow | undefined {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return row ? mapUser(row) : undefined;
}

export interface NewUserInput {
  username: string;
  displayName: string;
  passwordHash: string;
  avatarColor: string;
  channelTitle: string;
  email?: string;
}

export function createUserWithWalletAndChannel(
  input: NewUserInput,
): { user: UserRow; walletBalance: number } {
  return withTransaction(() => {
    const userId = id();
    db.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, avatar_color, email) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(userId, input.username, input.displayName, input.passwordHash, input.avatarColor, input.email ?? null);

    const startingBalance = 500;
    db.prepare(`INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, ?)`).run(id(), userId, startingBalance);

    db.prepare(`INSERT INTO channels (id, slug, title, streamer_id) VALUES (?, ?, ?, ?)`).run(
      id(),
      input.username.toLowerCase(),
      input.channelTitle,
      userId,
    );

    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, meta) VALUES (?, ?, ?, ?, ?)`).run(
      id(),
      userId,
      'signup_bonus',
      startingBalance,
      'Welcome bonus',
    );

    return { user: findUserById(userId)!, walletBalance: startingBalance };
  });
}

// ---- wallets & transactions --------------------------------------------

export function getWalletBalance(userId: string): number {
  const row = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

export function adjustWalletBalance(userId: string, delta: number) {
  db.prepare('UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ?').run(delta, now(), userId);
}

export function createTransaction(userId: string, type: string, amount: number, meta?: string) {
  db.prepare(`INSERT INTO transactions (id, user_id, type, amount, meta) VALUES (?, ?, ?, ?, ?)`).run(
    id(),
    userId,
    type,
    amount,
    meta ?? null,
  );
}

export function listTransactions(userId: string, limit = 50) {
  return db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as any[];
}

/** Debit `userId` by `amount` and record a transaction, atomically. Returns false if insufficient balance. */
export function tryDebitWallet(userId: string, amount: number, type: string, meta?: string): boolean {
  return withTransaction(() => {
    const balance = getWalletBalance(userId);
    if (balance < amount) return false;
    adjustWalletBalance(userId, -amount);
    createTransaction(userId, type, -amount, meta);
    return true;
  });
}

export function creditWallet(userId: string, amount: number, type: string, meta?: string) {
  withTransaction(() => {
    adjustWalletBalance(userId, amount);
    createTransaction(userId, type, amount, meta);
  });
}

// ---- channels ----------------------------------------------------------

export interface ChannelRow {
  id: string;
  slug: string;
  title: string;
  tags: string;
  streamerId: string;
  streamerUsername: string;
  isLive: boolean;
  startedAt: string | null;
  createdAt: string;
}

function mapChannel(row: any): ChannelRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tags: row.tags,
    streamerId: row.streamer_id,
    streamerUsername: row.streamer_username,
    isLive: !!row.is_live,
    startedAt: row.started_at,
    createdAt: row.created_at,
  };
}

const CHANNEL_JOIN = `
  SELECT c.*, u.username AS streamer_username
  FROM channels c JOIN users u ON u.id = c.streamer_id
`;

export function listChannels(): ChannelRow[] {
  const rows = db.prepare(`${CHANNEL_JOIN} ORDER BY c.is_live DESC, c.created_at DESC LIMIT 100`).all();
  return rows.map(mapChannel);
}

export function getChannelBySlug(slug: string): ChannelRow | undefined {
  const row = db.prepare(`${CHANNEL_JOIN} WHERE c.slug = ?`).get(slug);
  return row ? mapChannel(row) : undefined;
}

export function getChannelByStreamerId(streamerId: string): ChannelRow | undefined {
  const row = db.prepare(`${CHANNEL_JOIN} WHERE c.streamer_id = ?`).get(streamerId);
  return row ? mapChannel(row) : undefined;
}

export function updateChannelForStreamer(streamerId: string, data: { title?: string; tags?: string }): ChannelRow {
  if (data.title !== undefined) {
    db.prepare('UPDATE channels SET title = ? WHERE streamer_id = ?').run(data.title, streamerId);
  }
  if (data.tags !== undefined) {
    db.prepare('UPDATE channels SET tags = ? WHERE streamer_id = ?').run(data.tags, streamerId);
  }
  return getChannelByStreamerId(streamerId)!;
}

export function setChannelLive(streamerId: string, live: boolean): ChannelRow {
  if (live) {
    db.prepare('UPDATE channels SET is_live = 1, started_at = ?, ended_at = NULL WHERE streamer_id = ?').run(now(), streamerId);
  } else {
    db.prepare('UPDATE channels SET is_live = 0, ended_at = ? WHERE streamer_id = ?').run(now(), streamerId);
  }
  return getChannelByStreamerId(streamerId)!;
}

export function seedSetChannelLive(slug: string, live: boolean, startedAt: string | null) {
  db.prepare('UPDATE channels SET is_live = ?, started_at = ? WHERE slug = ?').run(live ? 1 : 0, startedAt, slug);
}

// ---- gifts ---------------------------------------------------------------

export function createGiftEvent(channelId: string, senderId: string, receiverId: string, giftId: string, cost: number) {
  db.prepare(
    `INSERT INTO gift_events (id, channel_id, sender_id, receiver_id, gift_id, cost) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id(), channelId, senderId, receiverId, giftId, cost);
}

// ---- arena results ---------------------------------------------------------

export function createArenaResult(roundNumber: number, userId: string, payout: number) {
  db.prepare(
    `INSERT INTO arena_results (id, round_number, user_id, wager, final_score, placement, payout) VALUES (?, ?, ?, 0, 0, 0, ?)`,
  ).run(id(), roundNumber, userId, payout);
}

// ---- full access (payment gate) --------------------------------------------

export function grantFullAccess(userId: string) {
  db.prepare('UPDATE users SET full_access_granted = 1, full_access_at = ? WHERE id = ?').run(now(), userId);
}

export function hasFullAccess(userId: string): boolean {
  const row = db.prepare('SELECT full_access_granted FROM users WHERE id = ?').get(userId) as
    | { full_access_granted: number }
    | undefined;
  return !!row?.full_access_granted;
}

// ---- AI-managed support desk ------------------------------------------------

export interface SupportTicketRow {
  id: string;
  channel: 'email' | 'chat';
  userId: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  subject: string;
  category: string;
  status: 'open' | 'escalated' | 'resolved';
  requiresHuman: boolean;
  escalationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageRow {
  id: string;
  ticketId: string;
  sender: 'requester' | 'ai_agent' | 'human_agent' | 'system';
  body: string;
  receivedAt: string | null;
  sentAt: string | null;
  providerRef: string | null;
  createdAt: string;
}

function mapTicket(row: any): SupportTicketRow {
  return {
    id: row.id,
    channel: row.channel,
    userId: row.user_id,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    subject: row.subject,
    category: row.category,
    status: row.status,
    requiresHuman: !!row.requires_human,
    escalationReason: row.escalation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: any): SupportMessageRow {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    sender: row.sender,
    body: row.body,
    receivedAt: row.received_at,
    sentAt: row.sent_at,
    providerRef: row.provider_ref,
    createdAt: row.created_at,
  };
}

export function createTicket(input: {
  channel: 'email' | 'chat';
  userId?: string | null;
  requesterEmail?: string | null;
  requesterName?: string | null;
  subject: string;
  category: string;
}): SupportTicketRow {
  const ticketId = id();
  db.prepare(
    `INSERT INTO support_tickets (id, channel, user_id, requester_email, requester_name, subject, category)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ticketId,
    input.channel,
    input.userId ?? null,
    input.requesterEmail ?? null,
    input.requesterName ?? null,
    input.subject,
    input.category,
  );
  return getTicket(ticketId)!;
}

export function getTicket(ticketId: string): SupportTicketRow | undefined {
  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId);
  return row ? mapTicket(row) : undefined;
}

export function listTickets(filter?: { status?: string; requiresHuman?: boolean }): SupportTicketRow[] {
  let query = 'SELECT * FROM support_tickets';
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter?.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  if (filter?.requiresHuman !== undefined) {
    clauses.push('requires_human = ?');
    params.push(filter.requiresHuman ? 1 : 0);
  }
  if (clauses.length) query += ' WHERE ' + clauses.join(' AND ');
  query += ' ORDER BY updated_at DESC LIMIT 200';
  return (db.prepare(query).all(...params) as any[]).map(mapTicket);
}

export function addTicketMessage(input: {
  ticketId: string;
  sender: SupportMessageRow['sender'];
  body: string;
  receivedAt?: string | null;
  sentAt?: string | null;
  providerRef?: string | null;
}): SupportMessageRow {
  const messageId = id();
  db.prepare(
    `INSERT INTO support_messages (id, ticket_id, sender, body, received_at, sent_at, provider_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    messageId,
    input.ticketId,
    input.sender,
    input.body,
    input.receivedAt ?? null,
    input.sentAt ?? null,
    input.providerRef ?? null,
  );
  db.prepare('UPDATE support_tickets SET updated_at = ? WHERE id = ?').run(now(), input.ticketId);
  const row = db.prepare('SELECT * FROM support_messages WHERE id = ?').get(messageId);
  return mapMessage(row);
}

export function listTicketMessages(ticketId: string): SupportMessageRow[] {
  return (
    db.prepare('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as any[]
  ).map(mapMessage);
}

export function setTicketEscalated(ticketId: string, reason: string) {
  db.prepare(
    "UPDATE support_tickets SET status = 'escalated', requires_human = 1, escalation_reason = ?, updated_at = ? WHERE id = ?",
  ).run(reason, now(), ticketId);
}

export function setTicketResolved(ticketId: string) {
  db.prepare("UPDATE support_tickets SET status = 'resolved', updated_at = ? WHERE id = ?").run(now(), ticketId);
}

export function setTicketStatus(ticketId: string, status: 'open' | 'escalated' | 'resolved') {
  db.prepare('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), ticketId);
}
