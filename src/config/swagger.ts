import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'VideoDownCut API',
    version: '1.0.0',
    description: 'API for downloading and cutting videos',
  },
  servers: [
    {
      url: '/api',
      description: 'API base URL',
    },
  ],
  tags: [
    {
      name: 'videos',
      description: 'Video operations',
    },
  ],
  paths: {
    '/videos/download': {
      post: {
        tags: ['videos'],
        summary: 'Download a video',
        description: 'Download a video from URL and return metadata',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: {
                    type: 'string',
                    description: 'URL of the video to download',
                    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Video downloaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      properties: {
                        videoId: {
                          type: 'string',
                          example: 'dQw4w9WgXcQ',
                        },
                        title: {
                          type: 'string',
                          example: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
                        },
                        duration: {
                          type: 'number',
                          example: 212.1,
                        },
                        thumbnail: {
                          type: 'string',
                          example: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                        },
                        formats: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              formatId: {
                                type: 'string',
                                example: '22',
                              },
                              extension: {
                                type: 'string',
                                example: 'mp4',
                              },
                              resolution: {
                                type: 'string',
                                example: '720p',
                              },
                              filesize: {
                                type: 'number',
                                example: 19177531,
                              },
                            },
                          },
                        },
                        downloadUrl: {
                          type: 'string',
                          example: '/api/videos/download/dQw4w9WgXcQ/dQw4w9WgXcQ.mp4',
                          description: 'URL to download the original video without cuts',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/cut': {
      post: {
        tags: ['videos'],
        summary: 'Cut a video',
        description: 'Cut a video to create a clip',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['videoId', 'cutOptions'],
                properties: {
                  videoId: {
                    type: 'string',
                    description: 'ID of the video to cut',
                    example: 'dQw4w9WgXcQ',
                  },
                  cutOptions: {
                    type: 'object',
                    required: ['startTime', 'endTime'],
                    properties: {
                      startTime: {
                        type: 'string',
                        description: 'Start time in format HH:MM:SS or MM:SS',
                        example: '00:30',
                      },
                      endTime: {
                        type: 'string',
                        description: 'End time in format HH:MM:SS or MM:SS',
                        example: '01:00',
                      },
                      format: {
                        type: 'string',
                        description: 'Output format',
                        enum: ['mp4', 'webm', 'mkv'],
                        default: 'mp4',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Video cut successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      properties: {
                        outputPath: {
                          type: 'string',
                          example: 'dQw4w9WgXcQ/dQw4w9WgXcQ_00-30_01-00.mp4',
                        },
                        streamUrl: {
                          type: 'string',
                          example: '/api/videos/stream/dQw4w9WgXcQ/dQw4w9WgXcQ_00-30_01-00.mp4',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
          },
          '404': {
            description: 'Video not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/stream/{videoId}': {
      get: {
        tags: ['videos'],
        summary: 'Stream a video',
        description: 'Stream the original video',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the video to stream',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video stream',
            content: {
              'video/mp4': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '404': {
            description: 'Video not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/stream': {
      get: {
        tags: ['videos'],
        summary: 'Stream a video by file path',
        description: 'Stream a video using direct file path',
        parameters: [
          {
            name: 'filePath',
            in: 'query',
            required: true,
            description: 'Path to the video file',
            schema: {
              type: 'string',
              example: 'C:\\Users\\username\\videos\\example.mp4',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video stream',
            content: {
              'video/mp4': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '400': {
            description: 'File path not provided',
          },
          '404': {
            description: 'Video file not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/stream/{videoId}/{filename}': {
      get: {
        tags: ['videos'],
        summary: 'Stream a cut video',
        description: 'Stream a specific cut video',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the original video',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
          {
            name: 'filename',
            in: 'path',
            required: true,
            description: 'Filename of the cut video',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ_00-30_01-00.mp4',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video stream',
            content: {
              'video/mp4': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '404': {
            description: 'Video not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/info/{videoId}': {
      get: {
        tags: ['videos'],
        summary: 'Get video info',
        description: 'Get metadata for a video',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the video',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      properties: {
                        videoId: {
                          type: 'string',
                          example: 'dQw4w9WgXcQ',
                        },
                        title: {
                          type: 'string',
                          example: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
                        },
                        description: {
                          type: 'string',
                        },
                        duration: {
                          type: 'number',
                          example: 212.1,
                        },
                        thumbnail: {
                          type: 'string',
                          example: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                        },
                        formats: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              formatId: {
                                type: 'string',
                              },
                              extension: {
                                type: 'string',
                              },
                              resolution: {
                                type: 'string',
                              },
                              filesize: {
                                type: 'number',
                              },
                            },
                          },
                        },
                        downloadDate: {
                          type: 'string',
                          format: 'date-time',
                        },
                        accessCount: {
                          type: 'number',
                        },
                        downloadCount: {
                          type: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Video not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/mp3/{videoId}': {
      get: {
        tags: ['videos'],
        summary: 'Convert video to MP3',
        description: 'Converts a video to MP3 format, with cutting option',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the video to convert',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
          {
            name: 'startTime',
            in: 'query',
            required: false,
            description: 'Start time for cutting (format HH:MM:SS or MM:SS)',
            schema: {
              type: 'string',
              example: '00:30',
            },
          },
          {
            name: 'endTime',
            in: 'query',
            required: false,
            description: 'End time for cutting (format HH:MM:SS or MM:SS)',
            schema: {
              type: 'string',
              example: '01:00',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video successfully converted to MP3',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      properties: {
                        outputPath: {
                          type: 'string',
                          example: 'dQw4w9WgXcQ/dQw4w9WgXcQ_00-30_01-00.mp3',
                        },
                        downloadUrl: {
                          type: 'string',
                          example:
                            '/api/videos/download-mp3-file/dQw4w9WgXcQ/dQw4w9WgXcQ_00-30_01-00.mp3',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
          },
          '404': {
            description: 'Video not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/download-mp3-file/{videoId}/{filename}': {
      get: {
        tags: ['videos'],
        summary: 'MP3 file download',
        description: 'Download the converted MP3 file',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the original video',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
          {
            name: 'filename',
            in: 'path',
            required: true,
            description: 'MP3 filename',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ_00-30_01-00.mp3',
            },
          },
        ],
        responses: {
          '200': {
            description: 'MP3 file download',
            content: {
              'audio/mpeg': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '404': {
            description: 'File not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/download/{filename}': {
      get: {
        tags: ['videos'],
        summary: 'Direct file download',
        description: 'Download a file directly by filename',
        parameters: [
          {
            name: 'filename',
            in: 'path',
            required: true,
            description: 'Name of the file to download',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ_00-30_01-00.mp4',
            },
          },
        ],
        responses: {
          '200': {
            description: 'File download',
            content: {
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '400': {
            description: 'Invalid filename format',
          },
          '404': {
            description: 'File not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/download/{videoId}/{filename}': {
      get: {
        tags: ['videos'],
        summary: 'Download file with video ID',
        description: 'Download a file using video ID and filename',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the video',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
          {
            name: 'filename',
            in: 'path',
            required: true,
            description: 'Name of the file to download',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ_00-30_01-00.mp4',
            },
          },
        ],
        responses: {
          '200': {
            description: 'File download',
            content: {
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '400': {
            description: 'Invalid parameters',
          },
          '404': {
            description: 'File not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
    '/videos/download/{videoId}': {
      get: {
        tags: ['videos'],
        summary: 'Download original video',
        description: 'Download the original video using just the video ID',
        parameters: [
          {
            name: 'videoId',
            in: 'path',
            required: true,
            description: 'ID of the video',
            schema: {
              type: 'string',
              example: 'dQw4w9WgXcQ',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video file download',
            content: {
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '404': {
            description: 'Video not found',
          },
          '500': {
            description: 'Server error',
          },
        },
      },
    },
  },
};

export const setupSwagger = (app: any) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

export default { swaggerDocument, setupSwagger };
