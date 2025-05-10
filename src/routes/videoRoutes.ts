import express from 'express';
import { body, param, query } from 'express-validator';
import videoController from '../controllers/videoController';
import validationUtils from '../utils/validationUtils';

const router = express.Router();

// Common validation for video ID
const validateVideoId = param('videoId')
  .notEmpty()
  .withMessage('Video ID is required')
  .custom(value => validationUtils.isValidVideoId(value))
  .withMessage('Invalid video ID format');

// Common validation for time format
const validateTimeFormat = (field: string) =>
  field === 'startTime'
    ? body(`cutOptions.${field}`)
        .notEmpty()
        .withMessage('Start time is required')
        .custom(value => validationUtils.isValidTimeFormat(value))
        .withMessage('Start time must be in format HH:MM:SS or MM:SS')
    : body(`cutOptions.${field}`)
        .notEmpty()
        .withMessage('End time is required')
        .custom(value => validationUtils.isValidTimeFormat(value))
        .withMessage('End time must be in format HH:MM:SS or MM:SS');

// Download video route
router.post(
  '/download',
  [
    body('url')
      .notEmpty()
      .withMessage('URL is required')
      .custom(value => validationUtils.isValidUrl(value))
      .withMessage('URL must be valid'),
  ],
  videoController.downloadVideo,
);

// Cut video route
router.post(
  '/cut/:videoId',
  [
    validateVideoId,
    validateTimeFormat('startTime'),
    validateTimeFormat('endTime'),
    body('cutOptions.format')
      .optional()
      .custom(value => validationUtils.isValidVideoFormat(value))
      .withMessage('Format must be one of: mp4, webm, mkv'),
  ],
  videoController.cutVideo,
);

// Stream video route
router.get('/stream/:videoId/:filename?', [validateVideoId], videoController.streamVideo);

// MP3 download route
router.get(
  '/mp3/:videoId',
  [
    validateVideoId,
    query('startTime')
      .optional()
      .custom(value => validationUtils.isValidTimeFormat(value))
      .withMessage('Start time must be in format HH:MM:SS or MM:SS'),
    query('endTime')
      .optional()
      .custom(value => validationUtils.isValidTimeFormat(value))
      .withMessage('End time must be in format HH:MM:SS or MM:SS'),
  ],
  videoController.downloadMp3,
);

// Direct download route
router.get(
  '/download/:videoId/:filename',
  [validateVideoId, param('filename').notEmpty().withMessage('Filename is required')],
  videoController.downloadFile,
);

// Download original video with just the videoId
router.get('/download/:videoId', [validateVideoId], videoController.downloadOriginalVideo);

export default router;
