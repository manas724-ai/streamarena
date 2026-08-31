// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.
//
// The actual "AI agent" — generates the reply text for both the email and
// live-chat channels. Two modes:
//
//  - ANTHROPIC_API_KEY set: calls the real Claude API, grounded in
//    KNOWLEDGE_BASE, with an explicit system prompt that (a) never
//    contradicts triage.ts's escalation decision — an escalated ticket
//    gets an acknowledgment, not an attempted resolution, regardless of
//    what the model would otherwise say — and (b) tells the model not to
//    invent policies, prices, or promises that aren't in the knowledge
//    base.
//  - No key set: a deterministic template responder keyed off the
//    triage category, so the whole support loop — receive, classify,
//    respond, log a receipt — genuinely runs with zero external
//    credentials. This is the same "mock but fully functional" pattern as
//    lib/payments.ts and support/emailProvider.ts.
//
// Either way, the *decision* of whether a human needs to see this ticket
// was already made by triage.ts before this file is ever called — the AI
// only ever composes the wording, never the routing.

import { env } from '../lib/env.js';
import { KNOWLEDGE_BASE } from './knowledgeBase.js';
import type { SupportCategory } from './triage.js';

export interface ReplyRequest {
  subject: string;
  body: string;
  category: SupportCategory;
  requiresHuman: boolean;
  requesterName?: string | null;
}

const CATEGORY_LABEL: Record<SupportCategory, string> = {
  billing: 'billing/purchases',
  technical: 'a technical issue',
  account: 'your account',
  arena: 'the Arena game',
  abuse_report: 'a report about another user',
  legal_privacy: 'a legal or data-privacy request',
  safety: 'a safety concern',
  general: 'your message',
};

export async function generateReply(req: ReplyRequest): Promise<string> {
  if (env.anthropicApiKey) {
    try {
      return await generateWithClaude(req);
    } catch (err) {
      console.error('[support:ai] Claude API call failed, falling back to template:', (err as Error).message);
      return templateReply(req);
    }
  }
  return templateReply(req);
}

async function generateWithClaude(req: ReplyRequest): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  const escalationInstruction = req.requiresHuman
    ? `This ticket has been classified as "${req.category}" and flagged for mandatory human review — DO NOT attempt to resolve it, promise a specific outcome, or make any commitment (refund amount, timeline, moderation decision, legal position). Only acknowledge that you've received it, briefly reassure the requester, and let them know a specialist on the team will follow up. Keep it short and warm.`
    : `This ticket is classified as "${req.category}" and can be handled directly. Answer helpfully and specifically using ONLY the information in the knowledge base below — never invent a policy, price, or feature that isn't listed there. If you're not confident the knowledge base covers their question, say so plainly and offer to loop in the team rather than guessing.`;

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 400,
    system: `You are StreamArena's customer support agent. Be warm, concise, and specific. Never make legal, medical, or financial guarantees. ${escalationInstruction}\n\nKnowledge base:\n${KNOWLEDGE_BASE}`,
    messages: [
      {
        role: 'user',
        content: `Requester${req.requesterName ? ` (${req.requesterName})` : ''} wrote:\nSubject: ${req.subject}\n\n${req.body}`,
      },
    ],
  });

  const text = message.content.find((block) => block.type === 'text');
  return text && 'text' in text ? text.text.trim() : templateReply(req);
}

function templateReply(req: ReplyRequest): string {
  const greeting = req.requesterName ? `Hi ${req.requesterName},` : 'Hi there,';

  if (req.requiresHuman) {
    return [
      greeting,
      '',
      `Thanks for reaching out about ${CATEGORY_LABEL[req.category]}. I've logged this and a member of the Aussi-Nexus Group team will follow up personally — this type of request needs a human to review rather than something I can resolve automatically.`,
      '',
      req.category === 'safety'
        ? "If you're in immediate danger or thinking about harming yourself, please contact a local emergency service or a crisis line in your area right now — you don't have to wait for our reply."
        : "We'll get back to you as soon as we can.",
      '',
      '— StreamArena Support (AI agent, human review pending)',
    ]
      .filter((l) => l !== null)
      .join('\n');
  }

  const bodyByCategory: Record<SupportCategory, string> = {
    billing:
      "Sparks are our virtual currency, purchasable in packs from your Wallet page. Purchases are processed instantly and are non-refundable except where required by law. If you're asking about the Full Access Pass, that's a one-time $19.99 purchase that unlocks actually playing in the Arena (spectating and chat are always free). To gift a streamer, spend sparks from their channel page while they're live — it credits their wallet immediately and shows in chat.",
    technical:
      "For streaming issues: check that your browser has camera/mic permission granted for the site, try Chrome or Firefox if you're on another browser, and make sure no other app is using your camera. If you're a viewer stuck on 'waiting for the broadcaster', try refreshing — and double-check the streamer is actually live from their dashboard.",
    account:
      'For account questions: you can update your display name and channel details from the Creator Dashboard. If this is about a security concern (suspicious login, compromised password), let us know and we can look into it further.',
    arena:
      "The Arena is a persistent world that never resets — join anytime, eat orbs to grow, and avoid bigger players. If you own Full Access, you can also wager sparks into the round pot, which pays out every 60 seconds based on score share among that round's wagering players.",
    abuse_report: "Thanks for flagging this — reports about other users are reviewed by a person, not resolved automatically.",
    legal_privacy: 'Requests like this are routed to a human for review.',
    safety: 'This has been flagged for a human to review right away.',
    general:
      "Thanks for reaching out! Could you share a bit more detail about what you're running into? In the meantime, our most common topics are account/login, streaming setup, sparks & purchases, and how the Arena works.",
  };

  return [greeting, '', bodyByCategory[req.category], '', '— StreamArena Support (AI agent)'].join('\n');
}
