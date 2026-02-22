import fs from 'fs';
import path from 'path';
import logger from '../config/logger';
import env from '../config/env';
import { Video, VideoFormat } from '../models/Video';
import videoUtils from '../utils/videoUtils';
import { AppDataSource } from '../config/db';

// Get repository
const videoRepository = AppDataSource.getRepository(Video);

/**
 * Helper function to find video with fallback to prefixed IDs
 */
const findVideoWithFallback = async (videoId: string): Promise<{ video: Video | null; actualVideoId: string }> => {
  // Check if video exists - first try exact match
  let video = await videoRepository.findOne({ where: { videoId } });
  let actualVideoId = videoId;
  
  // If not found, try with common prefixes
  if (!video) {
    const prefixes = ['instagram_', 'tiktok_', 'url_'];
    for (const prefix of prefixes) {
      const prefixedVideoId = `${prefix}${videoId}`;
      video = await videoRepository.findOne({ where: { videoId: prefixedVideoId } });
      if (video) {
        logger.info(`Found video with prefix: ${prefixedVideoId} (searched for: ${videoId})`);
        actualVideoId = prefixedVideoId;
        break;
      }
    }
  }
  
  return { video, actualVideoId };
};

/**
 * Creates or ensures the existence of a directory for a video
 * @param videoId The ID of the video
 * @returns The path to the video directory
 */
const ensureVideoDirectory = async (videoId: string): Promise<string> => {
  const dirPath = path.join(env.videoStoragePath, videoId);

  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  return dirPath;
};

/**
 * Downloads a video from a URL and saves metadata
 * @param url The URL of the video to download
 * @returns The video object with metadata
 */
export const downloadVideo = async (url: string): Promise<Video> => {
  try {
    // Clean TikTok URLs only if they have login redirects
    // Don't clean embed URLs as yt-dlp doesn't support them
    if ((url.includes('tiktok.com') || url.includes('vm.tiktok')) && url.includes('tiktok.com/login?redirect_url=')) {
      url = await videoUtils.cleanTikTokUrl(url);
      logger.info(`Using cleaned TikTok URL for download: ${url}`);
    } else if (url.includes('tiktok.com/embed/v2/')) {
      // If it's an embed URL, warn but don't try to clean it
      logger.warn(`TikTok embed URL detected - yt-dlp does not support this format: ${url}`);
      logger.warn(`Please use the original TikTok URL format: https://www.tiktok.com/@username/video/{id}`);
    }

    // Extract video ID from URL
    let videoId = videoUtils.extractVideoId(url);

    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    // Check if video already exists in the database
    const existingVideo = await videoRepository.findOne({ where: { videoId } });

    if (existingVideo) {
      // Check if the video is longer than 30 minutes
      if (existingVideo.duration > 1800) {
        throw new Error('Video is longer than 30 minutes');
      }

      // Update access information
      existingVideo.lastAccessed = new Date();
      existingVideo.downloadCount += 1;
      await videoRepository.save(existingVideo);

      logger.info(`Video already exists, returning cached info: ${videoId}`);
      return existingVideo;
    }

    // Generate hash for the video
    const fileHash = videoUtils.generateFileHash(videoId, url);

    // Create directory for this video
    const videoDir = await ensureVideoDirectory(videoId);

    // Get video info
    let videoInfo = await videoUtils.getVideoInfo(url);

    // Check if the video is longer than 30 minutes
    if (videoInfo.duration && videoInfo.duration > 1800) {
      throw new Error('Video is longer than 30 minutes');
    }

    // --- INÍCIO DO AJUSTE PARA CARROSSEL/INSTAGRAM ---
    // Se for carrossel (entries), pega o primeiro vídeo
    if (videoInfo.entries && Array.isArray(videoInfo.entries)) {
      // Procura o primeiro entry que seja vídeo
      const firstVideoEntry = videoInfo.entries.find(
        (entry: any) => entry.ext === 'mp4' || entry.vcodec !== 'none',
      );
      if (firstVideoEntry) {
        videoInfo = firstVideoEntry;
        url = firstVideoEntry.webpage_url || firstVideoEntry.url || url;
        videoId = videoUtils.extractVideoId(url) || videoId;
        // Check if the video is longer than 30 minutes
        if (firstVideoEntry.duration && firstVideoEntry.duration > 1800) {
          throw new Error('Video is longer than 30 minutes');
        }
      } else {
        throw new Error('Nenhum vídeo encontrado no carrossel do Instagram.');
      }
    }
    // --- FIM DO AJUSTE ---

    // Download the video
    const filePath = await videoUtils.downloadVideo(url, videoDir);

    // Get video duration
    const duration = await videoUtils.getVideoDuration(filePath);

    // Final check for duration after downloading
    if (duration > 1800) {
      // Delete the downloaded file to save space
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      throw new Error('Video is longer than 30 minutes');
    }

    // Extract formats information
    const formats: VideoFormat[] = videoInfo.formats
      ? videoInfo.formats.map((format: any) => ({
          formatId: format.format_id,
          extension: format.ext,
          resolution: format.resolution,
          filesize: format.filesize,
        }))
      : [];

    // Create video record in database
    const newVideo = new Video();
    newVideo.videoId = videoId;
    newVideo.title = videoInfo.title;
    newVideo.description = videoInfo.description;
    newVideo.url = url;
    newVideo.duration = duration;
    newVideo.thumbnail = videoInfo.thumbnail;
    newVideo.formats = formats;
    newVideo.filePath = filePath;
    newVideo.fileHash = fileHash;
    newVideo.downloadDate = new Date();
    newVideo.lastAccessed = new Date();
    newVideo.downloadCount = 1;
    newVideo.accessCount = 0;

    await videoRepository.save(newVideo);
    logger.info(`Video downloaded and saved to database: ${videoId}`);

    return newVideo;
  } catch (error) {
    logger.error(`Error downloading video: ${error}`);
    throw error;
  }
};

/**
 * Cuts a video to create a clip
 * @param videoId The ID of the video to cut
 * @param startTime The start time of the clip (format: HH:MM:SS or MM:SS)
 * @param endTime The end time of the clip (format: HH:MM:SS or MM:SS)
 * @param format The output format (default: mp4)
 * @returns The relative path to the cut video file
 */
export const cutVideo = async (
  videoId: string,
  startTime: string,
  endTime: string,
  format: string = 'mp4',
): Promise<string> => {
  try {
    // Find video in database using fallback search
    const { video } = await findVideoWithFallback(videoId);

    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // Update last accessed timestamp
    video.lastAccessed = new Date();
    await videoRepository.save(video);

    // Create cut filename
    const inputPath = video.filePath;
    const outputPath = path.dirname(inputPath);

    // Cut the video
    const outputFilePath = await videoUtils.cutVideo(
      inputPath,
      outputPath,
      startTime,
      endTime,
      format,
    );

    logger.info(`Video cut successfully: ${outputFilePath}`);

    // Return the relative path for the frontend
    const relativePath = path.relative(env.videoStoragePath, outputFilePath);
    return relativePath;
  } catch (error) {
    logger.error(`Error cutting video: ${error}`);
    throw error;
  }
};

/**
 * Gets the file path for a video
 * @param videoId The ID of the video
 * @returns The file path to the video
 */
export const getVideoPath = async (videoId: string): Promise<string> => {
  try {
    // Find video in database using fallback search
    const { video } = await findVideoWithFallback(videoId);

    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // Update access counts
    video.lastAccessed = new Date();
    video.accessCount += 1;
    await videoRepository.save(video);

    return video.filePath;
  } catch (error) {
    logger.error(`Error getting video path: ${error}`);
    throw error;
  }
};

/**
 * Gets video information
 * @param videoId The ID of the video
 * @returns The video object with metadata
 */
export const getVideoInfo = async (videoId: string): Promise<Video> => {
  try {
    const { video } = await findVideoWithFallback(videoId);

    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    return video;
  } catch (error) {
    logger.error(`Error getting video info: ${error}`);
    throw error;
  }
};

/**
 * Cleans up old videos based on threshold days
 * @returns The number of videos deleted
 */
export const cleanupOldVideos = async (): Promise<number> => {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - env.cleanupThresholdDays);

    // Find old videos in the database
    const oldVideos = await videoRepository
      .createQueryBuilder('video')
      .where('video.lastAccessed < :thresholdDate', { thresholdDate })
      .getMany();

    let deletedCount = 0;

    for (const video of oldVideos) {
      try {
        // Delete the video directory
        const videoDir = path.join(env.videoStoragePath, video.videoId);

        if (fs.existsSync(videoDir)) {
          await fs.promises.rm(videoDir, { recursive: true, force: true });
        }

        // Delete the database record
        await videoRepository.remove(video);
        deletedCount++;

        logger.info(`Deleted old video: ${video.videoId}`);
      } catch (error) {
        logger.error(`Error deleting video ${video.videoId}: ${error}`);
      }
    }

    return deletedCount;
  } catch (error) {
    logger.error(`Error cleaning up old videos: ${error}`);
    throw error;
  }
};

/**
 * Converts a video to MP3 format
 * @param videoId The ID of the video to convert
 * @param startTime Optional start time for cutting (format: HH:MM:SS or MM:SS)
 * @param endTime Optional end time for cutting (format: HH:MM:SS or MM:SS)
 * @returns The relative path to the MP3 file
 */
export const convertVideoToMp3 = async (
  videoId: string,
  startTime?: string,
  endTime?: string,
): Promise<string> => {
  try {
    // Find video in database
    const video = await videoRepository.findOne({ where: { videoId } });

    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // Update last access timestamp
    video.lastAccessed = new Date();
    await videoRepository.save(video);

    // Output directory (same as video directory)
    const outputPath = path.dirname(video.filePath);

    // Convert to MP3
    const mp3FilePath = await videoUtils.convertToMp3(
      video.filePath,
      outputPath,
      startTime,
      endTime,
    );

    logger.info(`Video converted to MP3: ${mp3FilePath}`);

    // Return relative path for frontend
    const relativePath = path.relative(env.videoStoragePath, mp3FilePath);
    return relativePath;
  } catch (error) {
    logger.error(`Error converting video to MP3: ${error}`);
    throw error;
  }
};

/**
 * Gets the file size of a video
 * @param url The URL of the video
 * @returns Object containing file size information in bytes and formatted size
 */
export const getVideoFileSize = async (
  url: string,
): Promise<{ size: number; formattedSize: string; url: string }> => {
  try {
    // Check if it's a short TikTok URL that we shouldn't try to clean
    const isShortTikTok = url.includes('vm.tiktok.com');
    const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok');

    // Clean TikTok URLs to avoid login redirects, but skip for short URLs
    if (isTikTok && !isShortTikTok) {
      url = await videoUtils.cleanTikTokUrl(url);
      logger.info(`Using cleaned TikTok URL for file size check: ${url}`);
    }

    // Extract video ID from URL
    const videoId = videoUtils.extractVideoId(url);

    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    // Check if video already exists in the database
    const existingVideo = await videoRepository.findOne({ where: { videoId } });

    if (existingVideo) {
      // Video already exists, get file size
      const filePath = existingVideo.filePath;
      if (!fs.existsSync(filePath)) {
        throw new Error('Video file not found');
      }

      const stats = await fs.promises.stat(filePath);
      const fileSizeInBytes = stats.size;

      // Format the file size in a human-readable format
      const formattedSize = formatFileSize(fileSizeInBytes);

      return {
        size: fileSizeInBytes,
        formattedSize,
        url,
      };
    }

    // Video doesn't exist, get info from yt-dlp without downloading
    let videoInfo;
    try {
      videoInfo = await videoUtils.getVideoInfo(url);
    } catch (error) {
      // If it's a TikTok URL and getVideoInfo fails, provide an estimate
      if (isTikTok) {
        logger.warn(`Failed to get TikTok video info: ${error}. Using estimates.`);
        // TikTok videos are typically small, estimate 5MB for short videos
        const estimatedSizeBytes = 5 * 1024 * 1024;
        const formattedSize = formatFileSize(estimatedSizeBytes);
        return {
          size: estimatedSizeBytes,
          formattedSize,
          url,
        };
      } else {
        // For non-TikTok videos, rethrow the error
        throw error;
      }
    }

    // Check if the video is longer than 30 minutes
    if (videoInfo.duration && videoInfo.duration > 1800) {
      throw new Error('Video is longer than 30 minutes');
    }

    // Handle carousel/Instagram entries
    if (videoInfo.entries && Array.isArray(videoInfo.entries)) {
      const firstVideoEntry = videoInfo.entries.find(
        (entry: any) => entry.ext === 'mp4' || entry.vcodec !== 'none',
      );
      if (firstVideoEntry) {
        videoInfo = firstVideoEntry;

        // Check duration for carousel entries
        if (firstVideoEntry.duration && firstVideoEntry.duration > 1800) {
          throw new Error('Video is longer than 30 minutes');
        }
      } else {
        throw new Error('No video found in Instagram carousel');
      }
    }

    // Get the best format file size
    let fileSize = 0;
    let bestFormat = null;

    if (videoInfo.formats && Array.isArray(videoInfo.formats)) {
      // Find the format that would be downloaded with "best" quality
      const sortedFormats = videoInfo.formats
        .filter((format: any) => format.filesize && format.filesize > 0)
        .sort((a: any, b: any) => b.filesize - a.filesize);

      if (sortedFormats.length > 0) {
        bestFormat = sortedFormats[0];
        fileSize = bestFormat.filesize;
      }
    }

    // If no specific format is found, use the file size from main info
    if (fileSize === 0 && videoInfo.filesize) {
      fileSize = videoInfo.filesize;
    }

    // If we still don't have a file size, provide an estimate
    if (fileSize === 0) {
      // Estimate based on duration and bitrate
      // Assuming a typical 720p video with ~1500 kbps bitrate
      if (isTikTok) {
        // TikTok videos are typically smaller
        fileSize = 5 * 1024 * 1024; // 5MB estimate for TikTok
      } else {
        const estimatedBitrate = 1500000; // 1500 kbps
        const durationInSeconds = videoInfo.duration || 0;
        fileSize = Math.round((durationInSeconds * estimatedBitrate) / 8);
      }
    }

    const formattedSize = formatFileSize(fileSize);

    return {
      size: fileSize,
      formattedSize,
      url,
    };
  } catch (error) {
    logger.error(`Error getting video file size: ${error}`);
    throw error;
  }
};

/**
 * Formats file size from bytes to a human-readable format
 * @param bytes File size in bytes
 * @returns Formatted file size string (e.g., "10.5 MB")
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
};

export default {
  downloadVideo,
  cutVideo,
  getVideoPath,
  getVideoInfo,
  cleanupOldVideos,
  convertVideoToMp3,
  getVideoFileSize,
};
