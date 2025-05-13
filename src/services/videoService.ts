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
    // Extract video ID from URL
    let videoId = videoUtils.extractVideoId(url);

    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    // Check if video already exists in the database
    const existingVideo = await videoRepository.findOne({ where: { videoId } });

    if (existingVideo) {
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

    // --- INÍCIO DO AJUSTE PARA CARROSSEL/INSTAGRAM ---
    // Se for carrossel (entries), pega o primeiro vídeo
    if (videoInfo.entries && Array.isArray(videoInfo.entries)) {
      // Procura o primeiro entry que seja vídeo
      const firstVideoEntry = videoInfo.entries.find((entry: any) => entry.ext === 'mp4' || entry.vcodec !== 'none');
      if (firstVideoEntry) {
        videoInfo = firstVideoEntry;
        url = firstVideoEntry.webpage_url || firstVideoEntry.url || url;
        videoId = videoUtils.extractVideoId(url) || videoId;
      } else {
        throw new Error('Nenhum vídeo encontrado no carrossel do Instagram.');
      }
    }
    // --- FIM DO AJUSTE ---

    // Download the video
    const filePath = await videoUtils.downloadVideo(url, videoDir);

    // Get video duration
    const duration = await videoUtils.getVideoDuration(filePath);

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
    // Find video in database
    const video = await videoRepository.findOne({ where: { videoId } });

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
    // Find video in database
    const video = await videoRepository.findOne({ where: { videoId } });

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
    const video = await videoRepository.findOne({ where: { videoId } });

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

export default {
  downloadVideo,
  cutVideo,
  getVideoPath,
  getVideoInfo,
  cleanupOldVideos,
  convertVideoToMp3,
};
