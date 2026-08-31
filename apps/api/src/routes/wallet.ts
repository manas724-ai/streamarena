import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { CURRENCY_PACKS, FULL_ACCESS_PRODUCT, GIFT_CATALOG, SOCKET_EVENTS } from '@streamarena/shared';
import { paymentProvider } from '../lib/payments.js';
import { getIO } from '../ws/io.js';
import {
  createGiftEvent,
  createTransaction,
  creditWallet,
  findUserById,
  getChannelBySlug,
  getWalletBalance,
  grantFullAccess,
  hasFullAccess,
  listTransactions,
  tryDebitWallet,
} from '../db/repo.js';

export const walletRouter = Router();

walletRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json({ balance: getWalletBalance(req.userId!) });
});

walletRouter.get('/me/transactions', requireAuth, async (req: AuthedRequest, res) => {
  res.json(listTransactions(req.userId!, 50));
});

walletRouter.get('/packs', (_req, res) => res.json(CURRENCY_PACKS));
walletRouter.get('/gifts', (_req, res) => res.json(GIFT_CATALOG));
walletRouter.get('/full-access-product', (_req, res) => res.json(FULL_ACCESS_PRODUCT));

walletRouter.get('/me/full-access', requireAuth, async (req: AuthedRequest, res) => {
  res.json({ fullAccessGranted: hasFullAccess(req.userId!) });
});

// Real-money one-time purchase that unlocks playing (not just spectating)
// in the Arena. Note the payment gate is enforced server-side on the /arena
// socket namespace (see arenaGateway.ts) — this endpoint only records the
// purchase; a client can't self-grant access by skipping this call.
walletRouter.post('/purchase-full-access', requireAuth, async (req: AuthedRequest, res) => {
  if (hasFullAccess(req.userId!)) return res.json({ fullAccessGranted: true, alreadyOwned: true });

  const result = await paymentProvider.purchaseFullAccess(req.userId!, FULL_ACCESS_PRODUCT.priceUsd);
  if (!result.ok) return res.status(402).json({ error: 'Payment failed' });

  grantFullAccess(req.userId!);
  createTransaction(req.userId!, 'full_access_purchase', 0, result.providerRef);
  res.json({ fullAccessGranted: true, alreadyOwned: false });
});

const purchaseSchema = z.object({ packId: z.string() });

walletRouter.post('/purchase', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const pack = CURRENCY_PACKS.find((p) => p.id === parsed.data.packId);
  if (!pack) return res.status(404).json({ error: 'Unknown pack' });

  const result = await paymentProvider.purchaseCurrency(req.userId!, pack.id, pack.sparks, pack.priceUsd);
  if (!result.ok) return res.status(402).json({ error: 'Payment failed' });

  creditWallet(req.userId!, pack.sparks, 'purchase', result.providerRef);
  res.json({ balance: getWalletBalance(req.userId!) });
});

const giftSchema = z.object({ channelSlug: z.string(), giftId: z.string() });

walletRouter.post('/gift', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = giftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const gift = GIFT_CATALOG.find((g) => g.id === parsed.data.giftId);
  if (!gift) return res.status(404).json({ error: 'Unknown gift' });

  const channel = getChannelBySlug(parsed.data.channelSlug);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.streamerId === req.userId) return res.status(400).json({ error: "Can't gift yourself" });

  const debited = tryDebitWallet(req.userId!, gift.cost, 'gift_sent', `${gift.id}->${channel.slug}`);
  if (!debited) return res.status(402).json({ error: 'Insufficient balance' });

  const sender = findUserById(req.userId!);
  creditWallet(channel.streamerId, gift.cost, 'gift_received', `${gift.id} from ${sender?.username}`);
  createGiftEvent(channel.id, req.userId!, channel.streamerId, gift.id, gift.cost);

  // Broadcast to the live chat room so everyone sees the gift animation/message immediately.
  getIO().of('/chat').to(channel.slug).emit(SOCKET_EVENTS.GIFT_RECEIVED, {
    channelSlug: channel.slug,
    fromUsername: sender?.username,
    gift,
  });

  res.json({ balance: getWalletBalance(req.userId!) });
});
