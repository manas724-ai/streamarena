// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.

import type { Namespace, Socket } from 'socket.io';
import { verifyToken } from '../lib/auth.js';
import { findUserById, getTicket, listTicketMessages } from '../db/repo.js';
import { handleChatMessage } from '../support/ticketService.js';
import { SOCKET_EVENTS, type SupportChatMessage, type SupportTicketInfo } from '@streamarena/shared';

interface SupportSocketData {
  userId?: string | null;
  username?: string;
  ticketId?: string;
}

function toTicketInfo(ticket: { id: string; subject: string; category: string; status: string; requiresHuman: boolean }): SupportTicketInfo {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status as SupportTicketInfo['status'],
    requiresHuman: ticket.requiresHuman,
  };
}

function toChatMessage(m: { id: string; ticketId: string; sender: string; body: string; createdAt: string }): SupportChatMessage {
  return {
    id: m.id,
    ticketId: m.ticketId,
    sender: m.sender as SupportChatMessage['sender'],
    body: m.body,
    createdAt: m.createdAt,
  };
}

export function registerSupportNamespace(nsp: Namespace) {
  nsp.on('connection', (socket: Socket) => {
    const data = socket.data as SupportSocketData;

    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = verifyToken(token);
        data.userId = payload.sub;
        data.username = payload.username;
      } catch {
        /* anonymous chat is allowed — support shouldn't require an account */
      }
    }

    // Resume an existing ticket (e.g. reopening the widget) if the client
    // remembers its id; otherwise this is a no-op until the first message.
    socket.on(SOCKET_EVENTS.SUPPORT_JOIN, (existingTicketId?: string) => {
      if (!existingTicketId) return;
      const ticket = getTicket(existingTicketId);
      if (!ticket) return;
      data.ticketId = ticket.id;
      socket.emit(SOCKET_EVENTS.SUPPORT_TICKET_INFO, toTicketInfo(ticket));
      for (const m of listTicketMessages(ticket.id)) {
        socket.emit(SOCKET_EVENTS.SUPPORT_MESSAGE, toChatMessage(m));
      }
    });

    socket.on(SOCKET_EVENTS.SUPPORT_MESSAGE, async (body: string) => {
      const text = (body ?? '').toString().trim().slice(0, 2000);
      if (!text) return;

      const requesterName = data.username ?? (data.userId ? findUserById(data.userId)?.displayName : undefined);

      socket.emit(SOCKET_EVENTS.SUPPORT_AGENT_TYPING, true);
      try {
        const { ticket, requesterMessage, agentMessage } = await handleChatMessage({
          ticketId: data.ticketId,
          userId: data.userId ?? null,
          requesterName,
          body: text,
        });
        data.ticketId = ticket.id;

        socket.emit(SOCKET_EVENTS.SUPPORT_TICKET_INFO, toTicketInfo(ticket));
        socket.emit(SOCKET_EVENTS.SUPPORT_MESSAGE, toChatMessage(requesterMessage));
        socket.emit(SOCKET_EVENTS.SUPPORT_MESSAGE, toChatMessage(agentMessage));
        if (ticket.status === 'escalated') {
          socket.emit(SOCKET_EVENTS.SUPPORT_ESCALATED, { reason: ticket.escalationReason });
        }
      } finally {
        socket.emit(SOCKET_EVENTS.SUPPORT_AGENT_TYPING, false);
      }
    });
  });
}
