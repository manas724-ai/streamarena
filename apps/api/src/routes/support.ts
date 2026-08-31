// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getTicket, listTicketMessages, listTickets, setTicketResolved, addTicketMessage } from '../db/repo.js';
import { handleInboundEmail } from '../support/ticketService.js';

export const supportRouter = Router();

// ---------------------------------------------------------------------------
// Inbound email webhook. In production this is what your email provider
// (SendGrid Inbound Parse, Postmark Inbound, Mailgun Routes, etc.) POSTs to
// when someone emails your support address — swap this route's auth/shape
// to match that provider's webhook format, the orchestration in
// ticketService.ts doesn't change. For local testing/demos, POST directly
// to this endpoint with the shape below.
// ---------------------------------------------------------------------------

const inboundEmailSchema = z.object({
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

supportRouter.post('/email/inbound', async (req, res) => {
  const parsed = inboundEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });

  const ticket = await handleInboundEmail(parsed.data);
  res.status(201).json({ ticketId: ticket.id, status: ticket.status, category: ticket.category });
});

// ---------------------------------------------------------------------------
// Admin/staff visibility into what the AI agent has been doing — "100%
// AI-managed" still means a human can audit the trail and pick up
// escalated tickets. Gated by ADMIN_USERNAMES (see requireAdmin.ts).
// ---------------------------------------------------------------------------

supportRouter.get('/tickets', requireAuth, requireAdmin, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const requiresHuman = req.query.requiresHuman === 'true' ? true : undefined;
  res.json(listTickets({ status, requiresHuman }));
});

supportRouter.get('/tickets/:id', requireAuth, requireAdmin, (req, res) => {
  const ticket = getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ticket, messages: listTicketMessages(ticket.id) });
});

const replySchema = z.object({ body: z.string().min(1).max(5000) });

supportRouter.post('/tickets/:id/reply', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const ticket = getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  addTicketMessage({ ticketId: ticket.id, sender: 'human_agent', body: parsed.data.body, sentAt: new Date().toISOString() });
  res.json({ ok: true });
});

supportRouter.post('/tickets/:id/resolve', requireAuth, requireAdmin, (req, res) => {
  const ticket = getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  setTicketResolved(ticket.id);
  res.json({ ok: true });
});
