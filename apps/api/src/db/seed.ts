import { hashPassword } from '../lib/auth.js';
import { createUserWithWalletAndChannel, findUserByUsername, seedSetChannelLive } from './repo.js';

const DEMO_USERS = [
  { username: 'nova_plays', displayName: 'Nova', title: 'Endless Arena grind — chasing #1', live: true },
  { username: 'pixelqueen', displayName: 'PixelQueen', title: 'Chill arena + chatting', live: true },
  { username: 'kilobyte', displayName: 'Kilobyte', title: 'Late night wager rounds', live: false },
];

async function main() {
  for (const u of DEMO_USERS) {
    if (findUserByUsername(u.username)) {
      console.log(`skip (exists): ${u.username}`);
      continue;
    }
    const passwordHash = await hashPassword('password123');
    createUserWithWalletAndChannel({
      username: u.username,
      displayName: u.displayName,
      passwordHash,
      avatarColor: '#7c3aed',
      channelTitle: u.title,
    });
    if (u.live) seedSetChannelLive(u.username, true, new Date().toISOString());
    console.log(`seeded ${u.username} (password123)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
