import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { validationResult } from 'express-validator';
import * as videoService from '../services/videoService';
import logger from '../config/logger';
import { ApiError } from '../middlewares/errorHandler';
import streamUtils from '../utils/streamUtils';
import { CONTENT_TYPES } from '../config/constants';

// Download video
export const downloadVideo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Error') as ApiError;
      error.statusCode = 400;
      error.details = errors.array();
      return next(error);
    }

    const { url } = req.body;

    // Download video
    const video = await videoService.downloadVideo(url);

    // Get original video filename
    const filename = path.basename(video.filePath);

    // Return video information
    res.status(200).json({
      success: true,
      data: {
        videoId: video.videoId,
        title: video.title,
        duration: video.duration,
        thumbnail: video.thumbnail,
        formats: video.formats,
        downloadUrl: `/api/videos/download/${video.videoId}/${filename}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cut video
export const cutVideo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Error') as ApiError;
      error.statusCode = 400;
      error.details = errors.array();
      return next(error);
    }

    const { videoId } = req.params;
    const { cutOptions } = req.body;
    const { startTime, endTime, format = 'mp4' } = cutOptions || {};

    // Cut video
    const outputPath = await videoService.cutVideo(videoId, startTime, endTime, format);

    // Convert backslashes to forward slashes for consistent URLs
    const normalizedPath = outputPath.replace(/\\/g, '/');
    const filename = path.basename(outputPath);

    // Return output path
    res.status(200).json({
      success: true,
      data: {
        outputPath: normalizedPath,
        streamUrl: `/api/videos/stream/${videoId}/${filename}`,
        downloadUrl: `/api/videos/download/${videoId}/${filename}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Stream video
export const streamVideo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('ngrok-skip-browser-warning', 'any');
    const { videoId, filename } = req.params;

    // If filename is provided, stream a specific cut video
    if (filename) {
      const videoInfo = await videoService.getVideoInfo(videoId);
      const videoDir = path.dirname(videoInfo.filePath);
      const filePath = path.join(videoDir, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        const error = new Error('Video file not found') as ApiError;
        error.statusCode = 404;
        return next(error);
      }

      // Determine content type based on file extension
      const contentType = getContentType(path.extname(filePath));
      streamUtils.streamFile(req, res, filePath, contentType, next);
    } else {
      // Stream the original video
      const filePath = await videoService.getVideoPath(videoId);
      const contentType = getContentType(path.extname(filePath));
      streamUtils.streamFile(req, res, filePath, contentType, next);
    }
  } catch (error) {
    next(error);
  }
};

// Stream video by file path
export const streamByFilePath = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filePath } = req.query;

    if (!filePath || typeof filePath !== 'string') {
      const error = new Error('File path is required') as ApiError;
      error.statusCode = 400;
      return next(error);
    }

    // Ensure path is within the uploads directory
    if (!isPathWithinUploads(filePath)) {
      const error = new Error('Invalid file path') as ApiError;
      error.statusCode = 403;
      return next(error);
    }

    const contentType = getContentType(path.extname(filePath as string));
    streamUtils.streamFile(req, res, filePath as string, contentType, next);
  } catch (error) {
    next(error);
  }
};

// Helper function to determine content type based on file extension
const getContentType = (extension: string): string => {
  switch (extension.toLowerCase()) {
    case '.mp4':
      return CONTENT_TYPES.MP4;
    case '.webm':
      return CONTENT_TYPES.WEBM;
    case '.mkv':
      return CONTENT_TYPES.MKV;
    case '.mp3':
      return CONTENT_TYPES.MP3;
    case '.m4a':
      return CONTENT_TYPES.M4A;
    default:
      return CONTENT_TYPES.DEFAULT;
  }
};

// Helper function to check if path is within uploads directory
const isPathWithinUploads = (filePath: string): boolean => {
  const normalizedPath = path.normalize(filePath);
  return normalizedPath.startsWith(path.normalize(process.env.VIDEO_STORAGE_PATH || 'uploads'));
};

// Download video as MP3
export const downloadMp3 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Error') as ApiError;
      error.statusCode = 400;
      error.details = errors.array();
      return next(error);
    }

    const { videoId } = req.params;
    const { startTime, endTime } = req.query;

    // Convert to MP3
    const outputPath = await videoService.convertVideoToMp3(
      videoId,
      startTime as string | undefined,
      endTime as string | undefined,
    );

    // Convert backslashes to forward slashes for consistent URLs
    const normalizedPath = outputPath.replace(/\\/g, '/');
    const filename = path.basename(outputPath);

    // Return MP3 path
    res.status(200).json({
      success: true,
      data: {
        outputPath: normalizedPath,
        downloadUrl: `/api/videos/download/${videoId}/${filename}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Download file directly
export const downloadFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId, filename } = req.params;

    if (!filename) {
      const error = new Error('Filename is required') as ApiError;
      error.statusCode = 400;
      return next(error);
    }

    // Get video info to find the base path
    const videoInfo = await videoService.getVideoInfo(videoId);
    const videoDir = path.dirname(videoInfo.filePath);
    const filePath = path.join(videoDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      const error = new Error('File not found') as ApiError;
      error.statusCode = 404;
      return next(error);
    }

    // Send file as attachment for download
    res.download(filePath, filename, err => {
      if (err) {
        logger.error(`Error downloading file: ${err}`);
        const error = new Error('Error processing download') as ApiError;
        error.statusCode = 500;
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

// Download original video using just videoId
export const downloadOriginalVideo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId } = req.params;

    // Get video info to find the original video path
    const videoInfo = await videoService.getVideoInfo(videoId);
    const filePath = videoInfo.filePath;

    // Get filename from path
    const filename = path.basename(filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      const error = new Error('Video file not found') as ApiError;
      error.statusCode = 404;
      return next(error);
    }

    // Send file as attachment for download
    res.download(filePath, filename, err => {
      if (err) {
        logger.error(`Error downloading video: ${err}`);
        const error = new Error('Error processing download') as ApiError;
        error.statusCode = 500;
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  downloadVideo,
  cutVideo,
  streamVideo,
  downloadMp3,
  downloadFile,
  downloadOriginalVideo,
};
