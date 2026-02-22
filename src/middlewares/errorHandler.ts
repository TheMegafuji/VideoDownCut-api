import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  details?: any[];
}

// Detect database quota/connection errors (e.g. Neon "compute time quota")
const isDatabaseQuotaOrConnectionError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes('compute time quota') ||
    lower.includes('exceeded the compute time') ||
    lower.includes('upgrade your plan to increase limits') ||
    lower.includes('connection terminated') ||
    lower.includes('too many connections')
  );
};

// Global error handler middleware
const errorHandler = (error: ApiError, req: Request, res: Response, _next: NextFunction) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Map database quota/connection errors to 503 with a clear message
  if (statusCode === 500 && isDatabaseQuotaOrConnectionError(message)) {
    statusCode = 503;
    message =
      'O banco de dados está indisponível (cota de uso excedida ou limite de conexões). Atualize o plano do seu provedor (ex.: Neon) ou tente novamente mais tarde.';
  }

  // Log error details
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (error.stack) {
    logger.error(error.stack);
  }

  // Extract additional error information if available
  const originalError = (error as any).originalError;
  const command = (error as any).command;
  const errorDetails: any = {
    message,
    statusCode,
  };

  // Add original error message if available
  if (originalError) {
    errorDetails.originalError = originalError.message || String(originalError);
  }

  // Add command that failed if available
  if (command) {
    errorDetails.command = command;
  }

  // Add validation details if available
  if (error.details) {
    errorDetails.details = error.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    errorDetails.stack = error.stack;
  }

  // Format response based on error details
  const response = {
    success: false,
    error: errorDetails,
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
