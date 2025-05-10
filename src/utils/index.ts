/**
 * Utilities index file
 * Centralized exports from all utility modules
 */

// Import default exports from utility modules
import videoUtils from './videoUtils';
import validationUtils from './validationUtils';
import streamUtils from './streamUtils';

// Export utility modules for named imports
export { default as videoUtils } from './videoUtils';
export { default as validationUtils } from './validationUtils';
export { default as streamUtils } from './streamUtils';

// Export combined utilities as default
export default {
  // Video utilities
  generateFileHash: videoUtils.generateFileHash,
  execCommand: videoUtils.execCommand,
  sanitizeFilename: videoUtils.sanitizeFilename,
  extractVideoId: videoUtils.extractVideoId,
  getVideoInfo: videoUtils.getVideoInfo,
  downloadVideo: videoUtils.downloadVideo,
  cutVideo: videoUtils.cutVideo,
  getVideoDuration: videoUtils.getVideoDuration,
  convertToMp3: videoUtils.convertToMp3,

  // Validation utilities
  isValidVideoId: validationUtils.isValidVideoId,
  isValidTimeFormat: validationUtils.isValidTimeFormat,
  isValidUrl: validationUtils.isValidUrl,
  isValidVideoFormat: validationUtils.isValidVideoFormat,

  // Stream utilities
  streamFile: streamUtils.streamFile,
};
