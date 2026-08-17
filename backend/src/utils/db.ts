import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 5;

export const connectDB = async (): Promise<void> => {
  let retries = 0;

  const attemptConnection = async () => {
    try {
      logger.info('Connecting to MongoDB...');
      await mongoose.connect(env.MONGO_URI);
      logger.info('Successfully connected to MongoDB.');
    } catch (error) {
      retries += 1;
      logger.error(
        error,
        `MongoDB connection failed (Attempt ${retries}/${MAX_RETRIES})`
      );

      if (retries < MAX_RETRIES) {
        logger.info(`Retrying MongoDB connection in ${RETRY_INTERVAL_MS / 1000} seconds...`);
        setTimeout(attemptConnection, RETRY_INTERVAL_MS);
      } else {
        logger.fatal('Could not connect to MongoDB after maximum retries. Exiting.');
        process.exit(1);
      }
    }
  };

  await attemptConnection();
};

export const closeDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    try {
      logger.info('Closing MongoDB connection...');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed successfully.');
    } catch (error) {
      logger.error(error, 'Error occurred while closing MongoDB connection');
    }
  }
};
