import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error.js';
import { tripsRouter } from './routes/trips.js';
import { expensesRouter } from './routes/expenses.js';
import { photosRouter } from './routes/photos.js';
import { discoveriesRouter } from './routes/discoveries.js';
import { traveloguesRouter } from './routes/travelogues.js';

const app = express();

const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
app.use(cors({
  origin: allowed.includes('*') ? true : allowed,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/trips', tripsRouter);
app.use('/trips', expensesRouter);     // /trips/:tripId/expenses, /settlement
app.use('/trips', photosRouter);       // /trips/:tripId/photos*
app.use('/discoveries', discoveriesRouter);
app.use('/trips', traveloguesRouter);  // /trips/:tripId/travelogues*

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`TripMate server listening on :${env.PORT}`);
});
