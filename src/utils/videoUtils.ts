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

// Clean up orphaned .part files before download
export const cleanupPartFiles = async (outputPath: string, videoId?: string): Promise<void> => {
  try {
    if (!fs2.existsSync(outputPath)) {
      return;
    }

    const files = await fs.readdir(outputPath);
    const partFiles = files.filter(file => file.endsWith('.part'));
    
    for (const partFile of partFiles) {
      // If videoId is specified, only clean up files for that video
      if (videoId && !partFile.includes(videoId)) {
        continue;
      }
      
      const partPath = path.join(outputPath, partFile);
      try {
        await fs.unlink(partPath);
        logger.info(`Cleaned up orphaned .part file: ${partFile}`);
      } catch (error) {
        logger.warn(`Could not remove .part file ${partFile}: ${error}`);
      }
    }
  } catch (error) {
    logger.warn(`Error during cleanup of .part files: ${error}`);
  }
};

// Execute shell commands as a Promise with retry logic
export const execCommand = (command: string, retries: number = 3): Promise<string> => {
  return new Promise((resolve, reject) => {
    logger.debug(`Executing command: ${command}`);

    const attemptCommand = (attempt: number) => {
      exec(
        command,
        { shell: 'cmd.exe', windowsHide: true },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            logger.error(`Command execution error with code ${(error as any).code} (attempt ${attempt}/${retries})`);
            logger.error(`stderr: ${stderr}`);
            
            // Check if it's a file access error that might be retryable
            const isRetryableError = stderr.includes('WinError 32') || 
                                   stderr.includes('cannot access the file') ||
                                   stderr.includes('being used by another process');
            
            if (isRetryableError && attempt < retries) {
              logger.warn(`Retrying command in 2 seconds (attempt ${attempt + 1}/${retries})`);
              setTimeout(() => attemptCommand(attempt + 1), 2000);
              return;
            }
            
            return reject(new Error(`Command failed with code ${(error as any).code}: ${stderr}`));
          }

          resolve(stdout);
        },
      );
    };

    attemptCommand(1);
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

      // Handle YouTube Shorts URLs
      if (urlObj.pathname.includes('/shorts/')) {
        // Extract ID from /shorts/{videoId} path
        const shortsMatch = urlObj.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch && shortsMatch[1]) {
          return shortsMatch[1];
        }
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
        // For short URLs, extract the code from the path and add tiktok_ prefix
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          // Get last segment of path (the short code)
          const shortCode = pathSegments[pathSegments.length - 1];
          return `tiktok_${shortCode}`;
        } else {
          // Default to hostname when path is empty
          const originSegments = urlObj.hostname.split('.');
          return `tiktok_${originSegments[0]}`;
        }
      }

      // Handle redirection URLs
      if (urlObj.pathname.includes('/login')) {
        const redirectUrl = urlObj.searchParams.get('redirect_url');
        if (redirectUrl) {
          try {
            // Try to extract ID from the redirect URL
            const decodedUrl = decodeURIComponent(redirectUrl);
            return extractVideoId(decodedUrl);
          } catch (e) {
            logger.error(`Failed to extract TikTok ID from redirect URL: ${e}`);
          }
        }
      }

      // Handle regular tiktok.com URLs
      const videoMatch = urlObj.pathname.match(/\/@[^\/]+\/video\/(\d+)/);
      if (videoMatch && videoMatch[1]) {
        return `tiktok_${videoMatch[1]}`;
      }

      // Handle embed URLs
      const embedMatch = urlObj.pathname.match(/\/embed\/v2\/(\d+)/);
      if (embedMatch && embedMatch[1]) {
        return `tiktok_${embedMatch[1]}`;
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

    // For URLs we can't specifically identify, generate a hash
    // Make sure to handle TikTok short URLs as a special case
    if (url.includes('vm.tiktok.com')) {
      // Extract the short code from the URL for consistent IDs
      const shortUrlMatch = url.match(/vm\.tiktok\.com\/([A-Za-z0-9_-]+)/);
      if (shortUrlMatch && shortUrlMatch[1]) {
        return `tiktok_${shortUrlMatch[1]}`;
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

// Get video info via yt-dlp with fallback for TikTok
export const getVideoInfo = async (url: string): Promise<any> => {
  try {
    // Check if it's a TikTok URL
    const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok');
    
    // Check if it's a YouTube Shorts URL
    const isYouTubeShorts = url.includes('youtube.com/shorts/') || url.includes('youtu.be/') && url.includes('shorts');

    // Clean TikTok URLs first to avoid login redirects
    if (isTikTok) {
      url = await cleanTikTokUrl(url);
      logger.info(`Using cleaned TikTok URL: ${url}`);
    }

    // For TikTok URLs, create a custom fallback info if yt-dlp fails
    if (isTikTok) {
      try {
        // Try yt-dlp first
        logger.info('Attempting to get TikTok video info with yt-dlp');

        // Check cookie and authentication settings
        const cookieArgs: string[] = [];

        // If browser and profile are configured, use browser cookies
        if (env.cookiesBrowser) {
          cookieArgs.push(`--cookies-from-browser ${env.cookiesBrowser}`);

          // Add specific profile if provided
          if (env.cookiesProfile) {
            cookieArgs.push(`--cookies-from-browser ${env.cookiesBrowser}:${env.cookiesProfile}`);
          }
        }
        // If cookie file is configured, use that file
        else if (env.cookiesFile && fs2.existsSync(env.cookiesFile)) {
          logger.info(`Using cookies file for video info: ${env.cookiesFile}`);
          cookieArgs.push(`--cookies "${env.cookiesFile}"`);
        } else {
          logger.warn('No cookies configuration found for TikTok video info');
        }

        let ytDlpCommand = 'yt-dlp --dump-json';
        ytDlpCommand += ' --no-check-certificates --ignore-errors --no-warnings --no-part --no-mtime';
        ytDlpCommand +=
          ' --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"';
        ytDlpCommand += ' --referer "https://www.tiktok.com/"';

        // Add cookie arguments if available
        if (cookieArgs.length > 0) {
          ytDlpCommand += ` ${cookieArgs.join(' ')}`;
        }

        ytDlpCommand += ` "${url.replace(/"/g, '\\"')}"`;

        const output = await execCommand(ytDlpCommand);
        return JSON.parse(output);
      } catch (ytDlpError) {
        logger.warn(`yt-dlp failed to get TikTok info: ${ytDlpError}. Creating fallback info.`);

        // Create a basic info object for TikTok videos when yt-dlp fails
        const videoId = extractVideoId(url) || 'tiktok_unknown';

        // Return minimal information object with default values
        // No need to try complex HTML extraction which won't work cross-platform
        return {
          id: videoId,
          title: 'TikTok Video',
          description: 'Downloaded from TikTok',
          thumbnail: '',
          duration: 0, // We don't know the duration yet
          formats: [],
          // Add minimal required fields
          _type: 'video',
          extractor: 'tiktok',
          extractor_key: 'TikTok',
          webpage_url: url,
          ext: 'mp4',
        };
      }
    }

    // Standard logic for non-TikTok videos (including YouTube Shorts, Instagram)
    const isInstagram = url.includes('instagram.com');

    // Check cookie and authentication settings (Instagram often requires login/cookies)
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

    if (isInstagram && cookieArgs.length === 0) {
      logger.warn('Instagram URL detected but no cookies configured. Set COOKIES_BROWSER or COOKIES_FILE for best results.');
    }

    // Create a single command with all parts (with Windows file handling)
    // Add extra flags for YouTube Shorts to ensure compatibility
    let fullCommand = 'yt-dlp --dump-json --no-part --no-mtime';

    // Instagram: referer and user-agent improve extraction (yt-dlp docs)
    if (isInstagram) {
      fullCommand +=
        ' --referer "https://www.instagram.com/" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"';
      logger.info('Detected Instagram URL, using referer and cookies');
    }

    // Add flags for better YouTube Shorts support
    // Using android client for better compatibility with Shorts
    if (isYouTubeShorts) {
      // Escape quotes properly for Windows cmd.exe
      fullCommand += ' --extractor-args youtube:player_client=android';
      logger.info('Detected YouTube Shorts URL, using optimized flags');
    }

    if (cookieArgs.length > 0) {
      fullCommand += ' ' + cookieArgs.join(' ');
    }

    // Add URL with double quotes
    fullCommand += ` "${url.replace(/"/g, '\\"')}"`;

    logger.debug(`Executing command: ${fullCommand}`);
    try {
      const output = await execCommand(fullCommand);
      return JSON.parse(output);
    } catch (execError: any) {
      // Enhanced error logging for better debugging
      const errorMessage = execError?.message || String(execError);
      const errorStack = execError?.stack || '';
      logger.error(`yt-dlp command failed: ${errorMessage}`);
      logger.error(`Command was: ${fullCommand}`);
      if (errorStack) {
        logger.error(`Stack trace: ${errorStack}`);
      }
      
      // Re-throw with more context
      const enhancedError = new Error(`Failed to get video info: ${errorMessage}`);
      (enhancedError as any).originalError = execError;
      (enhancedError as any).command = fullCommand;
      throw enhancedError;
    }
  } catch (error: any) {
    // Enhanced error logging
    const errorMessage = error?.message || String(error);
    const errorDetails = error?.originalError ? error.originalError.message : '';
    logger.error(`Failed to get video info for URL: ${url}`);
    logger.error(`Error: ${errorMessage}`);
    if (errorDetails) {
      logger.error(`Original error: ${errorDetails}`);
    }
    if (error?.stack) {
      logger.error(`Stack: ${error.stack}`);
    }
    throw error;
  }
};

// Fallback method for TikTok using direct video download with ffmpeg
export const directTikTokDownload = async (
  url: string,
  outputPath: string,
  videoId: string,
): Promise<string> => {
  try {
    logger.info(`Attempting direct TikTok download for: ${url}`);

    // Define output file path
    const outputFilePath = path.join(outputPath, `${videoId}.mp4`);

    // Check cookie and authentication settings
    const cookieArgs: string[] = [];

    // If browser and profile are configured, use browser cookies
    if (env.cookiesBrowser) {
      cookieArgs.push(`--cookies-from-browser ${env.cookiesBrowser}`);

      // Add specific profile if provided
      if (env.cookiesProfile) {
        cookieArgs.push(`--cookies-from-browser ${env.cookiesBrowser}:${env.cookiesProfile}`);
      }
    }
    // If cookie file is configured, use that file
    else if (env.cookiesFile && fs2.existsSync(env.cookiesFile)) {
      logger.info(`Using cookies file for direct download: ${env.cookiesFile}`);
      cookieArgs.push(`--cookies "${env.cookiesFile}"`);
    } else {
      logger.warn('No cookies configuration found for direct TikTok download');
    }

    // Use yt-dlp with all possible options to maximize chance of success (with Windows file handling)
    let ytDlpCommand = `yt-dlp --force-overwrites --no-check-certificates --ignore-errors --no-warnings --no-playlist --no-part --no-mtime --concurrent-fragments 1 --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" --referer "https://www.tiktok.com/" --add-header "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" --add-header "Accept-Language: en-US,en;q=0.9"`;

    // Add cookie arguments if available
    if (cookieArgs.length > 0) {
      ytDlpCommand += ` ${cookieArgs.join(' ')}`;
    }

    ytDlpCommand += ` -o "${outputFilePath}" "${url}"`;

    logger.debug(`Running download command: ${ytDlpCommand}`);
    await execCommand(ytDlpCommand);

    logger.info(`Successfully downloaded TikTok video to: ${outputFilePath}`);

    return outputFilePath;
  } catch (error) {
    logger.error(`Failed direct TikTok download: ${error}`);
    throw error;
  }
};

// Download video via yt-dlp with fallback to ffmpeg for TikTok
export const downloadVideo = async (
  url: string,
  outputPath: string,
  format?: string,
): Promise<string> => {
  try {
    // Extract video ID for cleanup
    const initialVideoId = extractVideoId(url);
    
    // Clean up any orphaned .part files first
    if (initialVideoId) {
      await cleanupPartFiles(outputPath, initialVideoId);
    }

    // Check if it's a TikTok URL
    const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok');
    const isShortTikTok = url.includes('vm.tiktok.com');

    // Clean TikTok URLs only if they have login redirects
    // Don't clean embed URLs as yt-dlp doesn't support them anyway
    // Only clean if it's a login redirect URL
    if (isTikTok && url.includes('tiktok.com/login?redirect_url=')) {
      url = await cleanTikTokUrl(url);
      logger.info(`Using cleaned TikTok URL for download: ${url}`);
    } else if (isTikTok && url.includes('tiktok.com/embed/v2/')) {
      // If it's an embed URL, warn but don't try to clean it
      logger.warn(`TikTok embed URL detected - yt-dlp does not support this format: ${url}`);
      logger.warn(`Please use the original TikTok URL format: https://www.tiktok.com/@username/video/{id}`);
    }

    // For TikTok URLs, try the yt-dlp approach
    if (isTikTok) {
      try {
        // Get video ID (for file naming)
        const videoId = extractVideoId(url);
        if (!videoId) {
          throw new Error('Could not extract video ID from TikTok URL');
        }

        logger.info(`Attempting download for TikTok: ${url}`);

        // Check cookie and authentication settings
        const cookieArgs: string[] = [];

        // If browser and profile are configured, use browser cookies
        if (env.cookiesBrowser) {
          cookieArgs.push(`--cookies-from-browser ${env.cookiesBrowser}`);

          // Add specific profile if provided
          if (env.cookiesProfile) {
            cookieArgs.push(`--cookies-from-browser ${env.cookiesBrowser}:${env.cookiesProfile}`);
          }
        }
        // If cookie file is configured, use that file
        else if (env.cookiesFile && fs2.existsSync(env.cookiesFile)) {
          logger.info(`Using cookies file: ${env.cookiesFile}`);
          cookieArgs.push(`--cookies "${env.cookiesFile}"`);
        } else {
          logger.warn('No cookies configuration found for TikTok download');
        }

        // Short TikTok URLs need special handling
        if (isShortTikTok) {
          // For short URLs, use the simple direct download approach
          // This uses yt-dlp with lots of options to try to handle the URL
          const simpleOutputPath = path.join(outputPath, `${videoId}.mp4`);

          let ytDlpSimpleCommand = `yt-dlp --force-overwrites --no-check-certificates --ignore-errors --no-warnings --no-check-formats --concurrent-fragments 1 --no-part --no-mtime --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"`;

          // Add cookie arguments if available
          if (cookieArgs.length > 0) {
            ytDlpSimpleCommand += ` ${cookieArgs.join(' ')}`;
          }

          ytDlpSimpleCommand += ` -o "${simpleOutputPath}" "${url}"`;

          logger.debug(`Executing yt-dlp simple command: ${ytDlpSimpleCommand}`);
          await execCommand(ytDlpSimpleCommand);

          // Check if the file was created
          if (fs2.existsSync(simpleOutputPath)) {
            logger.info(`TikTok download successful: ${simpleOutputPath}`);
            return simpleOutputPath;
          }

          throw new Error('yt-dlp download did not produce output file');
        }

        // For regular TikTok URLs, use the normal approach
        const outputTemplate = path.join(outputPath, '%(id)s.%(ext)s');

        // Attempt with yt-dlp (optimized for TikTok with Windows file handling)
        // Don't specify format to avoid "best" warning - let yt-dlp choose automatically
        let ytDlpCommand = 'yt-dlp';
        ytDlpCommand += ' --no-check-certificates --ignore-errors --no-warnings';
        ytDlpCommand += ' --no-part --force-overwrites --no-mtime --concurrent-fragments 1'; // Windows file handling improvements
        ytDlpCommand +=
          ' --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"';
        ytDlpCommand += ' --referer "https://www.tiktok.com/"';

        // Add cookie arguments if available
        if (cookieArgs.length > 0) {
          ytDlpCommand += ` ${cookieArgs.join(' ')}`;
        }

        ytDlpCommand += ` -o "${outputTemplate}" "${url.replace(/"/g, '\\"')}"`;

        try {
          logger.debug(`Executing yt-dlp command: ${ytDlpCommand}`);
          const output = await execCommand(ytDlpCommand);
          logger.info(`Primary TikTok download completed: ${url}`);

          // Check if download was successful
          const downloadedFile = output.match(/\[download\] Destination: (.+)/);
          if (downloadedFile && downloadedFile[1]) {
            return downloadedFile[1];
          }

          // If no file found in output, look in directory
          const files = await fs.readdir(outputPath);
          const matchingFiles = files.filter(file => file.startsWith(videoId));

          if (matchingFiles.length > 0) {
            return path.join(outputPath, matchingFiles[0]);
          }

          // If we get here, yt-dlp didn't work, try the fallback
          throw new Error('yt-dlp download did not produce output file');
        } catch (ytDlpError) {
          // yt-dlp failed, try direct method
          logger.warn(`yt-dlp failed for TikTok: ${ytDlpError}. Trying fallback method.`);
          return await directTikTokDownload(url, outputPath, videoId);
        }
      } catch (tiktokError) {
        logger.error(`All TikTok download methods failed: ${tiktokError}`);
        throw tiktokError;
      }
    }

    // Regular non-TikTok download logic (including YouTube Shorts, Instagram)
    const outputTemplate = path.join(outputPath, '%(id)s.%(ext)s');

    // Check if it's a YouTube Shorts URL or Instagram
    const isYouTubeShorts = url.includes('youtube.com/shorts/') || (url.includes('youtu.be/') && url.includes('shorts'));
    const isInstagram = url.includes('instagram.com');

    // Check cookie and authentication settings (Instagram often requires cookies)
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

    // Create a single command with all parts (with Windows file handling improvements)
    // Don't specify format to avoid "best" warning - let yt-dlp choose automatically
    let fullCommand = 'yt-dlp';
    fullCommand += ' --no-part --force-overwrites --no-mtime --concurrent-fragments 1'; // Windows file handling improvements

    // Instagram: referer and user-agent (yt-dlp docs recommend for Instagram)
    if (isInstagram) {
      fullCommand +=
        ' --referer "https://www.instagram.com/" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"';
      logger.info('Detected Instagram URL for download, using referer and cookies');
    }

    // Add flags for better YouTube Shorts support
    if (isYouTubeShorts) {
      fullCommand += ' --extractor-args youtube:player_client=android';
      logger.info('Detected YouTube Shorts URL, using optimized flags for download');
    }

    if (cookieArgs.length > 0) {
      fullCommand += ' ' + cookieArgs.join(' ');
    }

    // Add output template
    fullCommand += ` -o "${outputTemplate}"`;

    // Add URL with double quotes
    fullCommand += ` "${url.replace(/"/g, '\\"')}"`;

    logger.info(`Starting download: ${url}`);
    logger.debug(`Executing command: ${fullCommand}`);

    let output: string;
    try {
      output = await execCommand(fullCommand);
      logger.info(`Download completed: ${url}`);
    } catch (execError: any) {
      // Enhanced error logging for better debugging
      const errorMessage = execError?.message || String(execError);
      logger.error(`yt-dlp download failed: ${errorMessage}`);
      logger.error(`Command was: ${fullCommand}`);
      if (execError?.stack) {
        logger.error(`Stack trace: ${execError.stack}`);
      }
      
      // Re-throw with more context
      const enhancedError = new Error(`Failed to download video: ${errorMessage}`);
      (enhancedError as any).originalError = execError;
      (enhancedError as any).command = fullCommand;
      throw enhancedError;
    }

    // Clean up any remaining .part files after download
    if (initialVideoId) {
      await cleanupPartFiles(outputPath, initialVideoId);
    }

    // Extract the file path from yt-dlp output
    const downloadedFile = output.match(/\[download\] Destination: (.+)/);
    if (downloadedFile && downloadedFile[1]) {
      // Verify the file actually exists
      const filePath = downloadedFile[1].trim();
      if (fs2.existsSync(filePath)) {
        return filePath;
      }
    }

    // If we can't parse the output, find the latest file in the directory
    const files = await fs.readdir(outputPath);
    const videoId = extractVideoId(url);
    const matchingFiles = files.filter(file => file.startsWith(videoId as string) && !file.endsWith('.part'));

    if (matchingFiles.length === 0) {
      throw new Error('Downloaded file not found');
    }

    const finalPath = path.join(outputPath, matchingFiles[0]);
    
    // Verify the final file exists
    if (!fs2.existsSync(finalPath)) {
      throw new Error('Downloaded file verification failed');
    }

    return finalPath;
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

// Clean and fix TikTok URLs that redirect to login pages
// NOTE: yt-dlp does NOT support embed URLs (https://www.tiktok.com/embed/v2/{id})
// yt-dlp requires the original TikTok URL format: https://www.tiktok.com/@username/video/{id}
// We should only clean URLs that have login redirects, otherwise keep the original format
export const cleanTikTokUrl = async (url: string): Promise<string> => {
  try {
    // Check if it's a TikTok URL with login redirect - this is the only case we need to clean
    if (url.includes('tiktok.com/login?redirect_url=')) {
      logger.info(`Detected TikTok login redirect URL: ${url}`);

      // Extract the original URL from the redirect_url parameter
      const urlObj = new URL(url);
      const redirectUrl = urlObj.searchParams.get('redirect_url');

      if (redirectUrl) {
        // Decode the URL
        const decodedUrl = decodeURIComponent(redirectUrl);
        logger.info(`Extracted original TikTok URL from redirect: ${decodedUrl}`);
        
        // Return the decoded URL - this should be in the correct format for yt-dlp
        return decodedUrl;
      }
    }
    // If it's an embed URL, we cannot convert it back without the username
    // In this case, we should NOT clean it and let the caller handle the error
    else if (url.includes('tiktok.com/embed/v2/')) {
      logger.warn(`Detected TikTok embed URL (not supported by yt-dlp): ${url}`);
      logger.warn(`Embed URLs cannot be converted back to standard format without username`);
      // Return as-is and let yt-dlp handle the error with a clear message
      return url;
    }
    // For all other TikTok URLs (including vm.tiktok.com and standard URLs)
    // Return as-is - yt-dlp can handle them if they're in the correct format
    // Supported formats:
    // - https://www.tiktok.com/@username/video/{id}
    // - https://vm.tiktok.com/{code}
    else if (url.includes('tiktok.com') || url.includes('vm.tiktok')) {
      logger.info(`Using original TikTok URL format (no cleaning needed): ${url}`);
      return url;
    }

    // Return original URL if no conversion was possible
    return url;
  } catch (error) {
    logger.error(`Error cleaning TikTok URL: ${error}`);
    // Return the original URL if there was an error
    return url;
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
  cleanTikTokUrl,
  directTikTokDownload,
  cleanupPartFiles,
};
