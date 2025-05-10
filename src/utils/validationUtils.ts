/**
 * Common validation utilities
 */
import { VIDEO_FORMATS, VIDEO_ID_PATTERNS, TIME_FORMAT } from '../config/constants';

/**
 * Validate video ID format
 * Supports YouTube/Vimeo style IDs and Twitter numeric IDs
 */
export const isValidVideoId = (videoId: string): boolean => {
  return VIDEO_ID_PATTERNS.YOUTUBE_VIMEO.test(videoId) || VIDEO_ID_PATTERNS.TWITTER.test(videoId);
};

/**
 * Validate time format (HH:MM:SS or MM:SS)
 */
export const isValidTimeFormat = (time: string): boolean => {
  return TIME_FORMAT.test(time);
};

/**
 * Validate URL
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validate video format
 */
export const isValidVideoFormat = (format: string): boolean => {
  return VIDEO_FORMATS.includes(format);
};

export default {
  isValidVideoId,
  isValidTimeFormat,
  isValidUrl,
  isValidVideoFormat,
};
