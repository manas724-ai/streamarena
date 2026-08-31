# Contributing to StreamArena

This repository is proprietary to Aussi-Nexus Group (see `LICENSE`). It is
not currently open to unsolicited public contributions — pull requests
from outside the organization will typically be closed unless you've been
explicitly invited to contribute under a separate agreement (e.g., a
contractor agreement or CLA) with Aussi-Nexus Group.

## For Aussi-Nexus Group employees & authorized contributors

1. **Branch from `main`.** Use a short descriptive branch name, e.g.
   `feat/arena-power-ups` or `fix/wallet-race-condition`.
2. **Keep the workspaces in sync.** This is an npm workspaces monorepo
   (`apps/api`, `apps/web`, `packages/shared`). If you change a type or
   constant in `packages/shared`, update both apps that consume it in the
   same change.
3. **Before opening a PR**, run from the repo root:
   ```bash
   npm install
   npm run build:api
   npm run build:web
   ```
   Both must succeed with no TypeScript errors. The CI workflow in
   `.github/workflows/ci.yml` runs the same checks automatically.
4. **Write commit messages that explain why**, not just what — e.g.
   "Fix wallet race condition on concurrent gifts" rather than "update
   wallet.ts".
5. **Flag anything touching money, wagering, or personal data** in your PR
   description explicitly — those changes may need a second look against
   `DISCLAIMER.md` and the legal document templates before merging,
   particularly anything that moves the Arena wagering feature closer to
   real-money integration.
6. **Don't commit secrets.** `.env` files are gitignored; use
   `.env.example` to document new environment variables without values.

## Reporting bugs or security issues

- Functional bugs: open a GitHub issue using the bug report template.
- Security vulnerabilities: **do not** open a public issue — see
  `SECURITY.md`.

## Code style

The codebase is TypeScript throughout with `strict` mode on. There's no
enforced linter/formatter configured yet (see `README.md`'s "known
simplifications" for other items in this category) — match the style of
the surrounding code until one is added.
