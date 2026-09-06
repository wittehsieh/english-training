import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { conversationRouter } from './routes/conversation';

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  }),
);
app.use(express.json({ limit: '32kb' }));

app.get('/', (_req, res) => {
  res.json({ service: 'workplace-english-adventure-backend', status: 'ok' });
});

app.use('/api/conversation', conversationRouter);

// Fallback 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(`[backend] CORS origins: ${allowedOrigins.join(', ') || '(none)'}`);
});
