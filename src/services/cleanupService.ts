import cron from 'node-cron';
import logger from '../config/logger';
import videoService from './videoService';
import env from '../config/env';

// Initialize cleanup schedule
export const initCleanupSchedule = (): void => {
  // Convert days to cron schedule
  // Run at midnight based on the configured interval
  const cronSchedule = `0 0 */${env.cleanupThresholdDays} * *`;

  logger.info(`Initializing video cleanup schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      logger.info('Starting scheduled cleanup of old videos');

      const deletedCount = await videoService.cleanupOldVideos();

      logger.info(`Cleanup completed. Removed ${deletedCount} videos.`);
    } catch (error) {
      logger.error(`Cleanup job error: ${error}`);
    }
  });
};

// Run cleanup manually
export const runCleanup = async (): Promise<number> => {
  try {
    logger.info('Starting manual cleanup of old videos');

    const deletedCount = await videoService.cleanupOldVideos();

    logger.info(`Manual cleanup completed. Removed ${deletedCount} videos.`);

    return deletedCount;
  } catch (error) {
    logger.error(`Manual cleanup error: ${error}`);
    throw error;
  }
};

export default {
  initCleanupSchedule,
  runCleanup,
};
