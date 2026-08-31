import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  databaseUrl: required('DATABASE_URL', 'file:./dev.db'),
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  adminUsernames: (process.env.ADMIN_USERNAMES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
