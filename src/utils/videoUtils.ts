import { promises as fs } from 'fs';
import fs2 from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../config/logger';
import env from '../config/env';
import { spawn, exec } from 'child_process';

// Generate a file hash based on video ID and URL
export const generateFileHash = (videoId: string, url: string): string => {
  return crypto.createHash('sha256').update(`${videoId}-${url}`).digest('hex').substring(0, 16);
};

// Execute shell commands as a Promise
export const execCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    logger.debug(`Executing command: ${command}`);

    exec(
      command,
      { shell: 'cmd.exe', windowsHide: true },
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          logger.error(`Command execution error with code ${(error as any).code}`);
          logger.error(`stderr: ${stderr}`);
          return reject(new Error(`Command failed with code ${(error as any).code}: ${stderr}`));
        }

        resolve(stdout);
      },
    );
  });
};

// Ensure a valid filename (removes unsafe characters)
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^\w\s.-]/g, '_');
};

// Validate a video ID using regex
export const isValidVideoId = (videoId: string): boolean => {
  // YouTube, Vimeo IDs: 5-20 alphanumeric
  // Twitter/X status IDs: typically 15-25 digits
  // Instagram and TikTok prefixed IDs: tiktok_XXXXX or instagram_XXXXX
  // URL hash fallbacks: url_XXXXX
  return (
    /^[a-zA-Z0-9_-]{5,20}$/.test(videoId) ||
    /^\d{15,25}$/.test(videoId) ||
    /^(tiktok|instagram|url)_[a-zA-Z0-9_-]{5,30}$/.test(videoId)
  );
};

// Extract video ID from a URL
export const extractVideoId = (url: string): string | null => {
  try {
    // First, clean the URL by removing potential URL parameters
    const cleanUrl = url.split('&')[0]; // Remove additional parameters with &
    const urlObj = new URL(cleanUrl);

    // YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      if (urlObj.hostname.includes('youtu.be')) {
        // For youtu.be URLs, the ID is in the pathname but might include ?si= or ?t=
        return urlObj.pathname.substring(1).split('?')[0];
      }
      return urlObj.searchParams.get('v');
    }

    // Vimeo
    if (urlObj.hostname.includes('vimeo.com')) {
      return urlObj.pathname.split('/')[1];
    }

    // Twitter/X
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      const match = urlObj.pathname.match(/\/status\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // TikTok
    if (urlObj.hostname.includes('tiktok.com')) {
      // Handle vm.tiktok.com short URLs
      if (urlObj.hostname.includes('vm.tiktok.com')) {
        // For short URLs, use the last path segment
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          return `tiktok_${pathSegments[pathSegments.length - 1]}`;
        }
      }

      // Handle regular tiktok.com URLs
      const videoMatch = urlObj.pathname.match(/\/@[^\/]+\/video\/(\d+)/);
      if (videoMatch && videoMatch[1]) {
        return `tiktok_${videoMatch[1]}`;
      }
    }

    // Instagram
    if (urlObj.hostname.includes('instagram.com')) {
      // Handle both /p/ and /reel/ URLs
      const instaMatch = urlObj.pathname.match(/\/(p|reel|share)\/([A-Za-z0-9_-]+)/);
      if (instaMatch && instaMatch[2]) {
        return `instagram_${instaMatch[2]}`;
      }
    }

    // Generate a hash for other URLs
    const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);

    return `url_${urlHash}`;
  } catch (error) {
    logger.error(`Failed to extract video ID: ${error}`);
    return null;
  }
};

// Get video info via yt-dlp
export const getVideoInfo = async (url: string): Promise<any> => {
  try {
    // Check cookie and authentication settings
    const cookieArgs: string[] = [];

    // If browser and profile are configured, use browser cookies
    if (env.cookiesBrowser) {
      cookieArgs.push('--cookies-from-browser', `${env.cookiesBrowser}`);

      // Add specific profile if provided
      if (env.cookiesProfile) {
        cookieArgs.push('--cookies-from-browser', `${env.cookiesBrowser}:${env.cookiesProfile}`);
      }
    }
    // If cookie file is configured, use that file
    else if (env.cookiesFile && fs2.existsSync(env.cookiesFile)) {
      cookieArgs.push('--cookies', env.cookiesFile);
    }

    // Create a single command with all parts
    let fullCommand = 'yt-dlp --dump-json';

    if (cookieArgs.length > 0) {
      fullCommand += ' ' + cookieArgs.join(' ');
    }

    // Add URL with double quotes
    fullCommand += ` "${url.replace(/"/g, '\\"')}"`;

    logger.debug(`Executing command: ${fullCommand}`);
    const output = await execCommand(fullCommand);
    return JSON.parse(output);
  } catch (error) {
    logger.error(`Failed to get video info: ${error}`);
    throw error;
  }
};

// Download video via yt-dlp
export const downloadVideo = async (
  url: string,
  outputPath: string,
  format: string = 'best',
): Promise<string> => {
  try {
    const outputTemplate = path.join(outputPath, '%(id)s.%(ext)s');

    // Check cookie and authentication settings
    const cookieArgs: string[] = [];

    // If browser and profile are configured, use browser cookies
    if (env.cookiesBrowser) {
      cookieArgs.push('--cookies-from-browser', `${env.cookiesBrowser}`);

      // Add specific profile if provided
      if (env.cookiesProfile) {
        cookieArgs.push('--cookies-from-browser', `${env.cookiesBrowser}:${env.cookiesProfile}`);
      }
    }
    // If cookie file is configured, use that file
    else if (env.cookiesFile && fs2.existsSync(env.cookiesFile)) {
      cookieArgs.push('--cookies', env.cookiesFile);
    }

    // Create a single command with all parts
    let fullCommand = `yt-dlp -f ${format}`;

    if (cookieArgs.length > 0) {
      fullCommand += ' ' + cookieArgs.join(' ');
    }

    // Add output template
    fullCommand += ` -o "${outputTemplate}"`;

    // Add URL with double quotes
    fullCommand += ` "${url.replace(/"/g, '\\"')}"`;

    logger.info(`Starting download: ${url}`);
    logger.debug(`Executing command: ${fullCommand}`);

    const output = await execCommand(fullCommand);
    logger.info(`Download completed: ${url}`);

    // Extract the file path from yt-dlp output
    const downloadedFile = output.match(/\[download\] Destination: (.+)/);
    if (downloadedFile && downloadedFile[1]) {
      return downloadedFile[1];
    }

    // If we can't parse the output, find the latest file in the directory
    const files = await fs.readdir(outputPath);
    const videoId = extractVideoId(url);
    const matchingFiles = files.filter(file => file.startsWith(videoId as string));

    if (matchingFiles.length === 0) {
      throw new Error('Downloaded file not found');
    }

    return path.join(outputPath, matchingFiles[0]);
  } catch (error) {
    logger.error(`Failed to download video: ${error}`);
    throw error;
  }
};

// Cut video using FFmpeg
export const cutVideo = async (
  inputPath: string,
  outputPath: string,
  startTime: string,
  endTime: string,
  format: string = 'mp4',
): Promise<string> => {
  try {
    // Generate output filename
    const inputFileName = path.basename(inputPath, path.extname(inputPath));
    const sanitizedStartTime = startTime.replace(/:/g, '-');
    const sanitizedEndTime = endTime.replace(/:/g, '-');
    const outputFileName = `${inputFileName}_${sanitizedStartTime}_${sanitizedEndTime}.${format}`;
    const outputFilePath = path.join(outputPath, outputFileName);

    // Select codecs based on format
    let command = '';
    if (format === 'webm') {
      // WebM requires VP9 for video and Opus for audio
      command = `ffmpeg -i "${inputPath}" -ss ${startTime} -to ${endTime} -c:v libvpx-vp9 -c:a libopus "${outputFilePath}"`;
    } else if (format === 'mkv') {
      // MKV can use the same codecs as MP4
      command = `ffmpeg -i "${inputPath}" -ss ${startTime} -to ${endTime} -c:v libx264 -c:a aac -strict experimental "${outputFilePath}"`;
    } else {
      // Default MP4
      command = `ffmpeg -i "${inputPath}" -ss ${startTime} -to ${endTime} -c:v libx264 -c:a aac -strict experimental "${outputFilePath}"`;
    }

    logger.info(`Starting video cut: ${inputPath}`);
    await execCommand(command);
    logger.info(`Video cut completed: ${outputFilePath}`);

    return outputFilePath;
  } catch (error) {
    logger.error(`Failed to cut video: ${error}`);
    throw error;
  }
};

// Get video duration using FFmpeg
export const getVideoDuration = async (filePath: string): Promise<number> => {
  try {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = await execCommand(command);
    return parseFloat(output.trim());
  } catch (error) {
    logger.error(`Failed to get video duration: ${error}`);
    throw error;
  }
};

// Clean up old videos
export const cleanupOldVideos = async (thresholdDays: number): Promise<number> => {
  try {
    const uploadsDir = env.videoStoragePath;

    // Get all subdirectories in the uploads directory
    const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    const videoDirs = entries.filter(entry => entry.isDirectory()).map(dir => dir.name);

    let removedCount = 0;
    const thresholdTime = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

    for (const videoDir of videoDirs) {
      const dirPath = path.join(uploadsDir, videoDir);

      try {
        const dirStat = await fs.stat(dirPath);

        // Check if directory is older than threshold
        if (dirStat.mtime.getTime() < thresholdTime) {
          // Remove the directory and its contents
          await fs.rm(dirPath, { recursive: true, force: true });
          logger.info(`Removed old video directory: ${videoDir}`);
          removedCount++;
        }
      } catch (error) {
        logger.error(`Error processing directory ${videoDir}: ${error}`);
      }
    }

    return removedCount;
  } catch (error) {
    logger.error(`Cleanup error: ${error}`);
    throw error;
  }
};

// Convert video to MP3 using FFmpeg
export const convertToMp3 = async (
  inputPath: string,
  outputDir: string,
  startTime?: string,
  endTime?: string,
): Promise<string> => {
  try {
    // Generate filename for MP3
    const inputFileName = path.basename(inputPath, path.extname(inputPath));
    let outputFileName = `${inputFileName}.mp3`;

    // If it's a cut, add time information to the filename
    if (startTime && endTime) {
      const sanitizedStartTime = startTime.replace(/:/g, '-');
      const sanitizedEndTime = endTime.replace(/:/g, '-');
      outputFileName = `${inputFileName}_${sanitizedStartTime}_${sanitizedEndTime}.mp3`;
    }

    const outputFilePath = path.join(outputDir, outputFileName);

    // Use a simpler approach with direct spawn instead of command string
    // This avoids issues with argument parsing
    let ffmpegArgs = ['-i', inputPath];

    // Add time arguments if provided
    if (startTime) ffmpegArgs.push('-ss', startTime);
    if (endTime) ffmpegArgs.push('-to', endTime);

    // Add audio conversion arguments
    ffmpegArgs = ffmpegArgs.concat([
      '-vn', // No video
      '-ab',
      '128k', // Audio bitrate
      '-ar',
      '44100', // Audio sample rate
      '-f',
      'mp3', // Force MP3 format
      outputFilePath, // Output file
    ]);

    logger.info(`Starting MP3 conversion: ${inputPath}`);

    // Use spawn directly without shell
    return new Promise((resolve, reject) => {
      const process = spawn('ffmpeg', ffmpegArgs, {
        windowsHide: true,
      });

      process.stderr.on('data', data => {
        const output = data.toString().trim();
        // Only log every 30th message to avoid flooding logs
        if (output.includes('time=')) {
          const timeMatch = output.match(/time=(\d+:\d+:\d+)/);
          if (timeMatch && timeMatch[1]) {
            logger.debug(`MP3 conversion progress: ${timeMatch[1]}`);
          }
        }
      });

      process.on('close', code => {
        if (code !== 0) {
          logger.error(`MP3 conversion failed with code ${code}`);
          reject(new Error(`FFmpeg process exited with code ${code}`));
        } else {
          logger.info(`MP3 conversion completed: ${outputFilePath}`);
          resolve(outputFilePath);
        }
      });

      process.on('error', error => {
        logger.error(`MP3 conversion error: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    logger.error(`Failed to convert to MP3: ${error}`);
    throw error;
  }
};

export default {
  generateFileHash,
  execCommand,
  sanitizeFilename,
  isValidVideoId,
  extractVideoId,
  getVideoInfo,
  downloadVideo,
  cutVideo,
  getVideoDuration,
  cleanupOldVideos,
  convertToMp3,
};
