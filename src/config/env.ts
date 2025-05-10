import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Loading .env from: ${envPath}`);

// Try to read the .env file manually
try {
  if (fs.existsSync(envPath)) {
    let envContents = fs.readFileSync(envPath, 'utf8');
    envContents = envContents.replace(/^\uFEFF/, '');
    envContents = envContents.replace(/[^\x20-\x7E\r\n]/g, '');
    // Parse the file line by line
    const envLines = envContents.split('\n');
    envLines.forEach(line => {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('='); // Reassemble value in case it contains '='
        if (key && value) {
          const cleanKey = key.trim();
          const cleanValue = value.trim();
          process.env[cleanKey] = cleanValue;
        }
      }
    });
  } else {
    console.error('File does not exist');
  }
} catch (error) {
  console.error('Error reading .env file manually:', error);
}

// Also try dotenv as a fallback
try {
  dotenv.config({ path: envPath });
} catch (error) {
  console.error('Error loading .env file with dotenv:', error);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3001', 10);
const VIDEO_STORAGE_PATH = process.env.VIDEO_STORAGE_PATH || 'uploads';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CLEANUP_CRON_SCHEDULE = process.env.CLEANUP_CRON_SCHEDULE || '0 3 * * *'; // Default: 3am daily
const CLEANUP_THRESHOLD_DAYS = parseInt(process.env.CLEANUP_THRESHOLD_DAYS || '7', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_EXTRACT_DURATION = parseInt(process.env.MAX_EXTRACT_DURATION || '1800', 10); // 30 minutes default

// Browser and cookie configuration for yt-dlp
const COOKIES_BROWSER = process.env.COOKIES_BROWSER || ''; // 'chrome', 'firefox', 'edge', etc.
const COOKIES_PROFILE = process.env.COOKIES_PROFILE || ''; // 'default', 'profile1', 'profile2', etc.
const COOKIES_FILE = process.env.COOKIES_FILE || ''; // cookies.txt path

// Create storage directory if it doesn't exist
if (!fs.existsSync(VIDEO_STORAGE_PATH)) {
  fs.mkdirSync(VIDEO_STORAGE_PATH, { recursive: true });
}

// Database config
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'videodowncut';

export default {
  nodeEnv: NODE_ENV,
  port: PORT,
  videoStoragePath: VIDEO_STORAGE_PATH,
  logLevel: LOG_LEVEL,
  cleanupCronSchedule: CLEANUP_CRON_SCHEDULE,
  cleanupThresholdDays: CLEANUP_THRESHOLD_DAYS,
  corsOrigin: CORS_ORIGIN,
  maxExtractDuration: MAX_EXTRACT_DURATION,
  cookiesBrowser: COOKIES_BROWSER,
  cookiesProfile: COOKIES_PROFILE,
  cookiesFile: COOKIES_FILE,
  db: {
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
  },
  isDev: NODE_ENV === 'development',
};
