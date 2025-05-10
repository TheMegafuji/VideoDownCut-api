import { DataSource } from 'typeorm';
import logger from './logger';
import env from './env';
import { Video } from '../models/Video';
import { DEFAULT_DB_CONFIG } from './constants';

// Get database configuration
const dbConfig = () => {
  // Use the database config from env
  const dbEnv = env.db;

  if (dbEnv) {
    return {
      host: dbEnv.host,
      port: dbEnv.port,
      username: dbEnv.username,
      password: dbEnv.password,
      database: dbEnv.database,
    };
  }

  // Fallback to default configuration
  return DEFAULT_DB_CONFIG;
};

// Determine if we're connecting to a cloud database (like AWS, Azure, etc.)
const isCloudDatabase = (host: string): boolean => {
  return (
    host.includes('.aws.') ||
    host.includes('.azure.') ||
    host.includes('.cloud.') ||
    host.includes('neon.tech')
  );
};

// Configure SSL based on the host
const configureSsl = () => {
  const host = dbConfig().host;

  // For cloud databases, we need proper SSL configuration
  if (isCloudDatabase(host)) {
    logger.info(`Cloud database detected at ${host}, configuring SSL`);
    return {
      ssl: {
        rejectUnauthorized: false, // Required for some cloud providers like Neon
      },
      extra: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    };
  }

  logger.info(`Local database detected at ${host}, no SSL required`);
  return {}; // No SSL for local databases
};

// Create TypeORM data source
export const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig(),
  synchronize: true, // Auto-create database schema (development only)
  logging: false,
  entities: [Video],
  subscribers: [],
  migrations: [],
  ...configureSsl(),
});

// Database connection function
export const connectDB = async (): Promise<void> => {
  try {
    logger.info('Attempting to connect to PostgreSQL database...');
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('PostgreSQL connected successfully');
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`PostgreSQL connection error: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
    } else {
      logger.error('Unknown PostgreSQL connection error');
    }
    process.exit(1);
  }
};

export default { connectDB, AppDataSource };
