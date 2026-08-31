import { Router } from 'express';
import { z } from 'zod';
import { comparePassword, hashPassword, signToken } from '../lib/auth.js';
import { createUserWithWalletAndChannel, findUserByUsername, getWalletBalance } from '../db/repo.js';
import type { AuthResponse, PublicUser } from '@streamarena/shared';

export const authRouter = Router();

const colors = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6'];
function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'letters, numbers, underscore only'),
  displayName: z.string().min(1).max(32).optional(),
  password: z.string().min(6).max(72),
  email: z.string().email().optional(),
});

function toPublicUser(u: {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  fullAccessGranted: boolean;
  createdAt: string;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
    fullAccessGranted: u.fullAccessGranted,
    createdAt: u.createdAt,
  };
}

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }
  const { username, password, email } = parsed.data;
  const displayName = parsed.data.displayName ?? username;

  if (findUserByUsername(username)) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await hashPassword(password);
  const { user, walletBalance } = createUserWithWalletAndChannel({
    username,
    displayName,
    passwordHash,
    avatarColor: randomColor(),
    channelTitle: `${displayName}'s stream`,
    email,
  });

  const token = signToken({ sub: user.id, username: user.username });
  const body: AuthResponse = {
    user: toPublicUser(user),
    token,
    wallet: { balance: walletBalance },
  };
  res.status(201).json(body);
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { username, password } = parsed.data;
  const user = findUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ sub: user.id, username: user.username });
  const body: AuthResponse = {
    user: toPublicUser(user),
    token,
    wallet: { balance: getWalletBalance(user.id) },
  };
  res.json(body);
});
