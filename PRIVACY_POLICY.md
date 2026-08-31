# StreamArena Privacy Policy (TEMPLATE — attorney review required)

> **This is a starting-point template, not a finished legal document.**
> It describes what the *current prototype codebase* does with data as of
> this writing, so Aussi-Nexus Group's legal/compliance team can use it as
> a factual starting point — it is not a substitute for a compliance
> review (GDPR, CCPA/CPRA, COPPA, and other applicable regimes each impose
> requirements this template does not fully address) and must be updated
> to match the *actual* production system before publication, especially
> once a real payment processor, hosting provider, and analytics/logging
> stack are chosen. Bracketed placeholders `[LIKE THIS]` mark fields that
> must be filled in.

**Last updated:** [DATE]

## 1. Who we are

StreamArena is operated by Aussi-Nexus Group ("we", "us"). Contact:
[PRIVACY CONTACT EMAIL / MAILING ADDRESS].

## 2. What we collect

**Account data**: username, display name, password (stored as a bcrypt
hash — see `apps/api/src/lib/auth.ts` — never in plaintext), an
auto-assigned avatar color, and — optionally, if provided at registration
or when contacting support — an email address.

**Usage & gameplay data**: chat messages sent in channels (currently
retained in server memory as a rolling buffer per channel and not
separately persisted to a database — confirm this against the actual
production implementation before publishing this policy), Arena gameplay
state (position, score) while connected, and transaction records (virtual
currency purchases, gifts sent/received, Full Access Pass purchase,
wagers, and payouts).

**Support data**: the content of any email, live chat, or technical
support request you send us, including message text and, for email, the
sending address, is stored as a support ticket and its messages (see
`apps/api/src/db/schema.sql`, tables `support_tickets` /
`support_messages`) so the support system and any human reviewer can see
the full conversation. If the operator has configured a live AI responder
(an `ANTHROPIC_API_KEY` set in the server environment, as opposed to the
template-only fallback that ships by default), your support message and
relevant knowledge-base text are sent to Anthropic's API to generate a
reply — see Section 3 and `TERMS_OF_SERVICE.md` Section 5 for how that
routing decision is made. [Aussi-Nexus Group: name Anthropic (or whichever
AI provider is actually in use) as a data processor/sub-processor here,
and link its privacy policy, before publishing this document.]

**Connection data**: standard web server logs (IP address, timestamps) to
the extent your hosting provider or the API server generates them; this
prototype does not currently implement dedicated analytics or log
aggregation.

**Payment data**: in the current prototype, no real payment data is
collected — purchases are simulated by a mock payment provider (see
`apps/api/src/lib/payments.ts`). Once a real processor (e.g., Stripe) is
integrated, this section must be rewritten to reflect that we do not
store full card numbers ourselves and that payment data is handled by
that processor under its own privacy policy, linked here: [PROCESSOR
PRIVACY POLICY URL].

## 3. How we use it

To operate the Service (authenticate you, display your channel and chat,
run the Arena, track your virtual-currency balance and transaction
history, grant Full Access after purchase), to maintain security and
prevent abuse, to respond to support requests — including by an automated
AI agent, as disclosed in `TERMS_OF_SERVICE.md` Section 5 — and to
communicate with you about your account. [Add marketing/analytics uses
here only if and when actually implemented, with the appropriate consent
mechanism for each jurisdiction.]

## 4. What we don't do (in the current prototype)

We do not currently sell personal data, run third-party advertising or
tracking pixels, or share data with third parties other than the
infrastructure providers necessary to run the Service (e.g., hosting, a
payment processor once integrated, and — only if the operator has
configured a live AI responder as described in Section 2 — an AI
provider used solely to generate support replies). [Confirm this remains
accurate as the product evolves; update immediately if it changes.]

## 5. Data retention & deletion

[The prototype has no automated data-retention or account-deletion
workflow implemented yet. Before publishing this policy, implement and
then describe: how long data is kept, and how a user can request deletion
of their account and associated data — required under GDPR/CCPA and
generally good practice regardless.]

## 6. Cookies & local storage

The web client stores your session (auth token and cached profile) in the
browser's `sessionStorage`, cleared when the browser tab/session ends.
[Update this section if cookies, persistent local storage, or third-party
tracking scripts are added later — those typically require a cookie
consent banner in the EU/UK and disclosure under CCPA.]

## 7. Children's privacy

The Service is not directed at children under [AGE — align with the
minimum age set in `TERMS_OF_SERVICE.md` and applicable law, e.g. COPPA's
under-13 threshold in the US]. [If the Service may in practice be used by
minors, this section needs specific compliance work — age verification,
parental consent flows, and possibly COPPA-specific data handling — before
launch.]

## 8. Your rights

Depending on your location, you may have rights to access, correct,
delete, or export your personal data, or to object to certain processing.
[Detail the actual request process and response timeline once
implemented; this varies by jurisdiction — GDPR, CCPA/CPRA, and others
each specify their own required rights and timelines.]

## 9. International data transfers

[Complete once hosting infrastructure and legal entity locations are
finalized — required if data crosses borders, e.g. EU user data processed
on US servers.]

## 10. Changes to this policy

[Describe your actual notice mechanism for policy changes once decided.]

## 11. Contact

Questions about this policy: [PRIVACY CONTACT EMAIL].

---

See also: [`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md),
[`DISCLAIMER.md`](./DISCLAIMER.md).
