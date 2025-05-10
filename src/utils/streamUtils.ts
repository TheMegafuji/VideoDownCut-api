import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Stream a file with partial content support
 * @param req Express request
 * @param res Express response
 * @param filePath Path to the file
 * @param contentType Content type (defaults to video/mp4)
 * @param next Express next function
 */
export const streamFile = (
  req: Request,
  res: Response,
  filePath: string,
  contentType: string = 'video/mp4',
  next: NextFunction,
): void => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      const error = new Error(`File not found: ${filePath}`);
      logger.error(error.message);
      return next(error);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize) {
        res.status(416).send('Range Not Satisfiable');
        return;
      }

      // Calculate chunk size
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      // Set headers for partial content
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });

      // Stream the file
      file.pipe(res);
    } else {
      // Set headers for full content
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      });

      // Stream the file
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    logger.error(`Error streaming file: ${error}`);
    next(error);
  }
};

export default {
  streamFile,
};
