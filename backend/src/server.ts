import 'dotenv/config';
import { createApp, corsOrigins } from './app';

const PORT = Number(process.env.PORT ?? 8787);

createApp().listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(`[backend] CORS origins: ${corsOrigins().join(', ') || '(none)'}`);
});
