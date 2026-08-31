// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.
//
// Grounding context for the AI responder, and the source of truth for the
// deterministic fallback templates. Keeping this in one file means both
// paths give consistent, accurate answers — and it's the first place to
// update when a policy or feature changes.

export const KNOWLEDGE_BASE = `
StreamArena is a live-streaming platform built around The Arena, a persistent
multiplayer game that never resets.

Accounts & wallet: sign-up grants a 500 "spark" welcome bonus. Sparks are a
virtual currency purchased in packs (see /wallet); they are non-refundable
and have no cash value except as required by law (see TERMS_OF_SERVICE.md).

Full Access: playing (controlling a character) in the Arena requires a
one-time $19.99 "Full Access Pass" purchase. Spectating the Arena and using
chat remain free without it.

Gifting: sparks can be sent to a live streamer from their channel page;
this credits the streamer's wallet immediately.

Arena wagers: players who own Full Access can additionally stake sparks
into a pot that rotates and pays out every 60 seconds, weighted by score
among that round's wagering players. This is a real-money-adjacent feature
under legal review — see DISCLAIMER.md; support agents should not make
promises about payout odds or guarantees.

Technical: streaming uses browser-native WebRTC (camera or screen share).
Common fixes for a broadcaster with no video: check camera/mic permissions
in the browser, try a different browser (Chrome/Firefox), and confirm no
other app is holding the camera. Common fixes for a viewer stuck on
"waiting for the broadcaster": refresh the page, and confirm the streamer
is actually live from their dashboard.

Refunds & billing disputes: not something the AI agent resolves directly —
always escalated to a human for review.
`.trim();
