import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDB, closeDB } from './utils/db.js';
import { errorHandler } from './middleware/error.js';
import authRouter from './modules/auth/auth.routes.js';

const app = express();

// Set up CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Simple request logger middleware
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// Authentication routes
app.use('/auth', authRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// Global error handler (must be registered last)
app.use(errorHandler);

const startServer = async () => {
  // Connect to database
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

};

startServer().catch((error) => {
  logger.fatal(error, 'Unhandled error during server startup');
  process.exit(1);
});
export default app;
