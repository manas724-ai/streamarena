// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.
//
// Orchestrates the whole "self-triggered AI agent" loop for both channels:
// message arrives → receipt sent immediately → triage classifies it →
// escalate to a human queue, or let the AI agent answer → every step
// logged to the ticket thread with timestamps, so there's a full audit
// trail of what the AI did and why (see the Support Inbox admin page).

import {
  addTicketMessage,
  createTicket,
  getTicket,
  listTicketMessages,
  setTicketEscalated,
  type SupportMessageRow,
  type SupportTicketRow,
} from '../db/repo.js';
import { triage } from './triage.js';
import { generateReply } from './aiResponder.js';
import { emailProvider } from './emailProvider.js';

export interface InboundEmail {
  fromEmail: string;
  fromName?: string;
  subject: string;
  body: string;
  userId?: string | null;
}

/**
 * Handles one inbound support email end to end: creates the ticket, sends
 * an immediate receipt (so the sender has proof we got it — the "email
 * response receipt" the requester expects even before we've read it),
 * triages, and either escalates with an acknowledgment or has the AI
 * agent answer directly — all via the pluggable EmailProvider so this
 * runs with zero external email credentials.
 */
export async function handleInboundEmail(input: InboundEmail): Promise<SupportTicketRow> {
  const receivedAt = new Date().toISOString();
  const { category, requiresHuman, escalationReason } = triage(input.subject, input.body);

  const ticket = createTicket({
    channel: 'email',
    userId: input.userId ?? null,
    requesterEmail: input.fromEmail,
    requesterName: input.fromName ?? null,
    subject: input.subject,
    category,
  });

  addTicketMessage({ ticketId: ticket.id, sender: 'requester', body: input.body, receivedAt });

  // Receipt #1: prove we received it, before any AI processing happens —
  // this is what "email received" + "email response receipt" means in
  // practice: the sender gets confirmation immediately, not just whenever
  // the AI (or a human) eventually gets around to a substantive reply.
  const receiptBody = `We received your message "${input.subject}" and it's being handled by our support system. Ticket reference: ${ticket.id}.`;
  const receipt = await emailProvider.send(input.fromEmail, `Re: ${input.subject} [received]`, receiptBody);
  addTicketMessage({
    ticketId: ticket.id,
    sender: 'system',
    body: receiptBody,
    sentAt: new Date().toISOString(),
    providerRef: receipt.providerRef,
  });

  if (requiresHuman) {
    setTicketEscalated(ticket.id, escalationReason ?? 'Flagged by triage rules.');
  }

  // Receipt #2: the actual (AI-composed) response — an attempted
  // resolution for non-escalated categories, or a scoped acknowledgment
  // for escalated ones (see aiResponder.ts).
  const replyText = await generateReply({
    subject: input.subject,
    body: input.body,
    category,
    requiresHuman,
    requesterName: input.fromName,
  });
  const sendResult = await emailProvider.send(input.fromEmail, `Re: ${input.subject}`, replyText);
  addTicketMessage({
    ticketId: ticket.id,
    sender: 'ai_agent',
    body: replyText,
    sentAt: new Date().toISOString(),
    providerRef: sendResult.providerRef,
  });

  return getTicket(ticket.id)!;
}

/**
 * Live-chat equivalent: same triage → AI-or-escalate loop, but synchronous
 * and returning the reply directly for the caller (the /support socket
 * namespace) to emit back over the open connection instead of "sending an
 * email".
 */
export async function handleChatMessage(input: {
  ticketId?: string;
  userId?: string | null;
  requesterName?: string | null;
  body: string;
}): Promise<{ ticket: SupportTicketRow; requesterMessage: SupportMessageRow; agentMessage: SupportMessageRow }> {
  let ticket = input.ticketId ? getTicket(input.ticketId) : undefined;

  const { category, requiresHuman, escalationReason } = triage(ticket?.subject ?? input.body.slice(0, 80), input.body);

  if (!ticket) {
    ticket = createTicket({
      channel: 'chat',
      userId: input.userId ?? null,
      requesterName: input.requesterName ?? null,
      subject: input.body.slice(0, 80),
      category,
    });
  }

  const requesterMessage = addTicketMessage({
    ticketId: ticket.id,
    sender: 'requester',
    body: input.body,
    receivedAt: new Date().toISOString(),
  });

  if (requiresHuman && ticket.status !== 'escalated') {
    setTicketEscalated(ticket.id, escalationReason ?? 'Flagged by triage rules.');
  }

  // Reserved for richer multi-turn grounding later — the full thread is
  // already persisted and available here if generateReply grows to accept it.
  void listTicketMessages(ticket.id);

  const replyText = await generateReply({
    subject: ticket.subject,
    body: input.body,
    category,
    requiresHuman: requiresHuman || ticket.status === 'escalated',
    requesterName: input.requesterName,
  });

  const agentMessage = addTicketMessage({
    ticketId: ticket.id,
    sender: 'ai_agent',
    body: replyText,
    sentAt: new Date().toISOString(),
  });

  return { ticket: getTicket(ticket.id)!, requesterMessage, agentMessage };
}
