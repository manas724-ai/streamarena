# StreamArena

**© 2026 Aussi-Nexus Group. All Rights Reserved.** Proprietary and
confidential — see [`LICENSE`](./LICENSE). This is not open-source
software; see the "License & legal" section below.

A live-streaming platform built around **The Arena** — a single, persistent
multiplayer world that never resets. Streamers broadcast over real WebRTC,
chat happens over WebSocket in real time, viewers can drop into the Arena
mid-stream, and every part of the monetization loop (gifts, wagers, currency
purchases) is wired end to end.

This is a genuine full-stack build — not a mockup. Everything described
below runs locally and was verified running (REST calls, WebSocket bots,
and a real headless-browser pass through registration, chat, the arena
game, and going live) before being handed to you.

## Why this concept

You asked for whichever concept would generate the most revenue. Pure
livestreaming (ads/subs/gifts) and pure gaming (wagers/cosmetics/entry
fees) are both proven, but they're strongest **combined** — it's the model
behind Kick, TikTok Live, and Twitch's own push into interactive
extensions: a stream keeps people in the room, an always-on competitive
game gives them a reason to spend inside it. StreamArena's monetization
surface has three independent levers so you're not dependent on any one of
them working: virtual-currency purchases (the direct revenue line), gifting
during live streams (a social/status purchase, typically the highest ARPU
lever on livestreaming platforms), and Arena wager pots (a recurring
game-loop purchase, rotating every 60 seconds instead of once per session).

## Architecture

```
apps/
  api/      Node.js + TypeScript backend
    src/routes/       REST: auth, channels, wallet/gifts
    src/ws/           Socket.IO namespaces: /chat /rtc /arena
    src/game/arena.ts Server-authoritative game loop (20 Hz)
    src/db/           SQLite (dev) via repo.ts — see "Scaling" below
  web/      React 19 + TypeScript + Vite + Tailwind v4 frontend
    src/pages/        Landing, Watch, Play (Arena), Dashboard, Wallet, Auth
    src/game/         Canvas-rendered Arena client
    src/components/   VideoBroadcast/VideoViewer (WebRTC), Chat, Gifts
packages/
  shared/   Types + Socket.IO event constants shared by both apps —
            this is what keeps the realtime protocol from drifting
```

**Realtime transport.** Three Socket.IO namespaces, each doing one job:
`/chat` (rooms per channel, presence counts, chat history ring buffer),
`/rtc` (pure WebRTC signaling relay — SDP/ICE only, media never touches the
server), `/arena` (game input in, world snapshots out at 20 Hz). All three
are behind a Redis pub/sub adapter (`@socket.io/redis-adapter`) so this
already runs correctly behind a load balancer with N API instances — it
just falls back to in-memory if Redis isn't reachable, which is why it
still works with zero extra setup on your machine.

**The Arena game loop is server-authoritative.** Clients only ever send an
input angle + boost flag; the server owns every position, collision, and
score. That's deliberate — it's the same trust model real competitive
multiplayer games use, and it's what makes a modified client unable to
cheat. The world is a singleton that starts when the process boots and
never resets; "rounds" only rotate the wager pot every 60 seconds.

**WebRTC broadcast is browser-native, no media server.** The streamer opens
one `RTCPeerConnection` per viewer; the API only relays signaling messages.
This is genuinely functional today (verified with fake media devices end to
end) with zero native dependencies to install — see "Scaling" for the
ceiling on this approach and the drop-in fix.

**Data layer.** Prisma was the original plan, but this sandbox's network
policy blocks `binaries.prisma.sh` (the host Prisma's CLI downloads its
query engine from), so the ORM couldn't install here. Rather than hand you
something that doesn't run, the whole data layer moved to Node 22's
built-in `node:sqlite` module — zero native downloads, zero build step,
works anywhere Node runs. `src/db/repo.ts` is a small hand-rolled
repository layer; every function in it is the seam you'd point at Postgres
in production (see "Scaling"). Nothing outside that one file knows the
storage is SQLite.

## Running it

Requirements: Node 20+ (built and tested on Node 22), and optionally Redis
(falls back gracefully if not running).

```bash
npm install                                  # installs all three workspaces

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

npm run dev:api                              # http://localhost:4000
npm run dev:web                              # http://localhost:5173 (separate terminal)

# optional, separate terminal — a few demo streamers so Discover isn't empty
npm run --workspace apps/api seed
```

Open two browser windows: register/log in as one user, go live from
**Creator dashboard** (camera or screen share), then open
`/watch/<that username>` in the other window (logged in as someone else, or
a guest) to see the live video, chat, and Arena all connect for real.

To sanity-check the realtime layer without opening a browser:
`npm run bots --workspace apps/api` connects real Socket.IO clients, joins
chat, joins the Arena, drives two players around, and confirms snapshots
are arriving at the expected rate.

Seeded accounts: `nova_plays` / `pixelqueen` / `kilobyte`, password
`password123`.

## What's real vs. what's a documented seam

Genuinely working, end to end: registration/login (bcrypt + JWT), the
channel/discovery system, live chat with presence counts, WebRTC
broadcast + viewing, the Arena's full physics/collision/scoring loop with
bots, gifting (debits sender, credits streamer, broadcasts to chat),
currency purchase, arena wagering with pot payouts, and the transaction
ledger behind all of it.

Intentionally simplified, with the production path documented in-code and
below: the payment provider (`src/lib/payments.ts`) is a pluggable
interface with a mock implementation that "succeeds" instantly instead of
calling a real processor; WebRTC is mesh (fine for a handful of viewers,
not thousands); the DB is SQLite, not Postgres; there's no CDN, no video
recording/VOD, no moderation tooling, no mobile app.

## Scaling to production

Each of these is a swap at a specific seam, not a rewrite:

- **Database**: `src/db/repo.ts` is the only file that touches storage.
  Point it at Postgres (via `pg` or re-introducing an ORM once
  `binaries.prisma.sh`-style downloads aren't a constraint) and nothing
  above it changes. Add read replicas and shard by streamer ID once a
  single primary can't keep up.
- **Broadcast fan-out**: swap the mesh in `rtcSignaling.ts` /
  `VideoBroadcast.tsx` for an SFU (mediasoup or LiveKit) so the streamer
  uploads once and the server fans out to unlimited viewers; add HLS/DASH
  packaging off the SFU for viewer counts where WebRTC's latency advantage
  doesn't matter, and a CDN (CloudFront/Fastly) in front of that.
- **Realtime fan-out across instances**: already Redis-backed
  (`@socket.io/redis-adapter`); at higher scale, move chat history from
  in-process memory to Redis Streams/Lists and consider a dedicated
  gateway tier so the Arena's tick loop isn't sharing a process with HTTP.
- **The Arena at massive concurrency**: shard the world into multiple
  regions/instances once player count in one arena gets too dense for a
  single 20 Hz loop; add interest management (only send each client the
  slice of the snapshot near them) instead of the full world every tick.
- **Payments**: implement `PaymentProvider` (in `src/lib/payments.ts`) with
  real Stripe/Adyen — webhook-confirmed credit instead of instant mock
  success — without touching any route that calls it.
- **Deployment**: containerize each app, run behind a load balancer,
  Kubernetes (or ECS) once you need autoscaling; Socket.IO's sticky-session
  requirement is the one thing to configure explicitly at the LB.

## Monetization summary

| Lever | Mechanism | Where in the code |
|---|---|---|
| Currency purchase | Buy "sparks" in packs ($4.99–$49.99) | `apps/api/src/routes/wallet.ts`, `Wallet.tsx` |
| Gifting | Spend sparks on a streamer during a live chat | `wallet.ts` `/gift`, `GiftBar.tsx` |
| Arena wagers | Stake sparks into a 60s rotating pot, paid out by score share | `game/arena.ts`, `ws/arenaGateway.ts` |

All three write to one `transactions` ledger, so revenue reporting is a
single query away regardless of which lever it came from.

## Full Access — the payment gate

Registering and spectating are free; actually controlling a player in the
Arena requires a one-time $19.99 "Full Access Pass" purchase
(`FULL_ACCESS_PRODUCT` in `packages/shared`). This is enforced **server
side**, not just hidden in the UI: `ws/arenaGateway.ts`'s `ARENA_JOIN`
handler checks `hasFullAccess(userId)` against the database before it ever
creates a controllable player, and rejects with a typed reason
(`sign_in_required` or `full_access_required`) that the client renders as
a paywall overlay. A client can't bypass this by skipping a UI step — the
check happens on the same connection that would need to send game input.

## AI-managed support desk

Email, live chat, and first-line technical support all run through one
AI-agent pipeline (`apps/api/src/support/`), with a floating chat widget
on every page (`SupportWidget.tsx`) and a webhook endpoint for inbound
email (`POST /api/support/email/inbound`). The flow for every message,
either channel:

1. **Receipt** — an acknowledgment is sent/recorded immediately (before
   any AI processing), so there's proof of receipt independent of how long
   a substantive response takes.
2. **Triage** (`support/triage.ts`) — a deterministic, keyword-based
   classifier runs first and makes the escalation decision *before* the AI
   ever sees the message. This is the load-bearing safety design: the AI
   composes wording, but never overrides what triage decided needs a
   human. Billing disputes, account-security reports, abuse reports,
   explicit "let me talk to a human" requests, legal/data-rights requests,
   and — checked first, broadest patterns, third- and first-person
   phrasing both covered — anything raising a safety concern are all
   force-routed to a human queue.
3. **Respond** (`support/aiResponder.ts`) — for everything triage didn't
   escalate, the AI answers directly, grounded in
   `support/knowledgeBase.ts` and instructed not to invent policies or
   promises outside it. For escalated tickets, the AI still replies (that
   IS "self-triggered" — nobody has to notice and reply manually) but only
   ever sends a scoped acknowledgment, never an attempted resolution.
4. **Audit trail** — every ticket and message is persisted
   (`support_tickets`/`support_messages`), visible at `/admin/support` to
   usernames listed in `ADMIN_USERNAMES`. "AI-managed" doesn't mean
   invisible: a human can see everything the agent said and pick up
   anything flagged, without which nobody would ever notice if the AI
   started getting something wrong.

**Two providers, same pluggable pattern as payments**: `EmailProvider`
(`support/emailProvider.ts`) and the AI responder itself both run against
a mock/fallback by default — a console-logged mock email "send", and
deterministic category-based templates — so the whole loop genuinely
works with zero external credentials. Set `ANTHROPIC_API_KEY` to have the
agent generate real Claude-written replies instead (see `.env.example`);
set a real email provider by implementing `EmailProvider`. Neither swap
touches `ticketService.ts`'s orchestration logic.

**Where "100% AI managed" has a hard limit, on purpose**: safety mentions
(self-harm, abuse, a child in danger), legal/regulatory requests, and
billing disputes are never auto-resolved, regardless of how confident the
AI sounds — see `DISCLAIMER.md`. This isn't a partial implementation of
what was asked; it's the same reasoning as the wagering-feature disclaimer
elsewhere in this README: getting those categories wrong isn't recoverable
with a follow-up message the way a wrong FAQ answer is, so they're
hard-routed to a human rather than left to model confidence. The triage
rules are regexes in one file (`support/triage.ts`) — read them before
relying on this in production, and treat the initial pattern list as a
starting point that needs expanding based on real traffic, not a complete
safety net.

## License & legal

This repository is **proprietary to Aussi-Nexus Group** — see
[`LICENSE`](./LICENSE) for the full terms (no license is granted to use,
copy, modify, or distribute this code without written permission).

- [`LICENSE`](./LICENSE) — proprietary software license
- [`NOTICE.md`](./NOTICE.md) — third-party/open-source components used and
  AI-assisted development disclosure
- [`TRADEMARKS.md`](./TRADEMARKS.md) — trademark notice
- [`DISCLAIMER.md`](./DISCLAIMER.md) — prototype status, and **an
  important note on the Arena's wagering feature and gambling-law
  considerations** before connecting it to real payments
- [`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md) and
  [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — **templates**, not final
  legal documents; both require attorney review and completion of the
  bracketed placeholders before publishing them to real users
- [`SECURITY.md`](./SECURITY.md) — how to report a vulnerability, and a
  list of known security gaps to close before production
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
  [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — contribution workflow for
  authorized contributors

None of the above constitutes legal advice — see the notice at the top of
`DISCLAIMER.md`.

## Repository structure for GitHub

This repo includes standard GitHub tooling: issue templates and a PR
template under `.github/`, a CI workflow (`.github/workflows/ci.yml`) that
installs dependencies and builds both `apps/api` and `apps/web` on every
push/PR, and a `CODEOWNERS` file (fill in real GitHub handles before
relying on it for review enforcement). To publish:

```bash
git init                       # if not already a git repo
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-org>/<your-repo>.git
git push -u origin main
```

Before making the repository public, double check: `.env` files are
gitignored (never committed — confirm with `git status` after copying
`.env.example` → `.env` locally), the placeholders in `LICENSE`,
`TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`, `SECURITY.md`,
`CODE_OF_CONDUCT.md`, and `CODEOWNERS` are filled in, and the legal
documents have been reviewed by counsel per the notices in each file.
