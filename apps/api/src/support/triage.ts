// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.
//
// Deterministic, auditable triage — runs before the AI responder ever sees
// a message, and its decision cannot be overridden by whatever the AI
// generates. This is the safety valve underneath "100% AI managed"
// support: certain categories always get routed to a human, no matter how
// confident the AI sounds, because getting them wrong has real
// consequences (money, legal exposure, someone's safety) that a wrong
// guess can't be undone by a follow-up message. See DISCLAIMER.md.

export type SupportCategory =
  | 'billing'
  | 'technical'
  | 'account'
  | 'arena'
  | 'abuse_report'
  | 'legal_privacy'
  | 'safety'
  | 'general';

export interface TriageResult {
  category: SupportCategory;
  requiresHuman: boolean;
  escalationReason: string | null;
}

// Ordered by priority — the first match wins. Safety and legal come first
// on purpose: a message that happens to also mention billing shouldn't be
// routed as a billing ticket if it also raises a safety or legal concern.
const RULES: { category: SupportCategory; patterns: RegExp[]; escalate: boolean; reason?: string }[] = [
  {
    category: 'safety',
    patterns: [
      // Deliberately broad and over-inclusive — false positives here cost a
      // human two minutes of review; false negatives are the failure mode
      // that actually matters. Covers first- AND third-person phrasing
      // ("I want to..." as well as "my friend wants to...", "she's been...").
      /\bsuicid(e|al)?\b/i,
      /\bself[\s-]?harm(ing)?\b/i,
      /\b(want(s|ed)?|going|about|plan(s|ning)?|tried|trying) to (kill|hurt|harm|end)\s+(myself|himself|herself|themselves|their life|his life|her life|my life)\b/i,
      /\b(hurt|harm|kill)(ing)?\s+(myself|himself|herself|themselves)\b/i,
      /\bend(ing)?\s+(my|his|her|their)\s+life\b/i,
      /\bwant(s|ed)?\s+to\s+die\b/i,
      /\bharass(ed|ment)?\b.*\b(threat|scared|afraid|unsafe)\b/i,
      /\b(child|minor)\b.*\b(abuse|exploit|predator)\b/i,
    ],
    escalate: true,
    reason: 'Message raises a safety concern — always routed to a human, never auto-resolved.',
  },
  {
    category: 'legal_privacy',
    patterns: [
      /\b(lawsuit|subpoena|cease and desist|attorney|legal action|sue|sued|gdpr|ccpa|right to be forgotten|delete my data|data deletion request)\b/i,
    ],
    escalate: true,
    reason: 'Legal or data-rights request — requires human/compliance review.',
  },
  {
    category: 'abuse_report',
    patterns: [/\b(harass|abuse|threat|hate speech|stalking|doxx)\b/i, /\breport(ing)? (a )?(user|streamer|player)\b/i],
    escalate: true,
    reason: 'Report about another user — requires human moderation judgment.',
  },
  {
    category: 'billing',
    patterns: [/\b(refund|chargeback|dispute|unauthorized charge|double charged|fraudulent charge)\b/i],
    escalate: true,
    reason: 'Billing dispute — financial decision requires human approval.',
  },
  {
    category: 'account',
    patterns: [/\b(hacked|compromised|can'?t log ?in|locked out|suspicious login|account (stolen|taken over))\b/i],
    escalate: true,
    reason: 'Possible account security incident — requires human verification.',
  },
  {
    category: 'billing',
    patterns: [/\b(spark|sparks|purchase|payment|charge|full access|pricing|invoice|receipt|gift|gifting|gifted)\b/i],
    escalate: false,
  },
  {
    category: 'technical',
    patterns: [/\b(stream|broadcast|camera|webrtc|lag|buffering|connect(ion)?|crash|bug|error|not working|black screen)\b/i],
    escalate: false,
  },
  {
    category: 'arena',
    patterns: [/\b(arena|wager|pot|leaderboard|orb|respawn|gameplay|score)\b/i],
    escalate: false,
  },
  {
    category: 'account',
    patterns: [/\b(password|username|profile|email address|display name)\b/i],
    escalate: false,
  },
];

// Explicit user request to talk to a person overrides everything else.
const HUMAN_REQUEST = /\b(talk to (a )?(human|person|real person|agent)|human support|speak (to|with) someone)\b/i;

export function triage(subject: string, body: string): TriageResult {
  const text = `${subject}\n${body}`;

  if (HUMAN_REQUEST.test(text)) {
    return { category: 'general', requiresHuman: true, escalationReason: 'Requester explicitly asked for a human.' };
  }

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return { category: rule.category, requiresHuman: rule.escalate, escalationReason: rule.escalate ? (rule.reason ?? null) : null };
    }
  }

  return { category: 'general', requiresHuman: false, escalationReason: null };
}
