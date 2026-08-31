import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import type { ChannelSummary } from '@streamarena/shared';
import { getViewerCount } from '../ws/presence.js';
import {
  getChannelBySlug,
  listChannels,
  setChannelLive,
  updateChannelForStreamer,
  type ChannelRow,
} from '../db/repo.js';

export const channelsRouter = Router();

function toSummary(c: ChannelRow): ChannelSummary {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    streamerId: c.streamerId,
    streamerUsername: c.streamerUsername,
    isLive: c.isLive,
    viewerCount: getViewerCount(c.slug),
    startedAt: c.startedAt,
    tags: c.tags ? c.tags.split(',').filter(Boolean) : [],
  };
}

channelsRouter.get('/', async (_req, res) => {
  res.json(listChannels().map(toSummary));
});

channelsRouter.get('/:slug', async (req, res) => {
  const channel = getChannelBySlug(req.params.slug);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  res.json(toSummary(channel));
});

const updateSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  tags: z.array(z.string()).max(5).optional(),
});

channelsRouter.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const channel = updateChannelForStreamer(req.userId!, {
    title: parsed.data.title,
    tags: parsed.data.tags ? parsed.data.tags.join(',') : undefined,
  });
  res.json(toSummary(channel));
});

channelsRouter.post('/me/go-live', requireAuth, async (req: AuthedRequest, res) => {
  const channel = setChannelLive(req.userId!, true);
  res.json(toSummary(channel));
});

channelsRouter.post('/me/end-live', requireAuth, async (req: AuthedRequest, res) => {
  const channel = setChannelLive(req.userId!, false);
  res.json(toSummary(channel));
});
