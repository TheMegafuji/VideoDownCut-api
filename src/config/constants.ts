/**
 * Application-wide constants
 */

// Supported video formats
export const VIDEO_FORMATS = ['mp4', 'webm', 'mkv'];

// Content types
export const CONTENT_TYPES = {
  MP4: 'video/mp4',
  WEBM: 'video/webm',
  MKV: 'video/x-matroska',
  MP3: 'audio/mpeg',
  M4A: 'audio/mp4',
  DEFAULT: 'application/octet-stream',
};

// Video ID regex patterns
export const VIDEO_ID_PATTERNS = {
  YOUTUBE_VIMEO: /^[a-zA-Z0-9_-]{5,20}$/,
  TWITTER: /^\d{15,25}$/,
};

// Time format regex
export const TIME_FORMAT = /^\d{1,2}:\d{2}(:\d{2})?$/;

// Default database connection
export const DEFAULT_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'videodowncut',
};

export default {
  VIDEO_FORMATS,
  CONTENT_TYPES,
  VIDEO_ID_PATTERNS,
  TIME_FORMAT,
  DEFAULT_DB_CONFIG,
};
