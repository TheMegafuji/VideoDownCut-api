import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  details?: any[];
}

// Global error handler middleware
const errorHandler = (error: ApiError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log error details
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (error.stack) {
    logger.error(error.stack);
  }

  // Format response based on error details
  const response = {
    success: false,
    error: {
      message,
      statusCode,
      ...(error.details && { details: error.details }),
      ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {}),
    },
  };

  // Send error response
  res.status(statusCode).json(response);
};

// Not found middleware
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`) as ApiError;
  error.statusCode = 404;
  next(error);
};

export default errorHandler;
