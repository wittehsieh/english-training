import { createApp } from '../src/app';

/**
 * Vercel serverless entry. `vercel.json` rewrites every path here, and the
 * Express app does its own routing. Vercel injects env vars from the project
 * settings (OPENAI_API_KEY, OPENAI_MODEL, CORS_ORIGIN, …).
 */
export default createApp();
