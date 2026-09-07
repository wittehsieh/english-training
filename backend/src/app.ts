import express, { type Express } from 'express';
import cors from 'cors';
import { conversationRouter } from './routes/conversation';

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

  const allowed = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(cors({ origin: allowed.includes('*') ? true : allowed }));
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

export const corsOrigins = (): string[] =>
  (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
