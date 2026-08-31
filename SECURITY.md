# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in StreamArena, please report it
privately rather than opening a public GitHub issue:

- Email: [SECURITY CONTACT EMAIL — Aussi-Nexus Group: fill this in before
  publishing the repository, e.g. security@aussi-nexus.example]
- Please include: a description of the vulnerability, steps to reproduce
  it, and its potential impact.

We aim to acknowledge reports within [RESPONSE TIME — e.g. 3 business
days] and to keep you updated as we investigate and remediate.

Please do not publicly disclose the issue until we've had a reasonable
opportunity to address it.

## Scope & known limitations

This is an early-stage prototype (see `DISCLAIMER.md`). Some areas that
have **not** yet had a dedicated security review, and which a report is
especially welcome on, but which are also flagged here proactively so
they aren't a surprise:

- **Auth**: JWTs are signed with a single shared secret
  (`apps/api/.env` → `JWT_SECRET`) with no rotation or revocation list —
  a leaked secret invalidates the whole system's trust until rotated.
  Change the default secret in `.env.example` before any real deployment.
- **Rate limiting**: no rate limiting is implemented on auth, wallet, or
  chat endpoints/events yet — brute-force and spam-abuse protection is a
  pre-launch requirement, not yet built.
- **WebRTC signaling**: the `/rtc` namespace trusts any connected socket
  to claim the `broadcaster` role for a channel slug it names — there's no
  server-side check that the claiming socket's authenticated user actually
  owns that channel. This needs to be fixed before relying on it for
  anything beyond local testing.
- **Database**: SQLite file has no encryption at rest and no automated
  backups (see `README.md`'s "Scaling to production" for the Postgres
  migration path).
- **Dependencies**: run `npm audit` periodically; this repository does not
  yet have automated dependency-vulnerability scanning wired into CI.

## Supported versions

This project has not yet had a stable release; treat `main` as the only
supported branch until a versioning/release policy is established.
