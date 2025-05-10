import logger from './logger';

/**
 * Checks if all required environment variables are set
 * @returns boolean True if all required variables are set
 */
export const checkEnvVariables = (): boolean => {
  const requiredVariables = [
    'PORT',
    'VIDEO_STORAGE_PATH',
    'LOG_LEVEL',
    'CLEANUP_CRON_SCHEDULE',
    'CLEANUP_THRESHOLD_DAYS',
    'CORS_ORIGIN',
    'MAX_EXTRACT_DURATION',
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  const missingVariables = requiredVariables.filter(variable => {
    return !process.env[variable];
  });

  if (missingVariables.length === 0) {
    return true;
  }

  logger.warn(
    `Missing required environment variables: ${missingVariables.join(', ')}. Using default values.`,
  );
  return false;
};

/**
 * Checks for potentially insecure configurations
 */
export const checkSecuritySettings = (): void => {
  // Check for default database credentials
  if (process.env.POSTGRES_URI?.includes('postgres:postgres')) {
    logger.warn('Default database credentials detected. Consider changing for production use.');
  }

  // Check for development mode in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.POSTGRES_URI?.includes('localhost')) {
      logger.warn('Production environment detected with localhost database. Verify configuration.');
    }
  }
};

export default {
  checkEnvVariables,
  checkSecuritySettings,
};
