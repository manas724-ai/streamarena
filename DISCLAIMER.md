# Disclaimer

**This document is informational, not legal advice.** Aussi-Nexus Group
should have this repository, and the product built from it, reviewed by
qualified legal counsel — licensed in every jurisdiction it will operate
in — before any public launch, real-money integration, or handling of
real user data. Nothing here or elsewhere in this repository substitutes
for that review.

## Prototype status

This codebase is an early-stage prototype. It demonstrates working
end-to-end functionality (authentication, live chat, WebRTC broadcast, a
real-time multiplayer game, and a virtual-currency ledger) but has **not**
undergone security auditing, load testing, accessibility review, or legal
review. Known simplifications, and what they'd need to become
production-grade, are listed in `README.md` under "Scaling to production."
Treat every part of it — the code, the legal document templates in this
repository, and this disclaimer itself — as a starting point to be
reviewed, not a finished, launch-ready product.

## Virtual currency & wagering — read this before enabling real payments

The Arena includes a feature where users stake "sparks" (the platform's
virtual currency, purchasable with real money via the mock payment
provider in `apps/api/src/lib/payments.ts`) into a pool that pays out to
other users based on in-game performance. **Before connecting this feature
to real payments or launching it publicly, have counsel evaluate whether
it is legally a game of skill, a game of chance, or a hybrid, in every
jurisdiction you plan to operate in** — this determination varies by
jurisdiction and can carry gambling-license, tax, age-verification, and
consumer-protection obligations (including rules specific to loot boxes
and in-game wagering that several jurisdictions have adopted in recent
years). Relevant facts to bring to that review: currency can currently be
purchased with real money but the prototype has no mechanism to redeem or
cash out sparks back to real currency (a fact that affects, but does not
by itself resolve, the legal classification in most places); payouts are
weighted by in-game score rather than drawn at random; and there is no
age-verification, self-exclusion, or spending-limit tooling implemented.
None of this should be read as a conclusion that the feature is, or is
not, gambling — that determination requires jurisdiction-specific legal
analysis this repository does not attempt to provide.

## AI-managed support — what "self-triggered agent" actually means here

Email, live chat, and first-line technical support are handled by an AI
agent pipeline with no human in the loop by default (see README.md
"AI-managed support desk"). Before relying on this in production, know
what that does and doesn't cover:

- **The escalation rules are a starting point, not a complete safety
  net.** `apps/api/src/support/triage.ts` uses keyword/regex matching to
  route safety concerns, legal requests, billing disputes, and abuse
  reports to a human queue instead of letting the AI resolve them. Regex
  patterns miss phrasing their authors didn't think of — this needs
  ongoing tuning against real traffic, and periodic human review of
  tickets the system did *not* escalate, not a one-time setup.
- **The AI can still get non-escalated answers wrong.** Even grounded in a
  knowledge base and instructed not to invent policy, a language model can
  produce a plausible-sounding but incorrect response. Nothing in this
  system verifies AI output against the knowledge base before sending it.
- **No human currently monitors this by default.** The `/admin/support`
  inbox exists so a human *can* audit what the agent has been doing and
  catch problems, but nothing pages anyone — an operator needs to decide
  how often a person actually checks it, and should treat "AI-managed"
  as "AI-first-line, human-audited," not "human review optional."
- **Regulatory context**: several jurisdictions are actively developing
  disclosure requirements for AI customer-service interactions (e.g.,
  requiring users be told they're talking to a bot, or offering an
  explicit path to a human on request — which this system does implement
  via the "talk to a human" trigger phrase). Confirm current requirements
  in every jurisdiction StreamArena operates in before launch.

## No warranty

The software is provided "as is" as stated in `LICENSE`, without warranty
of any kind. Aussi-Nexus Group and any contributors to this repository
disclaim liability for damages arising from its use, to the maximum
extent permitted by applicable law.

## Data handling

The prototype stores user data (accounts, chat messages, transaction
history) in a local SQLite database with no encryption at rest, no backup
strategy, and no data-retention or deletion tooling beyond what's in the
schema. It is not configured to meet GDPR, CCPA, COPPA, or comparable
data-protection obligations out of the box. See `PRIVACY_POLICY.md` for
the template privacy disclosures that would need to become accurate
before real user data is collected, and have counsel confirm the
underlying data practices actually match that document before publishing
it.

## Trademarks and third-party names

Product names, platform names, and companies referenced in this
repository (e.g., in `README.md`'s discussion of the competitive
landscape) are used descriptively for comparison and are the property of
their respective owners. No affiliation with or endorsement by those
companies is claimed or implied. See `TRADEMARKS.md` for StreamArena's own
marks.

## AI-assisted development

Portions of this codebase, and the legal document templates in this
repository (`TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`, this file, and
`LICENSE`), were drafted with AI assistance and organized for Aussi-Nexus
Group's review rather than independently drafted by an attorney. Legal
documents in particular are templates: read the notice at the top of each
one before treating it as final.
