import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { connectDB } from './config/db';
import env from './config/env';
import logger from './config/logger';
import checkEnv from './config/checkEnv';
import apiRoutes from './routes';
import errorHandler from './middlewares/errorHandler';
import { notFound } from './middlewares/errorHandler';
import { setupSwagger } from './config/swagger';
import cleanupService from './services/cleanupService';
import cron from 'node-cron';

// Check environment variables
checkEnv.checkEnvVariables();
checkEnv.checkSecuritySettings();

// Initialize Express app
const app = express();

// Connect to PostgreSQL
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup static files for Swagger
app.use('/static', express.static(path.join(__dirname, '../public')));

// Add redirect for non-prefixed video routes
app.use('/videos/*', (req: Request, res: Response) => {
  // Redirect to the same path but with /api prefix
  const newPath = `/api${req.originalUrl}`;
  res.redirect(newPath);
});

// Add direct redirect for download URLs
app.get('/download/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  res.redirect(`/api/videos/download/${filename}`);
});

// Add direct redirect for download URLs with videoId
app.get('/download/:videoId/:filename', (req: Request, res: Response) => {
  const { videoId, filename } = req.params;
  res.redirect(`/api/videos/download/${videoId}/${filename}`);
});

// Add direct redirect for original video download with just videoId
app.get('/download/:videoId([^/]+)$', (req: Request, res: Response) => {
  const { videoId } = req.params;
  res.redirect(`/api/videos/download/${videoId}`);
});

// Setup Swagger documentation
setupSwagger(app);

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'VideoDownCut API',
    version: '1.0.0',
    status: 'running',
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Initialize cleanup service
cleanupService.initCleanupSchedule();

// Start server
const PORT = env.port;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);

  // Schedule cleanup job
  if (env.cleanupCronSchedule) {
    cron.schedule(env.cleanupCronSchedule, async () => {
      try {
        const deletedCount = await cleanupService.runCleanup();
        logger.info(`Cleanup job completed. Deleted ${deletedCount} old videos.`);
      } catch (error) {
        logger.error(`Error during cleanup job: ${error}`);
      }
    });
    logger.info(`Cleanup job scheduled: ${env.cleanupCronSchedule}`);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  logger.error(err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});

export default app;
