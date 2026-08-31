# Notice

StreamArena
Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.

This repository and its contents — source code, game design, architecture
documentation, and associated assets — are proprietary to Aussi-Nexus
Group. See [`LICENSE`](./LICENSE) for full terms.

## Third-party software

This project is built on open-source packages that remain under their own
respective licenses (MIT, Apache-2.0, and others), fetched via `npm
install` and listed in each `apps/*/package.json` and
`packages/*/package.json`. Notably:

- **Backend**: Express, Socket.IO, `@socket.io/redis-adapter`, ioredis,
  bcryptjs, jsonwebtoken, zod, nanoid, and Node.js itself (including its
  built-in `node:sqlite` module).
- **Frontend**: React, React Router, Vite, Tailwind CSS, socket.io-client.

None of these projects are affiliated with or endorse Aussi-Nexus Group or
StreamArena. Run `npm ls --all` in each workspace, or inspect
`node_modules/<package>/LICENSE` after `npm install`, for the full text of
each dependency's license.

## AI-assisted development disclosure

Significant portions of this codebase were scaffolded and written with the
assistance of an AI coding tool (Claude). All AI-assisted output in this
repository has been organized and is intended to be reviewed by Aussi-Nexus
Group personnel before production use; see
[`DISCLAIMER.md`](./DISCLAIMER.md) for the scope of what has and has not
been verified.
