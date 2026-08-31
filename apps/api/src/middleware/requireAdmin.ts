import type { NextFunction, Response } from 'express';
import { env } from '../lib/env.js';
import type { AuthedRequest } from './requireAuth.js';

// Deliberately simple (env-listed usernames, not a DB role/permission
// system) — this is a prototype-grade gate for the Support Inbox, and
// should be replaced with real role-based access control before any real
// staff member relies on it. See SECURITY.md.
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.username || !env.adminUsernames.includes(req.username)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
