import express, { type Express } from 'express';
import cors from 'cors';
import { conversationRouter } from './routes/conversation';

/**
 * A browser Origin header is scheme + host + port only — never a trailing
 * slash or a path. Strip a trailing slash from configured values so a
 * dashboard typo like "https://example.com/" still matches the real
 * "https://example.com" the browser sends, instead of silently failing CORS.
 */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? 'http://localhost:5173')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

/**
 * Builds the Express app. Used by:
 *   - `server.ts`  — local long-running server (`app.listen`)
 *   - `api/index.ts` — Vercel serverless entry (`export default app`)
 *
 * No `dotenv` here on purpose: locally `server.ts` loads `.env`; on Vercel the
 * env comes from the project settings.
 */
export function createApp(): Express {
  const app = express();

  const allowed = parseAllowedOrigins(process.env.CORS_ORIGIN);

  app.use(
    cors({
      origin: allowed.includes('*')
        ? true
        : (origin, callback) => {
            // Same-origin / non-browser requests (curl, health checks) send no
            // Origin header at all — always allow those.
            if (!origin || allowed.includes(normalizeOrigin(origin))) {
              callback(null, true);
            } else {
              callback(null, false);
            }
          },
    }),
  );
  app.use(express.json({ limit: '64kb' }));

  app.get('/', (_req, res) => {
    res.json({ service: 'workplace-english-adventure-backend', status: 'ok' });
  });

  app.use('/api/conversation', conversationRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

export const corsOrigins = (): string[] => parseAllowedOrigins(process.env.CORS_ORIGIN);
